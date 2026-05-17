'use strict';

const { supabase } = require('../config/supabase');
const { sendEscalationAlert } = require('./emailService');
const { sendEscalationCard } = require('./teamsService');

const DAYS_1 = parseInt(process.env.ESCALATION_DAYS_1, 10) || 3;
const DAYS_2 = parseInt(process.env.ESCALATION_DAYS_2, 10) || 6;
const DAYS_3 = parseInt(process.env.ESCALATION_DAYS_3, 10) || 9;

/**
 * Helper: get how many days ago a date was.
 */
function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Helper: get the HR user emails (all admin users).
 */
async function getAdminEmails() {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'admin');
  return (data || []).map((u) => u.email);
}

/**
 * Helper: get manager email for a user.
 */
async function getManagerEmail(managerId) {
  if (!managerId) return null;
  const { data } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', managerId)
    .single();
  return data || null;
}

/**
 * Deduplication: check if an open escalation for this user+rule+level already exists.
 */
async function escalationExists(targetUserId, ruleType, level) {
  const { data } = await supabase
    .from('escalations')
    .select('id')
    .eq('target_user_id', targetUserId)
    .eq('rule_type', ruleType)
    .eq('level', level)
    .eq('resolved', false)
    .limit(1);
  return data && data.length > 0;
}

/**
 * Create an escalation record and send notifications.
 */
