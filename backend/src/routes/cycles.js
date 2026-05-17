'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { listCycles, getActiveCycle, createCycle, updateCycle } = require('../controllers/cycleController');

const router = Router();
router.use(authenticate);

router.get('/', listCycles);
router.get('/active', getActiveCycle);
router.post('/', requireRole('admin'), createCycle);
router.put('/:id', requireRole('admin'), updateCycle);

module.exports = router;
