'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/audit  — paginated audit log with filters
// ============================================================
async function listAuditLog(req, res, next) {
  try {
    const {
      entity_type,
      entity_id,
      action,
      changed_by,
      page = 1,
      limit = 50,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('audit_log')
      .select(
        `
        *,
        actor:users!audit_log_changed_by_fkey (id, name, email, role)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (action) query = query.eq('action', action);
    if (changed_by) query = query.eq('changed_by', changed_by);

    const { data: logs, error, count } = await query;

    if (error) throw error;

    res.json({
      logs: logs || [],
      totalCount: count || 0,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((count || 0) / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/audit/:id  — single audit log entry
// ============================================================
async function getAuditEntry(req, res, next) {
  try {
    const { id } = req.params;

    const { data: log, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        actor:users!audit_log_changed_by_fkey (id, name, email, role)
      `)
      .eq('id', id)
      .single();

    if (error || !log) throw createError(404, 'Audit log entry not found');

    res.json({ log });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAuditLog, getAuditEntry };
