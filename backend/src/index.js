'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { startEscalationCron } = require('./jobs/escalationCron');
const { startCheckinReminderCron } = require('./jobs/checkinReminderCron');
const { errorHandler } = require('./middleware/errorHandler');

// Route imports
const goalsRouter = require('./routes/goals');
const checkinsRouter = require('./routes/checkins');
const sharedGoalsRouter = require('./routes/sharedGoals');
const cyclesRouter = require('./routes/cycles');
const usersRouter = require('./routes/users');
const auditRouter = require('./routes/audit');
const escalationsRouter = require('./routes/escalations');
const analyticsRouter = require('./routes/analytics');
const reportsRouter = require('./routes/reports');
const aiRouter = require('./routes/ai');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================================
// Security & Parsing Middleware
// ============================================================
app.use(helmet());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? FRONTEND_URL
        : ['http://localhost:5173', 'http://localhost:3000', FRONTEND_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// Health Check (unprotected)
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'atomquest-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// API Routes (all protected by auth middleware in each router)
// ============================================================
app.use('/api/goals', goalsRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/shared-goals', sharedGoalsRouter);
app.use('/api/cycles', cyclesRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit', auditRouter);
app.use('/api/escalations', escalationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
  });
});

// ============================================================
// Global Error Handler (must be last)
// ============================================================
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
  console.log(`[AtomQuest] Backend running on port ${PORT}`);
  console.log(`[AtomQuest] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[AtomQuest] CORS origin: ${FRONTEND_URL}`);

  // Start cron jobs
  try {
    startEscalationCron();
    console.log('[AtomQuest] Escalation cron job started');
  } catch (err) {
    console.error('[AtomQuest] Failed to start escalation cron:', err.message);
  }

  try {
    startCheckinReminderCron();
    console.log('[AtomQuest] Checkin reminder cron job started');
  } catch (err) {
    console.error('[AtomQuest] Failed to start checkin reminder cron:', err.message);
  }
});

module.exports = app;
