'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/escalations  — list escalations
// ============================================================
async function listEscalations(req, res, next) {
  try {
    const { resolved, rule_type, level } = req.query;

    let query = supabase
      .from('escalations')
      .select(`
        *,
        target_user:users!escalations_target_user_id_fkey (id, name, email, department, manager_id)
      `)
      .order('created_at', { ascending: false });

    if (resolved !== undefined) query = query.eq('resolved', resolved === 'true');
    if (rule_type) query = query.eq('rule_type', rule_type);
    if (level) query = query.eq('level', Number(level));

    // Managers see only their team's escalations
    if (req.user.role === 'manager') {
      const { data: reports } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', req.user.id);
      const reportIds = (reports || []).map((r) => r.id);
      if (reportIds.length > 0) {
        query = query.in('target_user_id', reportIds);
      } else {
        return res.json({ escalations: [] });
      }
    }

    const { data: escalations, error } = await query;
    if (error) throw error;

    res.json({ escalations: escalations || [] });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/escalations/:id/resolve  — mark escalation resolved
// ============================================================
async function resolveEscalation(req, res, next) {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('escalations')
      .select('id, resolved')
      .eq('id', id)
      .single();

    if (!existing) throw createError(404, 'Escalation not found');
    if (existing.resolved) throw createError(400, 'Escalation is already resolved');

    const { data: escalation, error } = await supabase
      .from('escalations')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ escalation, message: 'Escalation resolved successfully' });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/escalations/run  — trigger escalation engine manually
// ============================================================
async function triggerEscalationRun(req, res, next) {
  try {
    const { runAllRules } = require('../services/escalationEngine');
    // Run asynchronously — don't block response
    runAllRules().catch((err) =>
      console.error('[EscalationController] Manual trigger error:', err.message)
    );
    res.json({ message: 'Escalation engine triggered. Results will be processed asynchronously.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEscalations, resolveEscalation, triggerEscalationRun };
