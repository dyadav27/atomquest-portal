'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/cycles  — list all cycles
// ============================================================
async function listCycles(req, res, next) {
  try {
    const { data: cycles, error } = await supabase
      .from('goal_cycles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ cycles: cycles || [] });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/cycles/active  — get active cycle
// ============================================================
async function getActiveCycle(req, res, next) {
  try {
    const { data: cycle, error } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!cycle) {
      return res.json({ cycle: null, activeQuarter: null, isGoalSettingOpen: false });
    }

    // Derive active quarter
    const today = new Date();
    const quarters = ['q1', 'q2', 'q3', 'q4'];
    let activeQuarter = null;
    let isGoalSettingOpen = false;

    for (const q of quarters) {
      const opens = new Date(cycle[`${q}_opens`]);
      const closes = new Date(cycle[`${q}_closes`]);
      if (today >= opens && today <= closes) {
        activeQuarter = q;
        break;
      }
    }

    const goalSettingOpens = new Date(cycle.goal_setting_opens);
    // Goal setting is open from goal_setting_opens until first quarter closes
    const firstQClose = new Date(cycle.q1_closes);
    if (today >= goalSettingOpens && today <= firstQClose) {
      isGoalSettingOpen = true;
    }

    res.json({ cycle, activeQuarter, isGoalSettingOpen });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/cycles  — create a new cycle (admin only)
// ============================================================
async function createCycle(req, res, next) {
  try {
    const {
      name,
      goal_setting_opens,
      q1_opens, q1_closes,
      q2_opens, q2_closes,
      q3_opens, q3_closes,
      q4_opens, q4_closes,
      is_active = false,
    } = req.body;

    if (!name || !goal_setting_opens || !q1_opens || !q1_closes ||
        !q2_opens || !q2_closes || !q3_opens || !q3_closes || !q4_opens || !q4_closes) {
      throw createError(400, 'All date fields are required');
    }

    // If setting as active, deactivate existing cycles
    if (is_active) {
      await supabase.from('goal_cycles').update({ is_active: false }).eq('is_active', true);
    }

    const { data: cycle, error } = await supabase
      .from('goal_cycles')
      .insert({
        name, goal_setting_opens,
        q1_opens, q1_closes, q2_opens, q2_closes,
        q3_opens, q3_closes, q4_opens, q4_closes,
        is_active,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ cycle });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// PUT /api/cycles/:id  — update cycle (admin only)
// ============================================================
async function updateCycle(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.is_active) {
      await supabase
        .from('goal_cycles')
        .update({ is_active: false })
        .eq('is_active', true)
        .neq('id', id);
    }

    const { data: cycle, error } = await supabase
      .from('goal_cycles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!cycle) throw createError(404, 'Cycle not found');

    res.json({ cycle });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCycles, getActiveCycle, createCycle, updateCycle };
