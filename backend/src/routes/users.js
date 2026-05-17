'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const {
  getMe,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getPendingApprovals,
} = require('../controllers/userController');

const router = Router();
router.use(authenticate);

router.get('/me', getMe);
router.get('/team/pending-approvals', requireRole('manager', 'admin'), getPendingApprovals);
router.get('/', requireRole('manager', 'admin'), listUsers);
router.get('/:id', getUserById);
router.post('/', requireRole('admin'), createUser);
router.put('/:id', updateUser);
router.delete('/:id', requireRole('admin'), deleteUser);

module.exports = router;
