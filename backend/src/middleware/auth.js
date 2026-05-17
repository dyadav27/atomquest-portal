'use strict';

const { supabase } = require('../config/supabase');

/**
 * Auth middleware — validates Supabase JWT from Authorization header.
 * Attaches the full user record (including role) to req.user.
 *
 * Flow:
 *  1. Extract Bearer token from Authorization header
 *  2. Call supabase.auth.getUser(token) to verify JWT and get auth user
 *  3. Fetch matching row from public.users to get role, name, manager_id
 *  4. Attach combined user object to req.user
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    // Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired access token',
      });
    }

    const authUser = authData.user;

    // Fetch profile row from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, manager_id, department, azure_oid, created_at')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User profile not found. Please contact an administrator.',
      });
    }

    // Attach full user to request
    req.user = {
      ...profile,
      accessToken: token,
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Unexpected error:', err);
    next(err);
  }
}

module.exports = { authenticate };
