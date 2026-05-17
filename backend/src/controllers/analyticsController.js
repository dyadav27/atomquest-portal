'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/analytics/heatmap
// Employees × quarters matrix with scores
// ============================================================
async function getHeatmap(req, res, next) {
  try {
    const { cycle_id, department } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) throw createError(400, 'No active cycle');

    // Get all relevant employees
    let empQuery = supabase.from('users').select('id, name, email, department').eq('role', 'employee');
    if (department) empQuery = empQuery.eq('department', department);
    // Managers see only their team
    if (req.user.role === 'manager') empQuery = empQuery.eq('manager_id', req.user.id);

    const { data: employees } = await empQuery;
    if (!employees || employees.length === 0) return res.json({ heatmap: [] });

    const empIds = employees.map((e) => e.id);

    // Get all locked goals for these employees
    const { data: goals } = await supabase
      .from('goals')
      .select('id, employee_id')
      .in('employee_id', empIds)
      .eq('cycle_id', activeCycleId)
      .eq('status', 'locked');

    const goalIds = (goals || []).map((g) => g.id);
    const goalToEmployee = {};
    (goals || []).forEach((g) => { goalToEmployee[g.id] = g.employee_id; });

    // Get all checkins for these goals
    const { data: checkins } = goalIds.length > 0
      ? await supabase
          .from('checkins')
          .select('goal_id, quarter, score')
          .in('goal_id', goalIds)
      : { data: [] };

    // Build heatmap: per employee per quarter, average score
    const quarterMap = { q1: 0, q2: 1, q3: 2, q4: 3 };
    const scores = {}; // { employeeId: { q1: [scores...] } }

    for (const c of checkins || []) {
      const empId = goalToEmployee[c.goal_id];
      if (!empId) continue;
      if (!scores[empId]) scores[empId] = { q1: [], q2: [], q3: [], q4: [] };
      if (c.score !== null && c.score !== undefined) {
        scores[empId][c.quarter].push(Number(c.score));
      }
    }

    const heatmap = employees.map((emp) => {
      const empScores = scores[emp.id] || { q1: [], q2: [], q3: [], q4: [] };
      return {
        employee_id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        q1: empScores.q1.length ? empScores.q1.reduce((a, b) => a + b, 0) / empScores.q1.length : null,
        q2: empScores.q2.length ? empScores.q2.reduce((a, b) => a + b, 0) / empScores.q2.length : null,
        q3: empScores.q3.length ? empScores.q3.reduce((a, b) => a + b, 0) / empScores.q3.length : null,
        q4: empScores.q4.length ? empScores.q4.reduce((a, b) => a + b, 0) / empScores.q4.length : null,
      };
    });

    res.json({ heatmap });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/analytics/qoq-trend
// Quarter-over-quarter score trend per user/team
// ============================================================
async function getQoQTrend(req, res, next) {
  try {
    const { employee_id, cycle_id } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    if (!activeCycleId) throw createError(400, 'No active cycle');

    // Determine scope of employees
    let empIds;
    if (employee_id) {
      empIds = [employee_id];
    } else if (req.user.role === 'employee') {
      empIds = [req.user.id];
    } else if (req.user.role === 'manager') {
      const { data: reports } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', req.user.id);
      empIds = (reports || []).map((r) => r.id);
    } else {
      const { data: allEmps } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'employee');
      empIds = (allEmps || []).map((r) => r.id);
    }

    if (empIds.length === 0) return res.json({ trends: [] });

    const { data: goals } = await supabase
      .from('goals')
      .select('id, employee_id')
      .in('employee_id', empIds)
      .eq('cycle_id', activeCycleId)
      .eq('status', 'locked');

    const goalIds = (goals || []).map((g) => g.id);
    const goalToEmp = {};
    (goals || []).forEach((g) => { goalToEmp[g.id] = g.employee_id; });

    const { data: checkins } = goalIds.length > 0
      ? await supabase
          .from('checkins')
          .select('goal_id, quarter, score')
          .in('goal_id', goalIds)
      : { data: [] };

    // Aggregate by employee and quarter
    const empData = {};
    for (const c of checkins || []) {
      const empId = goalToEmp[c.goal_id];
      if (!empId) continue;
      if (!empData[empId]) empData[empId] = { q1: [], q2: [], q3: [], q4: [] };
      if (c.score !== null) empData[empId][c.quarter].push(Number(c.score));
    }

    // Fetch employee names
    const { data: empProfiles } = await supabase
      .from('users')
      .select('id, name')
      .in('id', empIds);
    const nameMap = {};
    (empProfiles || []).forEach((e) => { nameMap[e.id] = e.name; });

    const trends = Object.entries(empData).map(([empId, qScores]) => ({
      employee_id: empId,
      name: nameMap[empId] || empId,
      trend: ['q1', 'q2', 'q3', 'q4'].map((q) => ({
        quarter: q,
        avg_score: qScores[q].length
          ? parseFloat((qScores[q].reduce((a, b) => a + b, 0) / qScores[q].length).toFixed(2))
          : null,
      })),
    }));

    res.json({ trends });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/analytics/distribution
// Count goals grouped by thrust_area and uom_type
// ============================================================
async function getDistribution(req, res, next) {
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

    const { data: goals, error } = await supabase
      .from('goals')
      .select('thrust_area, uom_type, status')
      .eq('cycle_id', activeCycleId);

    if (error) throw error;

    // Group by thrust_area
    const byThrustArea = {};
    const byUomType = {};

    for (const g of goals || []) {
      byThrustArea[g.thrust_area] = (byThrustArea[g.thrust_area] || 0) + 1;
      byUomType[g.uom_type] = (byUomType[g.uom_type] || 0) + 1;
    }

    const thrustAreaData = Object.entries(byThrustArea).map(([name, count]) => ({ name, count }));
    const uomTypeData = Object.entries(byUomType).map(([name, count]) => ({ name, count }));

    res.json({ by_thrust_area: thrustAreaData, by_uom_type: uomTypeData, total: (goals || []).length });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/analytics/manager-effectiveness
// Per manager: checkin completion % for their team
// ============================================================
async function getManagerEffectiveness(req, res, next) {
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

    // Get all managers
    const { data: managers } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'manager');

    if (!managers || managers.length === 0) return res.json({ managers: [] });

    const results = [];

    for (const mgr of managers) {
      // Get their direct reports
      const { data: reports } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', mgr.id);

      const reportIds = (reports || []).map((r) => r.id);
      if (reportIds.length === 0) {
        results.push({ manager_id: mgr.id, name: mgr.name, team_size: 0, checkin_completion_pct: null });
        continue;
      }

      // Get locked goals for these employees
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .in('employee_id', reportIds)
        .eq('cycle_id', activeCycleId)
        .eq('status', 'locked');

      const goalIds = (goals || []).map((g) => g.id);
      if (goalIds.length === 0) {
        results.push({ manager_id: mgr.id, name: mgr.name, team_size: reportIds.length, checkin_completion_pct: 0 });
        continue;
      }

      // Count submitted checkins
      const { count: submittedCount } = await supabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .in('goal_id', goalIds)
        .not('submitted_at', 'is', null);

      // Total possible = goals × 4 quarters
      const totalPossible = goalIds.length * 4;
      const pct = totalPossible > 0 ? parseFloat(((submittedCount / totalPossible) * 100).toFixed(1)) : 0;

      results.push({
        manager_id: mgr.id,
        name: mgr.name,
        team_size: reportIds.length,
        total_goals: goalIds.length,
        submitted_checkins: submittedCount,
        total_possible_checkins: totalPossible,
        checkin_completion_pct: pct,
      });
    }

    res.json({ managers: results });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/analytics/anomalies
// Find checkins where score jumped > 50 in one quarter
// ============================================================
async function getAnomalies(req, res, next) {
  try {
    const { cycle_id, threshold = 50 } = req.query;

    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('goal_cycles')
        .select('id')
        .eq('is_active', true)
        .single();
      activeCycleId = cycle?.id;
    }

    // Get all checkins for goals in this cycle, ordered by goal and quarter
    const { data: goals } = await supabase
      .from('goals')
      .select('id, title, employee_id, employee:users!goals_employee_id_fkey (name, email)')
      .eq('cycle_id', activeCycleId);

    if (!goals || goals.length === 0) return res.json({ anomalies: [] });

    const goalIds = goals.map((g) => g.id);
    const goalMap = {};
    goals.forEach((g) => { goalMap[g.id] = g; });

    const { data: checkins } = await supabase
      .from('checkins')
      .select('goal_id, quarter, score')
      .in('goal_id', goalIds)
      .not('score', 'is', null)
      .order('goal_id')
      .order('quarter');

    const quarterOrder = { q1: 1, q2: 2, q3: 3, q4: 4 };

    // Group by goal
    const goalCheckins = {};
    for (const c of checkins || []) {
      if (!goalCheckins[c.goal_id]) goalCheckins[c.goal_id] = [];
      goalCheckins[c.goal_id].push(c);
    }

    const anomalies = [];
    const thresholdNum = Number(threshold);

    for (const [goalId, gCheckins] of Object.entries(goalCheckins)) {
      const sorted = [...gCheckins].sort((a, b) => quarterOrder[a.quarter] - quarterOrder[b.quarter]);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const delta = Number(curr.score) - Number(prev.score);

        if (Math.abs(delta) > thresholdNum) {
          const goal = goalMap[goalId];
          anomalies.push({
            goal_id: goalId,
            goal_title: goal?.title,
            employee_id: goal?.employee_id,
            employee_name: goal?.employee?.name,
            from_quarter: prev.quarter,
            to_quarter: curr.quarter,
            from_score: Number(prev.score),
            to_score: Number(curr.score),
            delta: parseFloat(delta.toFixed(2)),
            severity: Math.abs(delta) > 75 ? 'high' : Math.abs(delta) > 50 ? 'medium' : 'low',
          });
        }
      }
    }

    // Sort by absolute delta descending
    anomalies.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    res.json({ anomalies, count: anomalies.length, threshold: thresholdNum });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHeatmap, getQoQTrend, getDistribution, getManagerEffectiveness, getAnomalies };
