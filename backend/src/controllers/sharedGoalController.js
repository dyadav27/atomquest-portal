'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// POST /api/shared-goals/push  — admin pushes shared goal to employees
// ============================================================
async function pushSharedGoal(req, res, next) {
  try {
    const {
      source_goal_id,
      employee_ids,
      cycle_id,
      thrust_area,
      title,
      description,
      uom_type,
      uom_direction,
      target,
    } = req.body;

    if (!source_goal_id || !employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      throw createError(400, 'source_goal_id and employee_ids[] are required');
    }

    // Validate source goal
    const { data: sourceGoal, error: srcErr } = await supabase
      .from('goals')
      .select('*')
      .eq('id', source_goal_id)
      .single();

    if (srcErr || !sourceGoal) throw createError(404, 'Source goal not found');

    let activeCycleId = cycle_id || sourceGoal.cycle_id;

    // Create shared goal copies for each employee
    const inserts = employee_ids.map((empId) => ({
      employee_id: empId,
      cycle_id: activeCycleId,
      thrust_area: thrust_area || sourceGoal.thrust_area,
      title: title || `[Shared] ${sourceGoal.title}`,
      description: description || sourceGoal.description,
      uom_type: uom_type || sourceGoal.uom_type,
      uom_direction: uom_direction || sourceGoal.uom_direction,
      target: Number(target ?? sourceGoal.target),
      weightage: 0, // Shared goals don't count toward weightage
      status: 'locked',
      is_shared: true,
      shared_from_id: source_goal_id,
      primary_owner_id: sourceGoal.employee_id,
      locked_at: new Date().toISOString(),
    }));

    const { data: created, error } = await supabase
      .from('goals')
      .insert(inserts)
      .select();

    if (error) throw error;

    // Write audit log for admin push
    await supabase.from('audit_log').insert({
      entity_type: 'goal',
      entity_id: source_goal_id,
      action: 'admin_push_shared',
      changed_by: req.user.id,
      after_state: {
        is_shared: true,
        shared_from_id: source_goal_id,
        pushed_to: employee_ids,
        created_goals: (created || []).map((g) => g.id),
      },
      reason: `Shared goal pushed to ${employee_ids.length} employee(s) by admin`,
    });

    res.status(201).json({
      message: `Shared goal pushed to ${(created || []).length} employee(s)`,
      goals: created || [],
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/shared-goals  — list all shared goals (admin/manager)
// ============================================================
async function listSharedGoals(req, res, next) {
  try {
    const { cycle_id } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    let query = supabase
      .from('goals')
      .select(`
        *,
        employee:users!goals_employee_id_fkey (id, name, email, department),
        primary_owner:users!goals_primary_owner_id_fkey (id, name, email),
        checkins (*)
      `)
      .eq('is_shared', true)
      .order('created_at', { ascending: false });

    if (activeCycleId) query = query.eq('cycle_id', activeCycleId);

    const { data: goals, error } = await query;
    if (error) throw error;

    res.json({ goals: goals || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * Internal helper: sync achievement from a primary goal to all linked shared goals.
 * Called atomically — used by checkin controller.
 * This function uses the Postgres function sync_shared_goal_checkins via RPC for atomicity.
 *
 * @param {string} goalId - Primary goal ID
 * @param {string} quarter - e.g. 'q1'
 * @param {number} actual  - Actual value achieved
 */
async function syncAchievement(goalId, quarter, actual) {
  const { error } = await supabase.rpc('sync_shared_goal_checkins', {
    p_source_goal_id: goalId,
    p_quarter: quarter,
    p_actual: actual,
  });

  if (error) {
    console.error('[SharedGoalController] syncAchievement error:', error.message);
    throw error;
  }
}

module.exports = { pushSharedGoal, listSharedGoals, syncAchievement };
