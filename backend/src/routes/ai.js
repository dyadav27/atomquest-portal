'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { parseGoal, getDnaScore, predictOutcome, draftComment } = require('../controllers/aiController');

const router = Router();
router.use(authenticate);

router.post('/parse-goal', parseGoal);
router.post('/dna-score', getDnaScore);
router.post('/predict', predictOutcome);
router.post('/draft-comment', draftComment);

module.exports = router;
