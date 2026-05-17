-- ============================================================
-- AtomQuest Portal — Migration 004: Seed Data
-- ============================================================
-- Fixed UUIDs for reproducible demo data

-- Auth users must exist first; these inserts assume you have created
-- the corresponding auth.users entries via Supabase dashboard or CLI.
-- The UUIDs below are used consistently throughout the seed.

-- Relax the weightage constraint to allow 0 for shared goals
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_weightage_check;
ALTER TABLE public.goals ADD CONSTRAINT goals_weightage_check CHECK (weightage >= 0 AND weightage <= 100);

DO $$
DECLARE
  -- ============================================================
  -- ⚠️ PASTE YOUR REAL SUPABASE AUTH UUIDs HERE
  -- ============================================================
  -- You must paste the UUIDs from your Authentication Dashboard here!
  -- If you don't have an Admin user, you can just paste the Manager's UUID twice.
  
  v_admin_id   UUID := '821fb4f7-4785-489a-85ba-8f1d4fc70754';
  v_manager_id UUID := '2678bbc6-25d7-45a7-9c49-31db59a3d9a5';
  v_employee_id UUID := '2a37a75b-e0aa-43d6-8235-7041e65574f7';
  
  -- Fixed cycle ID
  v_cycle_id   UUID := 'c1000000-0000-0000-0000-000000000001';

  -- Goal UUIDs
  v_goal1_id   UUID := 'b1000000-0000-0000-0000-000000000001';
  v_goal2_id   UUID := 'b1000000-0000-0000-0000-000000000002';
  v_goal3_id   UUID := 'b1000000-0000-0000-0000-000000000003';
  v_goal4_id   UUID := 'b1000000-0000-0000-0000-000000000004';
  v_shared1_id UUID := 'b1000000-0000-0000-0000-000000000005';
  v_shared2_id UUID := 'b1000000-0000-0000-0000-000000000006';

  -- Checkin UUIDs
  v_checkin1_id UUID := 'd1000000-0000-0000-0000-000000000001';
  v_checkin2_id UUID := 'd1000000-0000-0000-0000-000000000002';
  v_checkin3_id UUID := 'd1000000-0000-0000-0000-000000000003';
  v_checkin4_id UUID := 'd1000000-0000-0000-0000-000000000004';
  v_checkin5_id UUID := 'd1000000-0000-0000-0000-000000000005';

  -- Comment UUIDs
  v_comment1_id UUID := 'e1000000-0000-0000-0000-000000000001';
  v_comment2_id UUID := 'e1000000-0000-0000-0000-000000000002';
  v_comment3_id UUID := 'e1000000-0000-0000-0000-000000000003';

