'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const {
  listEscalations,
  resolveEscalation,
  triggerEscalationRun,
} = require('../controllers/escalationController');

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'admin'));

router.get('/', listEscalations);
router.post('/:id/resolve', resolveEscalation);
router.post('/run', requireRole('admin'), triggerEscalationRun);

module.exports = router;
