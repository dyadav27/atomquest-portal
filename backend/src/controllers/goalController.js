'use strict';

const { supabase } = require('../config/supabase');
const { sendGoalSubmitted, sendGoalApproved, sendGoalReturned } = require('../services/emailService');
const { sendGoalSubmittedCard } = require('../services/teamsService');
const { createError } = require('../middleware/errorHandler');

const MAX_GOALS = 8;
const MIN_WEIGHTAGE = 10;
const REQUIRED_TOTAL_WEIGHTAGE = 100;

// ============================================================
// GET /api/goals/my  — goals for current user + active cycle
// ============================================================
async function getMyGoals(req, res, next) {
  try {
    const { data: cycle } = await supabase
      .from('goal_cycles')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!cycle) {
      return res.json({ goals: [], activeCycleId: null });
    }

    const { data: goals, error } = await supabase
      .from('goals')
      .select(`
        *,
        checkins (*),
        employee:users!goals_employee_id_fkey (id, name, email, department)
      `)
      .eq('employee_id', req.user.id)
      .eq('cycle_id', cycle.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ goals: goals || [], activeCycleId: cycle.id });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/goals/team  — all goals for manager's direct reports
// ============================================================
async function getTeamGoals(req, res, next) {
  try {
    const { cycleId } = req.query;

    let cycleFilter = cycleId;
    if (!cycleFilter) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      cycleFilter = cycle?.id;
    }

    if (!cycleFilter) return res.json({ goals: [] });

    // Get direct reports
    const { data: reports } = await supabase
      .from('users')
      .select('id')
      .eq('manager_id', req.user.id);

    const reportIds = (reports || []).map((r) => r.id);
    if (reportIds.length === 0) return res.json({ goals: [] });

    const { data: goals, error } = await supabase
      .from('goals')
      .select(`
        *,
        checkins (*),
        employee:users!goals_employee_id_fkey (id, name, email, department)
      `)
      .in('employee_id', reportIds)
      .eq('cycle_id', cycleFilter)
      .order('employee_id')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ goals: goals || [] });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/goals  — create a new goal
