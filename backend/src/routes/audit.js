'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { listAuditLog, getAuditEntry } = require('../controllers/auditController');

const router = Router();
router.use(authenticate);
router.use(requireRole('manager', 'admin'));

router.get('/', listAuditLog);
router.get('/:id', getAuditEntry);

module.exports = router;
