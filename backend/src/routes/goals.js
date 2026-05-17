'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const {
  getMyGoals,
  getTeamGoals,
  createGoal,
  updateGoal,
  submitGoal,
  approveGoal,
  returnGoal,
  unlockGoal,
  deleteGoal,
} = require('../controllers/goalController');

const router = Router();

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get('/my', getMyGoals);
router.post('/', createGoal);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);
router.post('/submit', submitGoal);

// Manager / Admin routes
router.get('/team', requireRole('manager', 'admin'), getTeamGoals);
router.post('/:id/approve', requireRole('manager', 'admin'), approveGoal);
router.post('/:id/return', requireRole('manager', 'admin'), returnGoal);

// Admin-only routes
router.post('/:id/unlock', requireRole('admin'), unlockGoal);

module.exports = router;
