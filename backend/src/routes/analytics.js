'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const {
  getHeatmap,
  getQoQTrend,
  getDistribution,
  getManagerEffectiveness,
  getAnomalies,
} = require('../controllers/analyticsController');

const router = Router();
router.use(authenticate);

router.get('/heatmap', requireRole('manager', 'admin'), getHeatmap);
router.get('/qoq-trend', getQoQTrend);
router.get('/distribution', requireRole('manager', 'admin'), getDistribution);
router.get('/manager-effectiveness', requireRole('admin'), getManagerEffectiveness);
router.get('/anomalies', requireRole('manager', 'admin'), getAnomalies);

module.exports = router;
