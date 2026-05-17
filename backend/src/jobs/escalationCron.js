'use strict';

const cron = require('node-cron');
const { runAllRules } = require('../services/escalationEngine');

/**
 * Starts the escalation cron job.
 * Runs every day at 8:00 AM IST (2:30 AM UTC).
 *
 * Schedule: '30 2 * * *' (UTC)
 * Equivalent to 08:00 IST (UTC+5:30)
 */
function startEscalationCron() {
  // Schedule: every day at 08:00 AM IST = 02:30 UTC
  const schedule = process.env.ESCALATION_CRON_SCHEDULE || '30 2 * * *';

  if (!cron.validate(schedule)) {
    throw new Error(`[EscalationCron] Invalid cron schedule: "${schedule}"`);
  }

  cron.schedule(schedule, async () => {
    console.log(`[EscalationCron] Triggered at ${new Date().toISOString()}`);
    await runAllRules();
  });

  console.log(`[EscalationCron] Scheduled with pattern "${schedule}" (runs daily at 08:00 IST)`);

  // Also run once immediately on startup in development to make testing easier
  if (process.env.NODE_ENV !== 'production' && process.env.RUN_ESCALATION_ON_STARTUP === 'true') {
    console.log('[EscalationCron] Running escalation rules immediately on startup (dev mode)');
    runAllRules().catch((err) =>
      console.error('[EscalationCron] Startup run failed:', err.message)
    );
  }
}

module.exports = { startEscalationCron };
