-- ============================================================
-- AtomQuest Portal — Migration 003: Functions & Triggers
-- ============================================================

-- ============================================================
-- FUNCTION: compute_score
-- Computes a 0-100 score based on UoM direction, target, and actual
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_score(
  p_uom_direction uom_direction,
  p_target NUMERIC,
  p_actual NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  IF p_target IS NULL OR p_actual IS NULL THEN
    RETURN NULL;
  END IF;

  CASE p_uom_direction
    WHEN 'max' THEN
      -- Higher actual is better; cap at 100
      IF p_target = 0 THEN
        RETURN 0;
      END IF;
      v_score := LEAST((p_actual / p_target) * 100, 100);

    WHEN 'min' THEN
      -- Lower actual is better (e.g. reduce defects); cap at 100
      IF p_actual = 0 THEN
        RETURN 100;
      END IF;
      v_score := LEAST((p_target / p_actual) * 100, 100);

    WHEN 'zero' THEN
      -- Target is exactly zero (e.g. zero incidents)
      IF p_actual = 0 THEN
        v_score := 100;
      ELSE
        v_score := 0;
      END IF;

    WHEN 'timeline' THEN
      -- For timeline goals, score is managed by checkin submission date logic
      -- Return null to indicate it must be computed externally
      RETURN NULL;

    ELSE
      v_score := 0;
  END CASE;

  -- Clamp to [0, 100]
  RETURN GREATEST(LEAST(v_score, 100), 0);
END;
$$;

-- ============================================================
-- FUNCTION: get_active_cycle
-- Returns the currently active goal cycle row
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_cycle()
RETURNS public.goal_cycles
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM public.goal_cycles WHERE is_active = TRUE LIMIT 1;
$$;

-- ============================================================
-- FUNCTION: is_quarter_open
-- Returns TRUE if the given quarter window is currently open
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_quarter_open(
  p_cycle_id UUID,
  p_quarter quarter
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_opens DATE;
  v_closes DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT
    CASE p_quarter
      WHEN 'q1' THEN q1_opens
      WHEN 'q2' THEN q2_opens
      WHEN 'q3' THEN q3_opens
      WHEN 'q4' THEN q4_opens
    END,
    CASE p_quarter
      WHEN 'q1' THEN q1_closes
      WHEN 'q2' THEN q2_closes
      WHEN 'q3' THEN q3_closes
      WHEN 'q4' THEN q4_closes
    END
  INTO v_opens, v_closes
  FROM public.goal_cycles
  WHERE id = p_cycle_id;

  IF v_opens IS NULL OR v_closes IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_today BETWEEN v_opens AND v_closes;
END;
$$;

-- ============================================================
-- FUNCTION: get_current_quarter
-- Returns the current open quarter for a cycle, or NULL
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_quarter(p_cycle_id UUID)
RETURNS quarter
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_cycle public.goal_cycles;
BEGIN
  SELECT * INTO v_cycle FROM public.goal_cycles WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_today BETWEEN v_cycle.q1_opens AND v_cycle.q1_closes THEN
    RETURN 'q1';
  ELSIF v_today BETWEEN v_cycle.q2_opens AND v_cycle.q2_closes THEN
    RETURN 'q2';
  ELSIF v_today BETWEEN v_cycle.q3_opens AND v_cycle.q3_closes THEN
    RETURN 'q3';
  ELSIF v_today BETWEEN v_cycle.q4_opens AND v_cycle.q4_closes THEN
    RETURN 'q4';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: sync_shared_goal_checkin
-- Updates all linked shared goals' checkins when a primary checkin is saved
-- Called atomically from within a transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_shared_goal_checkins(
  p_source_goal_id UUID,
  p_quarter quarter,
  p_actual NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shared_goal RECORD;
  v_uom_direction uom_direction;
  v_target NUMERIC;
  v_score NUMERIC;
BEGIN
  -- Find all goals that were shared FROM this source goal
  FOR v_shared_goal IN
    SELECT g.id, g.uom_direction, g.target
    FROM public.goals g
    WHERE g.shared_from_id = p_source_goal_id
      AND g.is_shared = TRUE
  LOOP
    v_uom_direction := v_shared_goal.uom_direction;
    v_target := v_shared_goal.target;
    v_score := public.compute_score(v_uom_direction, v_target, p_actual);

    INSERT INTO public.checkins (goal_id, quarter, actual, score, status, submitted_at)
    VALUES (v_shared_goal.id, p_quarter, p_actual, v_score, 'completed', NOW())
    ON CONFLICT (goal_id, quarter)
    DO UPDATE SET
      actual = EXCLUDED.actual,
      score = EXCLUDED.score,
      status = 'completed',
      submitted_at = NOW();
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: audit_goal_post_lock_change (trigger function)
-- Writes to audit_log whenever a locked goal is updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_goal_post_lock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only audit if the goal was already locked (locked_at was set before this update)
  IF OLD.locked_at IS NOT NULL THEN
    INSERT INTO public.audit_log (
      entity_type,
      entity_id,
      action,
      changed_by,
      before_state,
      after_state,
      reason,
      created_at
    ) VALUES (
      'goal',
      NEW.id,
      'post_lock_update',
      auth.uid(),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'Post-lock modification recorded by trigger',
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGER: goals_post_lock_audit
-- Fires after UPDATE on goals if locked_at is set
-- ============================================================
DROP TRIGGER IF EXISTS goals_post_lock_audit ON public.goals;
CREATE TRIGGER goals_post_lock_audit
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  WHEN (OLD.locked_at IS NOT NULL)
  EXECUTE FUNCTION public.audit_goal_post_lock_change();

-- ============================================================
-- FUNCTION: set_goal_updated_at (trigger function)
-- Auto-sets updated_at on every goal UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_goal_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGER: goals_set_updated_at
-- ============================================================
DROP TRIGGER IF EXISTS goals_set_updated_at ON public.goals;
CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_goal_updated_at();

-- ============================================================
-- FUNCTION: validate_goal_weightage
-- Ensures an employee's total weightage stays <= 100 on insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_goal_weightage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weightage), 0)
  INTO v_total
  FROM public.goals
  WHERE employee_id = NEW.employee_id
    AND cycle_id = NEW.cycle_id
    AND id != NEW.id
    AND status != 'returned';

  IF (v_total + NEW.weightage) > 100 THEN
    RAISE EXCEPTION 'Total goal weightage would exceed 100%%. Current total: %, Adding: %',
      v_total, NEW.weightage;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goals_validate_weightage ON public.goals;
CREATE TRIGGER goals_validate_weightage
  BEFORE INSERT OR UPDATE OF weightage ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_goal_weightage();
