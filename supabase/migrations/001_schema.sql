-- ============================================================
-- AtomQuest Portal — Migration 001: Schema
-- ============================================================

-- ENUMS
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');
CREATE TYPE uom_type AS ENUM ('numeric', 'percent', 'timeline', 'zero');
CREATE TYPE uom_direction AS ENUM ('min', 'max', 'timeline', 'zero');
CREATE TYPE goal_status AS ENUM ('draft', 'pending', 'approved', 'locked', 'returned');
CREATE TYPE quarter AS ENUM ('q1', 'q2', 'q3', 'q4');
CREATE TYPE checkin_status AS ENUM ('not_started', 'on_track', 'completed');
CREATE TYPE escalation_rule AS ENUM ('goal_not_submitted', 'approval_delayed', 'checkin_missed');

-- USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  manager_id UUID REFERENCES public.users(id),
  department TEXT,
  azure_oid TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GOAL CYCLES
CREATE TABLE public.goal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  goal_setting_opens DATE NOT NULL,
  q1_opens DATE NOT NULL,
  q1_closes DATE NOT NULL,
  q2_opens DATE NOT NULL,
  q2_closes DATE NOT NULL,
  q3_opens DATE NOT NULL,
  q3_closes DATE NOT NULL,
  q4_opens DATE NOT NULL,
  q4_closes DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id),
  cycle_id UUID NOT NULL REFERENCES public.goal_cycles(id),
  thrust_area TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  uom_type uom_type NOT NULL,
  uom_direction uom_direction NOT NULL,
  target NUMERIC NOT NULL,
  weightage NUMERIC NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
  status goal_status NOT NULL DEFAULT 'draft',
  is_shared BOOLEAN DEFAULT FALSE,
  shared_from_id UUID REFERENCES public.goals(id),
  primary_owner_id UUID REFERENCES public.users(id),
  locked_at TIMESTAMPTZ,
  dna_score JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECKINS
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id),
  quarter quarter NOT NULL,
  planned NUMERIC,
  actual NUMERIC,
  status checkin_status DEFAULT 'not_started',
  score NUMERIC,
  submitted_at TIMESTAMPTZ,
  UNIQUE(goal_id, quarter)
);

-- CHECKIN COMMENTS
CREATE TABLE public.checkin_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES public.checkins(id),
  manager_id UUID NOT NULL REFERENCES public.users(id),
  comment TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ESCALATIONS
CREATE TABLE public.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type escalation_rule NOT NULL,
  target_user_id UUID NOT NULL REFERENCES public.users(id),
  notified_ids UUID[] DEFAULT '{}',
  level INTEGER DEFAULT 1,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_goals_employee_id ON public.goals(employee_id);
CREATE INDEX idx_goals_cycle_id ON public.goals(cycle_id);
CREATE INDEX idx_goals_status ON public.goals(status);
CREATE INDEX idx_checkins_goal_id ON public.checkins(goal_id);
CREATE INDEX idx_checkins_quarter ON public.checkins(quarter);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_escalations_target ON public.escalations(target_user_id);
CREATE INDEX idx_escalations_resolved ON public.escalations(resolved);
CREATE INDEX idx_users_manager_id ON public.users(manager_id);
