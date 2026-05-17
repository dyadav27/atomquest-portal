'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { pushSharedGoal, listSharedGoals } = require('../controllers/sharedGoalController');

const router = Router();
router.use(authenticate);

router.get('/', requireRole('manager', 'admin'), listSharedGoals);
router.post('/push', requireRole('admin'), pushSharedGoal);

module.exports = router;
