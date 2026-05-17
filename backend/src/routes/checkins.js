'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const {
  getCheckins,
  submitCheckin,
  addComment,
  getCheckinHistory,
} = require('../controllers/checkinController');

const router = Router();
router.use(authenticate);

router.get('/', getCheckins);
router.post('/', submitCheckin);
router.get('/:goalId/history', getCheckinHistory);
router.post('/:id/comment', requireRole('manager', 'admin'), addComment);

module.exports = router;
