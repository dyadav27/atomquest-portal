// ============================================================
// Shared types — import these in all components instead of
// re-declaring locally.
// ============================================================

export type UserRole = 'employee' | 'manager' | 'admin';

export type Page =
  | 'my-goals'
  | 'check-ins'
  | 'analytics'
  | 'reports'
  | 'team-dashboard'
  | 'approval-queue'
  | 'checkin-reviews'
  | 'admin-overview'
  | 'users-roles'
  | 'goal-cycles'
  | 'shared-goals'
  | 'audit-log'
  | 'escalations';

// Backend-aligned Goal type (matches DB schema exactly)
export interface Goal {
  id: string;
  employee_id: string;
  cycle_id: string;
  thrust_area: string;
  title: string;
  description?: string;
  uom_type: 'numeric' | 'percent' | 'timeline' | 'zero';
  uom_direction: 'min' | 'max' | 'timeline' | 'zero';
  target: number;
  weightage: number;
  status: 'draft' | 'pending' | 'approved' | 'locked' | 'returned';
  is_shared?: boolean;
  shared_from_id?: string;
  dna_score?: {
    specificity: number;
    ambition: number;
    alignment: number;
    risk: number;
    total: number;
    feedback?: string;
  };
  checkins?: Checkin[];
  created_at?: string;
  updated_at?: string;
}

export interface Checkin {
  id: string;
  goal_id: string;
  quarter: 'q1' | 'q2' | 'q3' | 'q4';
  planned?: number;
  actual?: number;
  timeline_deadline?: string;
  score?: number;
  status?: string;
  submitted_at?: string;
  comments?: CheckinComment[];
}

export interface CheckinComment {
  id: string;
  checkin_id: string;
  author_id: string;
  comment: string;
  ai_generated?: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  manager_id?: string;
}

export interface Escalation {
  id: string;
  target_user_id: string;
  rule_type: string;
  level: number;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
  target_user?: TeamMember;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_by: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  reason?: string;
  created_at: string;
  actor?: TeamMember;
}
