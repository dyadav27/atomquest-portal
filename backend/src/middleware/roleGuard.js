'use strict';

/**
 * Role guard middleware factory.
 * Returns a middleware that blocks requests unless the authenticated user
 * has one of the specified roles.
 *
 * Usage:
 *   router.post('/admin-only', authenticate, requireRole('admin'), handler)
 *   router.get('/manager-or-admin', authenticate, requireRole('manager', 'admin'), handler)
 *
 * @param {...string} roles - Allowed roles ('employee' | 'manager' | 'admin')
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${roles.join(', ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
}

module.exports = { requireRole };