// ============================================================
async function createGoal(req, res, next) {
  try {
    const {
      cycle_id,
      thrust_area,
      title,
      description,
      uom_type,
      uom_direction,
      target,
      weightage,
    } = req.body;

    // Validation
    if (!thrust_area || !title || !uom_type || !uom_direction || target === undefined || !weightage) {
      throw createError(400, 'Missing required fields: thrust_area, title, uom_type, uom_direction, target, weightage');
    }

    const w = Number(weightage);
    if (w < MIN_WEIGHTAGE || w > 100) {
      throw createError(400, `Weightage must be between ${MIN_WEIGHTAGE} and 100. Got: ${w}`);
    }

    // Get active cycle if not provided
    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) throw createError(400, 'No active goal cycle found');

    // Check goal count limit
    const { count } = await supabase
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', req.user.id)
      .eq('cycle_id', activeCycleId)
      .neq('status', 'returned');

    if (count >= MAX_GOALS) {
      throw createError(400, `Maximum ${MAX_GOALS} goals allowed per cycle. You currently have ${count}.`);
    }

    // Check total weightage won't exceed 100
    const { data: existingGoals } = await supabase
      .from('goals')
      .select('weightage')
      .eq('employee_id', req.user.id)
      .eq('cycle_id', activeCycleId)
      .neq('status', 'returned');

    const currentTotal = (existingGoals || []).reduce((s, g) => s + Number(g.weightage), 0);
    if (currentTotal + w > REQUIRED_TOTAL_WEIGHTAGE) {
      throw createError(
        400,
        `Adding this goal would exceed 100% total weightage. Current: ${currentTotal}%, Adding: ${w}%, Max: 100%`
      );
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        employee_id: req.user.id,
        cycle_id: activeCycleId,
        thrust_area,
        title,
        description: description || null,
        uom_type,
        uom_direction,
        target: Number(target),
        weightage: w,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// PUT /api/goals/:id  — update a goal
// ============================================================
async function updateGoal(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch current goal
    const { data: existing, error: fetchErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) throw createError(404, 'Goal not found');

    // Ownership check
    if (existing.employee_id !== req.user.id && req.user.role !== 'admin') {
      throw createError(403, 'You can only edit your own goals');
    }

    // Reject edits to locked goals (unless admin)
    if (existing.status === 'locked' && req.user.role !== 'admin') {
      throw createError(400, 'Locked goals cannot be edited. Contact an administrator to unlock.');
    }

    const allowedFields = ['thrust_area', 'title', 'description', 'uom_type', 'uom_direction', 'target', 'weightage'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.weightage !== undefined) {
      const w = Number(updates.weightage);
      if (w < MIN_WEIGHTAGE || w > 100) {
        throw createError(400, `Weightage must be between ${MIN_WEIGHTAGE} and 100`);
      }

      // Validate total won't exceed 100
      const { data: otherGoals } = await supabase
        .from('goals')
        .select('weightage')
        .eq('employee_id', existing.employee_id)
        .eq('cycle_id', existing.cycle_id)
        .neq('id', id)
        .neq('status', 'returned');

      const othersTotal = (otherGoals || []).reduce((s, g) => s + Number(g.weightage), 0);
      if (othersTotal + w > REQUIRED_TOTAL_WEIGHTAGE) {
        throw createError(
          400,
          `Total weightage would exceed 100%. Others: ${othersTotal}%, This: ${w}%`
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      throw createError(400, 'No valid fields to update');
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ goal });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/goals/submit  — submit entire goal sheet for approval
// ============================================================
async function submitGoal(req, res, next) {
  try {
    const { cycle_id } = req.body;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) throw createError(400, 'No active cycle found');

    // Get all draft/returned goals
    const { data: goals, error: fetchErr } = await supabase
      .from('goals')
      .select('id, weightage, status, title')
      .eq('employee_id', req.user.id)
      .eq('cycle_id', activeCycleId)
      .in('status', ['draft', 'returned']);

    if (fetchErr) throw fetchErr;
    if (!goals || goals.length === 0) {
      throw createError(400, 'No draft goals found to submit');
    }

    // Validate total weightage = 100
    const totalWeightage = goals.reduce((s, g) => s + Number(g.weightage), 0);
    if (totalWeightage !== REQUIRED_TOTAL_WEIGHTAGE) {
      throw createError(
        400,
        `Total weightage must equal exactly 100%. Current total: ${totalWeightage}%`
      );
    }

    // Update all goals to pending
    const goalIds = goals.map((g) => g.id);
    const { error: updateErr } = await supabase
      .from('goals')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .in('id', goalIds);

    if (updateErr) throw updateErr;

    // Send email + Teams notification to manager
    if (req.user.manager_id) {
      const { data: manager } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', req.user.manager_id)
        .single();

      if (manager) {
        await sendGoalSubmitted(manager.email, req.user.name, goals.length);
        await sendGoalSubmittedCard(
          req.user.name,
          goals.length,
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/manager/approvals`
        );
      }
    }

    res.json({ message: `${goals.length} goal(s) submitted for approval`, count: goals.length });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/goals/:id/approve  — manager approves a goal sheet
// ============================================================
async function approveGoal(req, res, next) {
  try {
    const { id } = req.params;

    const { data: goal, error: fetchErr } = await supabase
      .from('goals')
      .select(`*, employee:users!goals_employee_id_fkey (id, email, name, manager_id)`)
      .eq('id', id)
      .single();

    if (fetchErr || !goal) throw createError(404, 'Goal not found');

    // Verify caller is the employee's manager or an admin
    if (req.user.role !== 'admin' && goal.employee?.manager_id !== req.user.id) {
      throw createError(403, 'Only the employee\'s direct manager can approve goals');
    }

    if (goal.status !== 'pending') {
      throw createError(400, `Goal cannot be approved — current status: ${goal.status}`);
    }

    const { data: updated, error } = await supabase
      .from('goals')
      .update({
        status: 'locked',
        locked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify employee
    if (goal.employee?.email) {
      await sendGoalApproved(goal.employee.email, req.user.name);
    }

    // Write audit log
    await supabase.from('audit_log').insert({
      entity_type: 'goal',
      entity_id: id,
      action: 'approved',
      changed_by: req.user.id,
      before_state: { status: goal.status },
      after_state: { status: 'locked', locked_at: updated.locked_at },
    });

    res.json({ goal: updated, message: 'Goal approved and locked successfully' });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/goals/:id/return  — manager returns a goal with feedback
// ============================================================
async function returnGoal(req, res, next) {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || feedback.trim().length < 10) {
      throw createError(400, 'Feedback is required (minimum 10 characters) when returning a goal');
    }

    const { data: goal, error: fetchErr } = await supabase
      .from('goals')
      .select(`*, employee:users!goals_employee_id_fkey (id, email, name, manager_id)`)
      .eq('id', id)
      .single();

    if (fetchErr || !goal) throw createError(404, 'Goal not found');

    if (req.user.role !== 'admin' && goal.employee?.manager_id !== req.user.id) {
      throw createError(403, 'Only the employee\'s direct manager can return goals');
    }

    if (!['pending', 'approved'].includes(goal.status)) {
      throw createError(400, `Goal cannot be returned — current status: ${goal.status}`);
    }

    const { data: updated, error } = await supabase
      .from('goals')
      .update({ status: 'returned' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Write audit log with feedback as reason
    await supabase.from('audit_log').insert({
      entity_type: 'goal',
      entity_id: id,
      action: 'returned',
      changed_by: req.user.id,
      before_state: { status: goal.status },
      after_state: { status: 'returned' },
      reason: feedback,
    });

    // Notify employee
    if (goal.employee?.email) {
      await sendGoalReturned(goal.employee.email, req.user.name, feedback);
    }

    res.json({ goal: updated, message: 'Goal returned to employee for revision' });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/goals/:id/unlock  — admin unlocks a locked goal
// ============================================================
async function unlockGoal(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      throw createError(400, 'A reason is required (minimum 10 characters) to unlock a goal');
    }

    const { data: goal, error: fetchErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !goal) throw createError(404, 'Goal not found');

    if (goal.status !== 'locked') {
      throw createError(400, `Goal is not locked — current status: ${goal.status}`);
    }

    const { data: updated, error } = await supabase
      .from('goals')
      .update({ status: 'approved', locked_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Write audit log
    await supabase.from('audit_log').insert({
      entity_type: 'goal',
      entity_id: id,
      action: 'unlock',
      changed_by: req.user.id,
      before_state: { status: 'locked', locked_at: goal.locked_at },
      after_state: { status: 'approved', locked_at: null },
      reason,
    });

    res.json({ goal: updated, message: 'Goal unlocked successfully' });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// DELETE /api/goals/:id  — delete a draft goal
// ============================================================
async function deleteGoal(req, res, next) {
  try {
    const { id } = req.params;

    const { data: goal } = await supabase
      .from('goals')
      .select('employee_id, status')
      .eq('id', id)
      .single();

    if (!goal) throw createError(404, 'Goal not found');

    if (goal.employee_id !== req.user.id && req.user.role !== 'admin') {
      throw createError(403, 'You can only delete your own goals');
    }

    if (goal.status !== 'draft' && req.user.role !== 'admin') {
      throw createError(400, 'Only draft goals can be deleted');
    }

    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Goal deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyGoals,
  getTeamGoals,
  createGoal,
  updateGoal,
  submitGoal,
  approveGoal,
  returnGoal,
  unlockGoal,
  deleteGoal,
};
