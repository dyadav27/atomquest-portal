'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { supabase } = require('../config/supabase');
const { streamXLSXResponse, streamCSVResponse } = require('../services/exportService');

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'admin'));

/**
 * GET /api/reports/achievement
 * Exports achievement report for a cycle as CSV or XLSX.
 * Query params: cycle_id, format (csv|xlsx), department
 */
router.get('/achievement', async (req, res, next) => {
  try {
    const { cycle_id, format = 'xlsx', department } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id, name')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) {
      return res.status(400).json({ error: 'No active cycle found' });
    }

    // Fetch goals with employee info and checkins
    let empFilter = supabase
      .from('goals')
      .select(`
        id, title, thrust_area, uom_type, uom_direction, target, weightage, status, dna_score,
        employee:users!goals_employee_id_fkey (id, name, email, department),
        checkins (quarter, planned, actual, score, status, submitted_at)
      `)
      .eq('cycle_id', activeCycleId)
      .eq('status', 'locked');

    // Managers only see their team
    if (req.user.role === 'manager') {
      const { data: reports } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', req.user.id);
      const reportIds = (reports || []).map((r) => r.id);
      empFilter = empFilter.in('employee_id', reportIds);
    }

    const { data: goals, error } = await empFilter;
    if (error) throw error;

    // Flatten into rows
    const rows = [];
    for (const goal of goals || []) {
      const emp = goal.employee;
      if (department && emp?.department !== department) continue;

      const checkinMap = {};
      for (const c of goal.checkins || []) {
        checkinMap[c.quarter] = c;
      }

      const dnaTotal = goal.dna_score?.total ?? '';

      rows.push({
        employee_name: emp?.name || '',
        employee_email: emp?.email || '',
        department: emp?.department || '',
        goal_title: goal.title,
        thrust_area: goal.thrust_area,
        uom_type: goal.uom_type,
        uom_direction: goal.uom_direction,
        target: goal.target,
        weightage: goal.weightage,
        dna_score: dnaTotal,
        q1_planned: checkinMap.q1?.planned ?? '',
        q1_actual: checkinMap.q1?.actual ?? '',
        q1_score: checkinMap.q1?.score ?? '',
        q2_planned: checkinMap.q2?.planned ?? '',
        q2_actual: checkinMap.q2?.actual ?? '',
        q2_score: checkinMap.q2?.score ?? '',
        q3_planned: checkinMap.q3?.planned ?? '',
        q3_actual: checkinMap.q3?.actual ?? '',
        q3_score: checkinMap.q3?.score ?? '',
        q4_planned: checkinMap.q4?.planned ?? '',
        q4_actual: checkinMap.q4?.actual ?? '',
        q4_score: checkinMap.q4?.score ?? '',
      });
    }

    const filename = `atomquest-achievement-report-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      streamCSVResponse(res, rows, filename);
    } else {
      await streamXLSXResponse(res, rows, filename);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/checkin-summary
 * Quarter-wise planned vs actual for all accessible employees.
 */
router.get('/checkin-summary', async (req, res, next) => {
  try {
    const { cycle_id, format = 'xlsx', quarter } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) return res.status(400).json({ error: 'No active cycle found' });

    let goalQuery = supabase
      .from('goals')
      .select(`
        id, title, thrust_area, target, uom_type,
        employee:users!goals_employee_id_fkey (id, name, email, department),
        checkins (quarter, planned, actual, score, status, submitted_at)
      `)
      .eq('cycle_id', activeCycleId)
      .eq('status', 'locked');

    if (req.user.role === 'manager') {
      const { data: reports } = await supabase.from('users').select('id').eq('manager_id', req.user.id);
      goalQuery = goalQuery.in('employee_id', (reports || []).map(r => r.id));
    }

    const { data: goals, error } = await goalQuery;
    if (error) throw error;

    const rows = [];
    for (const goal of goals || []) {
      const emp = goal.employee;
      const checkins = goal.checkins || [];
      const quarters = quarter ? [quarter] : ['q1', 'q2', 'q3', 'q4'];

      for (const q of quarters) {
        const c = checkins.find((ch) => ch.quarter === q);
        rows.push({
          employee_name: emp?.name || '',
          department: emp?.department || '',
          goal_title: goal.title,
          thrust_area: goal.thrust_area,
          target: goal.target,
          uom_type: goal.uom_type,
          quarter: q.toUpperCase(),
          planned: c?.planned ?? '',
          actual: c?.actual ?? '',
          score: c?.score ?? '',
          status: c?.status || 'not_started',
          submitted_at: c?.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN') : '',
        });
      }
    }

    const filename = `atomquest-checkin-summary-${new Date().toISOString().split('T')[0]}`;
    if (format === 'csv') {
      streamCSVResponse(res, rows, filename);
    } else {
      await streamXLSXResponse(res, rows, filename);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/escalations
 * All escalations (admin only) exported as CSV.
 */
router.get('/escalations', requireRole('admin'), async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;

    const { data: escalations, error } = await supabase
      .from('escalations')
      .select(`
        id, rule_type, level, resolved, resolved_at, created_at,
        target:users!escalations_target_user_id_fkey (name, email, department)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (escalations || []).map(e => ({
      employee_name: e.target?.name || '',
      employee_email: e.target?.email || '',
      department: e.target?.department || '',
      rule_type: e.rule_type,
      level: e.level,
      resolved: e.resolved ? 'Yes' : 'No',
      resolved_at: e.resolved_at ? new Date(e.resolved_at).toLocaleDateString('en-IN') : '',
      created_at: new Date(e.created_at).toLocaleDateString('en-IN'),
    }));

    const filename = `atomquest-escalations-${new Date().toISOString().split('T')[0]}`;
    if (format === 'xlsx') {
      await streamXLSXResponse(res, rows, filename);
    } else {
      streamCSVResponse(res, rows, filename);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
