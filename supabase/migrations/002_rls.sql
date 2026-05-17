-- ============================================================
-- AtomQuest Portal — Migration 002: Row Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: get caller role without recursion
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_manager_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT manager_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Employees: see only themselves
-- Managers: see themselves + their direct reports
-- Admins: see all

CREATE POLICY "users_select_self" ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (public.get_my_role() = 'manager' AND manager_id = auth.uid())
  );

CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "users_update_self_or_admin" ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- GOAL CYCLES TABLE POLICIES
-- ============================================================

-- Everyone can read cycles; only admins can write
CREATE POLICY "cycles_select_all_authenticated" ON public.goal_cycles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cycles_insert_admin" ON public.goal_cycles
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "cycles_update_admin" ON public.goal_cycles
  FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "cycles_delete_admin" ON public.goal_cycles
  FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- GOALS TABLE POLICIES
-- ============================================================

-- Employees: own goals only
-- Managers: own + their direct reports' goals
-- Admins: all goals

CREATE POLICY "goals_select" ON public.goals
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'manager'
      AND employee_id IN (
        SELECT id FROM public.users WHERE manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "goals_insert_employee" ON public.goals
  FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

CREATE POLICY "goals_update" ON public.goals
  FOR UPDATE
  USING (
    employee_id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'manager'
      AND employee_id IN (
        SELECT id FROM public.users WHERE manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "goals_delete_owner_or_admin" ON public.goals
  FOR DELETE
  USING (
    (employee_id = auth.uid() AND status = 'draft')
    OR public.get_my_role() = 'admin'
  );

-- ============================================================
-- CHECKINS TABLE POLICIES
-- ============================================================

-- Employees: checkins for their goals
-- Managers: checkins for their team's goals
-- Admins: all

CREATE POLICY "checkins_select" ON public.checkins
  FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR goal_id IN (
      SELECT id FROM public.goals WHERE employee_id = auth.uid()
    )
    OR (
      public.get_my_role() = 'manager'
      AND goal_id IN (
        SELECT g.id FROM public.goals g
        JOIN public.users u ON g.employee_id = u.id
        WHERE u.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "checkins_insert" ON public.checkins
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'admin'
    OR goal_id IN (
      SELECT id FROM public.goals WHERE employee_id = auth.uid()
    )
  );

CREATE POLICY "checkins_update" ON public.checkins
  FOR UPDATE
  USING (
    public.get_my_role() = 'admin'
    OR goal_id IN (
      SELECT id FROM public.goals WHERE employee_id = auth.uid()
    )
  );

-- ============================================================
-- CHECKIN COMMENTS TABLE POLICIES
-- ============================================================

-- Employees: read comments on their checkins
-- Managers: read + write comments on their team's checkins
-- Admins: all

CREATE POLICY "checkin_comments_select" ON public.checkin_comments
  FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR manager_id = auth.uid()
    OR checkin_id IN (
      SELECT c.id FROM public.checkins c
      JOIN public.goals g ON c.goal_id = g.id
      WHERE g.employee_id = auth.uid()
    )
    OR (
      public.get_my_role() = 'manager'
      AND checkin_id IN (
        SELECT c.id FROM public.checkins c
        JOIN public.goals g ON c.goal_id = g.id
        JOIN public.users u ON g.employee_id = u.id
        WHERE u.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "checkin_comments_insert_manager" ON public.checkin_comments
  FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND (
      public.get_my_role() = 'manager'
      OR public.get_my_role() = 'admin'
    )
  );

CREATE POLICY "checkin_comments_update_own" ON public.checkin_comments
  FOR UPDATE
  USING (manager_id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "checkin_comments_delete_own" ON public.checkin_comments
  FOR DELETE
  USING (manager_id = auth.uid() OR public.get_my_role() = 'admin');

-- ============================================================
-- AUDIT LOG TABLE POLICIES
-- ============================================================

-- Admins: all
-- Managers: audit for their team
-- Employees: audit for their own entities

CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR changed_by = auth.uid()
    OR (
      public.get_my_role() = 'manager'
      AND entity_id IN (
        SELECT id FROM public.goals WHERE employee_id IN (
          SELECT id FROM public.users WHERE manager_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "audit_log_insert_system" ON public.audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- ESCALATIONS TABLE POLICIES
-- ============================================================

-- Admins: all
-- Managers: escalations for their team
-- Employees: cannot see escalations directly

CREATE POLICY "escalations_select" ON public.escalations
  FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'manager'
      AND target_user_id IN (
        SELECT id FROM public.users WHERE manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "escalations_insert_system" ON public.escalations
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'admin'
    OR public.get_my_role() = 'manager'
  );

CREATE POLICY "escalations_update_admin" ON public.escalations
  FOR UPDATE
  USING (public.get_my_role() = 'admin');
