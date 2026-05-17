'use strict';

const { supabase } = require('../config/supabase');
const { computeScore, computeTimelineScore } = require('../services/scoreService');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/checkins  — list checkins by quarter + user
// ============================================================
async function getCheckins(req, res, next) {
  try {
    const { quarter, employee_id, goal_id } = req.query;

    let query = supabase
      .from('checkins')
      .select(`
        *,
        goal:goals!checkins_goal_id_fkey (
          id, title, thrust_area, uom_type, uom_direction, target, weightage, status, employee_id
        ),
        comments:checkin_comments (
          id, comment, ai_generated, created_at,
          manager:users!checkin_comments_manager_id_fkey (id, name, email)
        )
      `)
      .order('submitted_at', { ascending: false });

    if (quarter) query = query.eq('quarter', quarter);
    if (goal_id) query = query.eq('goal_id', goal_id);

    const { data: checkins, error } = await query;
    if (error) throw error;

    // Filter by employee_id access
    let filtered = checkins || [];
    if (req.user.role === 'employee') {
      filtered = filtered.filter((c) => c.goal?.employee_id === req.user.id);
    } else if (req.user.role === 'manager') {
      const { data: reports } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', req.user.id);
      const reportIds = new Set((reports || []).map((r) => r.id));
      filtered = filtered.filter(
        (c) => c.goal?.employee_id === req.user.id || reportIds.has(c.goal?.employee_id)
      );
    }

    if (employee_id && req.user.role !== 'employee') {
      filtered = filtered.filter((c) => c.goal?.employee_id === employee_id);
    }

    res.json({ checkins: filtered });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/checkins  — submit a checkin for a quarter
// ============================================================
async function submitCheckin(req, res, next) {
  try {
    const { goal_id, quarter, planned, actual, timeline_deadline } = req.body;

    if (!goal_id || !quarter || actual === undefined || actual === null) {
      throw createError(400, 'Required: goal_id, quarter, actual');
    }

    // Verify goal exists and belongs to user
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('*, cycle:goal_cycles!goals_cycle_id_fkey (*)')
      .eq('id', goal_id)
      .single();

    if (goalErr || !goal) throw createError(404, 'Goal not found');

    if (goal.employee_id !== req.user.id && req.user.role !== 'admin') {
      throw createError(403, 'You can only submit checkins for your own goals');
    }

    if (goal.status !== 'locked') {
      throw createError(400, 'Checkins can only be submitted for locked (approved) goals');
    }

    // Verify quarter window is open
    const cycle = goal.cycle;
    if (cycle && req.user.role !== 'admin') {
      const today = new Date();
      const opens = new Date(cycle[`${quarter}_opens`]);
      const closes = new Date(cycle[`${quarter}_closes`]);

      if (today < opens || today > closes) {
        throw createError(
          400,
          `The ${quarter.toUpperCase()} check-in window is not currently open. Window: ${opens.toDateString()} – ${closes.toDateString()}`
        );
      }
    }

    // Compute score
    let score = null;
    if (goal.uom_direction === 'timeline') {
      if (!timeline_deadline) {
        throw createError(400, 'timeline_deadline is required for timeline-type goals');
      }
      score = computeTimelineScore(timeline_deadline, new Date());
    } else {
      score = computeScore(goal.uom_direction, goal.target, actual);
    }

    const submittedAt = new Date().toISOString();

    // Upsert checkin
    const { data: checkin, error } = await supabase
      .from('checkins')
      .upsert(
        {
          goal_id,
          quarter,
          planned: planned !== undefined ? Number(planned) : null,
          actual: Number(actual),
          status: 'completed',
          score,
          submitted_at: submittedAt,
        },
        { onConflict: 'goal_id,quarter', returning: 'representation' }
      )
      .select()
      .single();

    if (error) throw error;

    // Sync shared goals that derive from this one
    if (goal.is_shared === false) {
      // Only sync if this is the primary/source goal
      const { data: linkedShared } = await supabase
        .from('goals')
        .select('id, uom_direction, target')
        .eq('shared_from_id', goal_id)
        .eq('is_shared', true);

      if (linkedShared && linkedShared.length > 0) {
        for (const sharedGoal of linkedShared) {
          const sharedScore = computeScore(sharedGoal.uom_direction, sharedGoal.target, actual);
          await supabase
            .from('checkins')
            .upsert(
              {
                goal_id: sharedGoal.id,
                quarter,
                planned,
                actual: Number(actual),
                status: 'completed',
                score: sharedScore,
                submitted_at: submittedAt,
              },
              { onConflict: 'goal_id,quarter', returning: 'representation' }
            );
        }
      }
    }

    res.status(201).json({
      checkin,
      score,
      message: `Check-in submitted for ${quarter.toUpperCase()} — Score: ${score !== null ? score.toFixed(1) + '%' : 'N/A'}`,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/checkins/:id/comment  — manager adds comment
// ============================================================
async function addComment(req, res, next) {
  try {
    const { id: checkin_id } = req.params;
    const { comment, ai_generated = false } = req.body;

    if (!comment || comment.trim().length === 0) {
      throw createError(400, 'Comment text is required');
    }

    // Verify checkin exists
    const { data: checkin, error: checkinErr } = await supabase
      .from('checkins')
      .select('id, goal:goals!checkins_goal_id_fkey (employee_id)')
      .eq('id', checkin_id)
      .single();

    if (checkinErr || !checkin) throw createError(404, 'Check-in not found');

    // Verify caller is manager/admin
    if (req.user.role === 'employee') {
      throw createError(403, 'Only managers and admins can add comments to check-ins');
    }

    const { data: commentRow, error } = await supabase
      .from('checkin_comments')
      .insert({
        checkin_id,
        manager_id: req.user.id,
        comment: comment.trim(),
        ai_generated: Boolean(ai_generated),
      })
      .select(`
        *,
        manager:users!checkin_comments_manager_id_fkey (id, name, email)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ comment: commentRow });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/checkins/:goalId/history  — all quarters for a goal
// ============================================================
async function getCheckinHistory(req, res, next) {
  try {
    const { goalId } = req.params;

    const { data: goal } = await supabase
      .from('goals')
      .select('employee_id')
      .eq('id', goalId)
      .single();

    if (!goal) throw createError(404, 'Goal not found');

    // Access control
    if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
      throw createError(403, 'Access denied');
    }

    const { data: checkins, error } = await supabase
      .from('checkins')
      .select(`
        *,
        comments:checkin_comments (
          id, comment, ai_generated, created_at,
          manager:users!checkin_comments_manager_id_fkey (id, name)
        )
      `)
      .eq('goal_id', goalId)
      .order('quarter');

    if (error) throw error;

    res.json({ checkins: checkins || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCheckins, submitCheckin, addComment, getCheckinHistory };
