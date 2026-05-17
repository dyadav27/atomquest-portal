'use strict';

const cron = require('node-cron');
const { supabase } = require('../config/supabase');
const { sendCheckinReminder } = require('../services/emailService');

/**
 * Starts the check-in reminder cron job.
 * Runs every day at 9:00 AM IST (3:30 AM UTC).
 * On the opening day of each quarter window, sends reminder emails to all employees.
 */
function startCheckinReminderCron() {
  const schedule = process.env.CHECKIN_REMINDER_CRON || '30 3 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[CheckinReminderCron] Invalid cron schedule: "${schedule}"`);
    return;
  }

  cron.schedule(schedule, async () => {
    console.log(`[CheckinReminderCron] Triggered at ${new Date().toISOString()}`);
    await runCheckinReminders();
  });

  console.log(`[CheckinReminderCron] Scheduled with pattern "${schedule}" (runs daily at 09:00 IST)`);
}

async function runCheckinReminders() {
  try {
    const { data: cycle, error: cycleErr } = await supabase
      .from('goal_cycles')
      .select('*')
      .eq('is_active', true)
      .single();

    if (cycleErr || !cycle) {
      console.log('[CheckinReminderCron] No active cycle found — skipping');
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const quarters = ['q1', 'q2', 'q3', 'q4'];

    for (const q of quarters) {
      const opensStr = cycle[`${q}_opens`]; // e.g. "2025-04-01"
      const closesStr = cycle[`${q}_closes`];

      if (!opensStr) continue;

      // Send reminder on the OPENING day of the quarter window
      if (opensStr === todayStr) {
        console.log(`[CheckinReminderCron] ${q.toUpperCase()} window opened today — sending reminders`);

        const { data: employees, error: empErr } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('role', 'employee');

        if (empErr || !employees || employees.length === 0) {
          console.warn('[CheckinReminderCron] No employees found');
          continue;
        }

        const closes = new Date(closesStr);
        const deadline = closes.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        let sent = 0;
        for (const emp of employees) {
          const success = await sendCheckinReminder(emp.email, q, closesStr);
          if (success) sent++;
        }

        console.log(`[CheckinReminderCron] Sent ${q.toUpperCase()} reminders to ${sent}/${employees.length} employees (deadline: ${deadline})`);
      }
    }
  } catch (err) {
    console.error('[CheckinReminderCron] Unexpected error:', err.message);
  }
}

module.exports = { startCheckinReminderCron, runCheckinReminders };
