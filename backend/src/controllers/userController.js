'use strict';

const { supabase } = require('../config/supabase');
const { createError } = require('../middleware/errorHandler');

// ============================================================
// GET /api/users/me  — current user profile
// ============================================================
async function getMe(req, res, next) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/users  — list users (admin: all; manager: team)
// ============================================================
async function listUsers(req, res, next) {
  try {
    const { role, department, search } = req.query;

    let query = supabase
      .from('users')
      .select('id, name, email, role, manager_id, department, azure_oid, created_at')
      .order('name');

    // Managers only see their direct reports
    if (req.user.role === 'manager') {
      query = query.eq('manager_id', req.user.id);
    }

    if (role) query = query.eq('role', role);
    if (department) query = query.eq('department', department);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    res.json({ users: users || [] });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/users/:id  — get user by ID
// ============================================================
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;

    // Employees can only view themselves
    if (req.user.role === 'employee' && req.user.id !== id) {
      throw createError(403, 'Access denied');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, manager_id, department, azure_oid, created_at')
      .eq('id', id)
      .single();

    if (error || !user) throw createError(404, 'User not found');

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/users  — create user (admin only)
// ============================================================
async function createUser(req, res, next) {
  try {
    const { name, email, password, role = 'employee', manager_id, department, azure_oid } = req.body;

    if (!name || !email || !password) {
      throw createError(400, 'name, email, and password are required');
    }

    // 1. Create the user in Supabase Auth
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authErr) {
      throw createError(400, authErr.message);
    }

    const userId = authUser.user.id;

    // 2. Insert into the public.users table
    const { data: user, error: dbErr } = await supabase
      .from('users')
      .insert({ 
        id: userId, 
        name, 
        email, 
        role, 
        manager_id: manager_id || null, 
        department, 
        azure_oid 
      })
      .select()
      .single();

    if (dbErr) {
      // If DB insert fails, cleanup the auth user
      await supabase.auth.admin.deleteUser(userId);
      throw dbErr;
    }

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// DELETE /api/users/:id  — delete user (admin only)
// ============================================================
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    
    if (req.user.id === id) {
      throw createError(400, 'You cannot delete your own account');
    }

    // Check if user exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('id', id).single();
    if (!existingUser) {
      throw createError(404, 'User not found');
    }

    // 1. Delete from Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(id);
    if (authErr) {
      throw createError(400, authErr.message);
    }

    // 2. Delete from public.users (cascade should handle most, but explicitly delete)
    const { error: dbErr } = await supabase.from('users').delete().eq('id', id);
    if (dbErr) throw dbErr;

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// PUT /api/users/:id  — update user
// ============================================================
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;

    // Employees can only update themselves (limited fields)
    if (req.user.role === 'employee' && req.user.id !== id) {
      throw createError(403, 'Access denied');
    }

    const allowedByEmployee = ['name', 'department'];
    const allowedByAdmin = ['name', 'email', 'role', 'manager_id', 'department', 'azure_oid'];

    const allowedFields = req.user.role === 'admin' ? allowedByAdmin : allowedByEmployee;
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      throw createError(400, 'No valid fields to update');
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!user) throw createError(404, 'User not found');

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/users/team/pending-approvals  — manager's pending goals
// ============================================================
async function getPendingApprovals(req, res, next) {
  try {
    // Get all direct reports
    const { data: reports } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('manager_id', req.user.id);

    if (!reports || reports.length === 0) {
      return res.json({ pendingGoals: [], count: 0 });
    }

    const reportIds = reports.map((r) => r.id);

    const { data: goals, error } = await supabase
      .from('goals')
      .select(`
        *,
        employee:users!goals_employee_id_fkey (id, name, email)
      `)
      .in('employee_id', reportIds)
      .eq('status', 'pending')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    res.json({ pendingGoals: goals || [], count: (goals || []).length });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, listUsers, getUserById, createUser, updateUser, deleteUser, getPendingApprovals };