async function createEscalation(targetUser, ruleType, level, notifyEmails) {
  // Dedup check
  if (await escalationExists(targetUser.id, ruleType, level)) {
    return; // already escalated at this level
  }

  const { error } = await supabase.from('escalations').insert({
    rule_type: ruleType,
    target_user_id: targetUser.id,
    notified_ids: [targetUser.id],
    level,
    resolved: false,
  });

  if (error) {
    console.error(`[EscalationEngine] Failed to insert escalation: ${error.message}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Send emails to all recipients
  for (const email of notifyEmails) {
    await sendEscalationAlert(email, targetUser.name, ruleType, level);
  }

  // Send Teams card
  await sendEscalationCard(
    targetUser.name,
    ruleType,
    `${frontendUrl}/admin/escalations`
  );

  console.log(
    `[EscalationEngine] Escalation created: user=${targetUser.name}, rule=${ruleType}, level=${level}`
  );
}

// ============================================================
// RULE 1: goal_not_submitted
// Users in active cycle who have no goals with status != 'draft'
// ============================================================
async function ruleGoalNotSubmitted(activeCycle) {
  // All employees
  const { data: employees } = await supabase
    .from('users')
    .select('id, name, email, manager_id, role')
    .eq('role', 'employee');

  if (!employees || employees.length === 0) return;

  const daysSinceCycleOpen = daysSince(activeCycle.goal_setting_opens);

  for (const emp of employees) {
    // Check if they have any non-draft goals
    const { data: submittedGoals } = await supabase
      .from('goals')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('cycle_id', activeCycle.id)
      .neq('status', 'draft')
      .limit(1);

    if (submittedGoals && submittedGoals.length > 0) continue; // already submitted

    const manager = emp.manager_id ? await getManagerEmail(emp.manager_id) : null;
    const adminEmails = await getAdminEmails();

    if (daysSinceCycleOpen >= DAYS_3) {
      // Level 3: notify HR
      await createEscalation(emp, 'goal_not_submitted', 3, adminEmails);
    } else if (daysSinceCycleOpen >= DAYS_2) {
      // Level 2: notify manager
      const recipients = manager ? [manager.email] : adminEmails;
      await createEscalation(emp, 'goal_not_submitted', 2, recipients);
    } else if (daysSinceCycleOpen >= DAYS_1) {
      // Level 1: notify employee themselves
      await createEscalation(emp, 'goal_not_submitted', 1, [emp.email]);
    }
  }
}

// ============================================================
// RULE 2: approval_delayed
// Goals with status='pending' submitted > N days ago
// ============================================================
async function ruleApprovalDelayed() {
  const { data: pendingGoals } = await supabase
    .from('goals')
    .select(`
      id, title, updated_at,
      employee:users!goals_employee_id_fkey (id, name, email, manager_id)
    `)
    .eq('status', 'pending');

  if (!pendingGoals || pendingGoals.length === 0) return;

  for (const goal of pendingGoals) {
    const emp = goal.employee;
    if (!emp) continue;

    const daysPending = daysSince(goal.updated_at);
    const manager = emp.manager_id ? await getManagerEmail(emp.manager_id) : null;
    const adminEmails = await getAdminEmails();

    // Find skip-level manager (manager's manager)
    let skipLevelEmail = null;
    if (manager) {
      const { data: managerProfile } = await supabase
        .from('users')
        .select('manager_id')
        .eq('id', emp.manager_id)
        .single();

      if (managerProfile?.manager_id) {
        const { data: skipManager } = await supabase
          .from('users')
          .select('email')
          .eq('id', managerProfile.manager_id)
          .single();
        if (skipManager) skipLevelEmail = skipManager.email;
      }
    }

    if (daysPending >= DAYS_3) {
      const recipients = skipLevelEmail ? [skipLevelEmail, ...adminEmails] : adminEmails;
      await createEscalation(emp, 'approval_delayed', 3, recipients);
    } else if (daysPending >= DAYS_2) {
      const recipients = skipLevelEmail ? [skipLevelEmail] : adminEmails;
      await createEscalation(emp, 'approval_delayed', 2, recipients);
    } else if (daysPending >= DAYS_1) {
      const recipients = manager ? [manager.email] : adminEmails;
      await createEscalation(emp, 'approval_delayed', 1, recipients);
    }
  }
}

// ============================================================
// RULE 3: checkin_missed
// Employees with no checkin for the current open quarter
// ============================================================
async function ruleCheckinMissed(activeCycle) {
  // Determine current open quarter
  const today = new Date();
  const quarters = ['q1', 'q2', 'q3', 'q4'];
  let currentQuarter = null;

  for (const q of quarters) {
    const opens = new Date(activeCycle[`${q}_opens`]);
    const closes = new Date(activeCycle[`${q}_closes`]);
    if (today >= opens && today <= closes) {
      currentQuarter = q;
      break;
    }
  }

  if (!currentQuarter) return; // no quarter currently open

  // Find the close date of current quarter
  const closeDate = new Date(activeCycle[`${currentQuarter}_closes`]);
  const daysUntilClose = Math.floor((closeDate - today) / (1000 * 60 * 60 * 24));

  // Only escalate if we're within the last DAYS_3 days of the quarter window
  if (daysUntilClose > DAYS_3) return;

  // Find employees with locked goals but no checkin for this quarter
  const { data: lockedGoals } = await supabase
    .from('goals')
    .select(`
      id, employee_id,
      employee:users!goals_employee_id_fkey (id, name, email, manager_id)
    `)
    .eq('cycle_id', activeCycle.id)
    .eq('status', 'locked');

  if (!lockedGoals || lockedGoals.length === 0) return;

  // Group by employee
  const employeeMap = new Map();
  for (const goal of lockedGoals) {
    if (!goal.employee) continue;
    if (!employeeMap.has(goal.employee_id)) {
      employeeMap.set(goal.employee_id, { employee: goal.employee, goalIds: [] });
    }
    employeeMap.get(goal.employee_id).goalIds.push(goal.id);
  }

  for (const [employeeId, { employee, goalIds }] of employeeMap) {
    // Check if any checkin exists for this quarter for any of their goals
    const { data: checkins } = await supabase
      .from('checkins')
      .select('id')
      .in('goal_id', goalIds)
      .eq('quarter', currentQuarter)
      .not('submitted_at', 'is', null)
      .limit(1);

    if (checkins && checkins.length > 0) continue; // checkin submitted

    const manager = employee.manager_id ? await getManagerEmail(employee.manager_id) : null;
    const adminEmails = await getAdminEmails();

    const daysElapsed = DAYS_3 - daysUntilClose;

    if (daysElapsed >= DAYS_3) {
      await createEscalation(employee, 'checkin_missed', 3, adminEmails);
    } else if (daysElapsed >= DAYS_2) {
      const recipients = manager ? [manager.email] : adminEmails;
      await createEscalation(employee, 'checkin_missed', 2, recipients);
    } else {
      await createEscalation(employee, 'checkin_missed', 1, [employee.email]);
    }
  }
}

// ============================================================
// MAIN: Run all escalation rules
// ============================================================
async function runAllRules() {
  console.log('[EscalationEngine] Running all escalation rules...');

  try {
    // Get active cycle
    const { data: activeCycle, error } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !activeCycle) {
      console.log('[EscalationEngine] No active cycle found — skipping escalation run');
      return;
    }

    await ruleGoalNotSubmitted(activeCycle);
    await ruleApprovalDelayed();
    await ruleCheckinMissed(activeCycle);

    console.log('[EscalationEngine] All rules completed');
  } catch (err) {
    console.error('[EscalationEngine] Unexpected error during rule run:', err.message);
  }
}

module.exports = { runAllRules };