BEGIN

  -- ============================================================
  -- USERS (Links your Auth Users to the App Roles)
  -- ============================================================
  INSERT INTO public.users (id, name, email, role, department, azure_oid) VALUES
    (v_admin_id,    'Admin User',     'admin@atomquest.com',    'admin',    'IT',           'azure-oid-admin-001'),
    (v_manager_id,  'Priya Sharma',   'priya@atomquest.com',    'manager',  'Engineering',  'azure-oid-mgr-002'),
    (v_employee_id, 'Rahul Mehta',    'da0236969@gmail.com',    'employee', 'Engineering',  'azure-oid-emp-003')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

  -- Set Priya's manager to Rahul
  UPDATE public.users SET manager_id = v_manager_id WHERE id = v_employee_id;

  -- ============================================================
  -- GOAL CYCLE — FY 2025-26 (Q1 currently open as of May 2026)
  -- ============================================================
  INSERT INTO public.goal_cycles (
    id, name,
    goal_setting_opens,
    q1_opens, q1_closes,
    q2_opens, q2_closes,
    q3_opens, q3_closes,
    q4_opens, q4_closes,
    is_active
  ) VALUES (
    v_cycle_id, 'FY 2025-26',
    '2025-04-01',
    '2025-04-01', '2025-06-30',
    '2025-07-01', '2025-09-30',
    '2025-10-01', '2025-12-31',
    '2026-01-01', '2026-03-31',
    TRUE
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- GOALS for Priya Sharma (total weightage = 100)
  -- ============================================================

  -- Goal 1: Approved (locked) — Revenue Growth — numeric/max
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, locked_at,
    dna_score, created_at, updated_at
  ) VALUES (
    v_goal1_id, v_employee_id, v_cycle_id,
    'Revenue',
    'Increase Q1 Recurring Revenue',
    'Drive recurring revenue growth through upsell campaigns and retention programs.',
    'numeric', 'max', 500000, 30, 'locked',
    FALSE, NOW() - INTERVAL '30 days',
    '{"specificity": 85, "ambition": 78, "alignment": 90, "risk": 70, "total": 81, "feedback": "Consider adding a specific customer segment target for better measurability."}'::jsonb,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- Goal 2: Approved (locked) — Product Quality — percent/min (reduce defect rate)
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, locked_at,
    dna_score, created_at, updated_at
  ) VALUES (
    v_goal2_id, v_employee_id, v_cycle_id,
    'Quality',
    'Reduce Production Defect Rate',
    'Achieve a production defect rate below 2% through improved testing and code review processes.',
    'percent', 'min', 2, 25, 'locked',
    FALSE, NOW() - INTERVAL '30 days',
    '{"specificity": 92, "ambition": 80, "alignment": 88, "risk": 60, "total": 80, "feedback": "Strong goal — ensure baseline measurement is clearly documented."}'::jsonb,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- Goal 3: Pending (submitted, awaiting approval) — Learning — numeric/max
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, created_at, updated_at
  ) VALUES (
    v_goal3_id, v_employee_id, v_cycle_id,
    'Learning & Development',
    'Complete 3 Professional Certifications',
    'Achieve AWS Solutions Architect, Google Cloud Professional, and Kubernetes certifications.',
    'numeric', 'max', 3, 20, 'pending',
    FALSE,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- Goal 4: Approved (locked) — Zero incidents — zero/zero
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, locked_at,
    dna_score, created_at, updated_at
  ) VALUES (
    v_goal4_id, v_employee_id, v_cycle_id,
    'Operations',
    'Zero Critical P0 Incidents',
    'Maintain zero critical production incidents throughout the fiscal year.',
    'zero', 'zero', 0, 25, 'locked',
    FALSE, NOW() - INTERVAL '30 days',
    '{"specificity": 95, "ambition": 75, "alignment": 92, "risk": 50, "total": 78, "feedback": "Excellent binary goal — pair with an incident response time metric for richer tracking."}'::jsonb,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- SHARED GOALS (pushed by admin to Priya)
  -- ============================================================

  -- Shared Goal 1: Department OKR — Revenue (shared from goal1)
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, shared_from_id, primary_owner_id, locked_at,
    created_at, updated_at
  ) VALUES (
    v_shared1_id, v_employee_id, v_cycle_id,
    'Revenue',
    '[Shared] Engineering Team Revenue Contribution',
    'Shared departmental revenue goal. Progress tracked via primary owner Priya Sharma.',
    'numeric', 'max', 500000, 0, 'locked',
    TRUE, v_goal1_id, v_employee_id, NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- Shared Goal 2: Company OKR — Zero incidents shared across engineering
  INSERT INTO public.goals (
    id, employee_id, cycle_id, thrust_area, title, description,
    uom_type, uom_direction, target, weightage, status,
    is_shared, shared_from_id, primary_owner_id, locked_at,
    created_at, updated_at
  ) VALUES (
    v_shared2_id, v_employee_id, v_cycle_id,
    'Operations',
    '[Shared] Company-Wide Zero Incidents Initiative',
    'Shared company-wide operational excellence goal.',
    'zero', 'zero', 0, 0, 'locked',
    TRUE, v_goal4_id, v_employee_id, NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- CHECKINS (Q1 for locked goals — mixed scores including anomaly)
  -- ============================================================

  -- Checkin for Goal 1 (Revenue) — good score 84%
  INSERT INTO public.checkins (id, goal_id, quarter, planned, actual, status, score, submitted_at) VALUES
    (v_checkin1_id, v_goal1_id, 'q1', 420000, 420500, 'completed', 84.1, NOW() - INTERVAL '5 days')
  ON CONFLICT (goal_id, quarter) DO NOTHING;

  -- Checkin for Goal 2 (Quality/min) — defect rate 1.5% vs target 2% → score 100%
  INSERT INTO public.checkins (id, goal_id, quarter, planned, actual, status, score, submitted_at) VALUES
    (v_checkin2_id, v_goal2_id, 'q1', 2.0, 1.5, 'completed', 100, NOW() - INTERVAL '5 days')
  ON CONFLICT (goal_id, quarter) DO NOTHING;

  -- Checkin for Goal 4 (Zero incidents) — score 100%
  INSERT INTO public.checkins (id, goal_id, quarter, planned, actual, status, score, submitted_at) VALUES
    (v_checkin3_id, v_goal4_id, 'q1', 0, 0, 'completed', 100, NOW() - INTERVAL '5 days')
  ON CONFLICT (goal_id, quarter) DO NOTHING;

  -- ANOMALY checkin: Goal 2 also has a Q2 checkin showing suspicious jump from 5% → 92%
  -- This simulates the anomaly detection scenario
  -- First, a fake Q2 entry with suspiciously high score (Q2 not yet open but added for demo)
  -- We'll mark it with a very low prior (planned=5%) and actual=92
  -- Note: In real use, Q2 would only be submitted during Q2 window
  INSERT INTO public.checkins (id, goal_id, quarter, planned, actual, status, score, submitted_at) VALUES
    (v_checkin4_id, v_goal2_id, 'q2', 5, 92, 'completed', 92, NOW() - INTERVAL '1 day')
  ON CONFLICT (goal_id, quarter) DO NOTHING;

  -- Checkin for Shared Goal 1 (synced from Goal 1)
  INSERT INTO public.checkins (id, goal_id, quarter, planned, actual, status, score, submitted_at) VALUES
    (v_checkin5_id, v_shared1_id, 'q1', 420000, 420500, 'completed', 84.1, NOW() - INTERVAL '5 days')
  ON CONFLICT (goal_id, quarter) DO NOTHING;

  -- ============================================================
  -- CHECKIN COMMENTS from Rahul Mehta
  -- ============================================================

  INSERT INTO public.checkin_comments (id, checkin_id, manager_id, comment, ai_generated, created_at) VALUES
    (
      v_comment1_id, v_checkin1_id, v_manager_id,
      'Priya has done an excellent job hitting the Q1 revenue target almost exactly. The upsell campaigns were well-executed. Recommend maintaining current momentum and expanding the retention program in Q2.',
      FALSE, NOW() - INTERVAL '4 days'
    ),
    (
      v_comment2_id, v_checkin2_id, v_manager_id,
      'Outstanding quality improvement — defect rate of 1.5% is well below the 2% target. The additional code review process introduced in January is showing measurable results. Keep it up.',
      TRUE, NOW() - INTERVAL '4 days'
    ),
    (
      v_comment3_id, v_checkin3_id, v_manager_id,
      'Zero incidents maintained for the full quarter. Strong discipline in deployment practices. Suggest Priya document the runbooks for broader team knowledge sharing.',
      FALSE, NOW() - INTERVAL '4 days'
    )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- AUDIT LOG ENTRIES
  -- ============================================================

  INSERT INTO public.audit_log (id, entity_type, entity_id, action, changed_by, before_state, after_state, reason, created_at) VALUES
    -- 1. Admin unlocked a goal (post-submission edit)
    (
      'f1000000-0000-0000-0000-000000000001',
      'goal', v_goal1_id, 'unlock',
      v_admin_id,
      '{"status": "locked"}'::jsonb,
      '{"status": "approved"}'::jsonb,
      'Employee requested correction to target value after manager approval. Approved by HR.',
      NOW() - INTERVAL '15 days'
    ),
    -- 2. Post-lock edit: target was updated after unlock
    (
      'f1000000-0000-0000-0000-000000000002',
      'goal', v_goal1_id, 'post_lock_update',
      v_employee_id,
      '{"target": 480000, "status": "approved"}'::jsonb,
      '{"target": 500000, "status": "approved"}'::jsonb,
      'Corrected target from 480000 to 500000 after approval to match final Q1 plan.',
      NOW() - INTERVAL '14 days'
    ),
    -- 3. Admin pushed shared goal
    (
      'f1000000-0000-0000-0000-000000000003',
      'goal', v_shared1_id, 'admin_push_shared',
      v_admin_id,
      NULL,
      '{"is_shared": true, "shared_from_id": "b1000000-0000-0000-0000-000000000001"}'::jsonb,
      'Departmental revenue goal pushed to Engineering team by admin as shared goal.',
      NOW() - INTERVAL '28 days'
    )
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- ESCALATIONS
  -- ============================================================

  INSERT INTO public.escalations (id, rule_type, target_user_id, notified_ids, level, resolved, resolved_at, created_at) VALUES
    -- 1. Resolved escalation: goal_not_submitted, resolved after employee submitted
    (
      '71000000-0000-0000-0000-000000000001',
      'goal_not_submitted', v_employee_id,
      ARRAY[v_employee_id, v_manager_id]::UUID[],
      2, TRUE, NOW() - INTERVAL '20 days',
      NOW() - INTERVAL '25 days'
    ),
    -- 2. Active escalation: checkin_missed, level 2 pending (manager notified)
    (
      '71000000-0000-0000-0000-000000000002',
      'checkin_missed', v_employee_id,
      ARRAY[v_employee_id]::UUID[],
      2, FALSE, NULL,
      NOW() - INTERVAL '3 days'
    )
  ON CONFLICT (id) DO NOTHING;

END $$;
