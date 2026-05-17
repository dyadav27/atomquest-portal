'use strict';

const { resend } = require('../config/resend');

const FROM_ADDRESS = 'AtomQuest <noreply@atomquest.dev>';

/**
 * Shared email wrapper with error handling.
 * Never throws — logs error and returns false on failure.
 */
async function sendEmail(to, subject, html) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      return false;
    }

    console.log(`[EmailService] Email sent: ${subject} → ${to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[EmailService] Unexpected error sending email:', err.message);
    return false;
  }
}

// ============================================================
// 1. Goal Submitted — notify manager
// ============================================================
async function sendGoalSubmitted(managerEmail, employeeName, goalCount) {
  const subject = `[AtomQuest] ${employeeName} submitted ${goalCount} goal(s) for your approval`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; }
        .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .badge { display: inline-block; background: #ede9fe; color: #6d28d9; border-radius: 999px; padding: 4px 14px; font-weight: 600; font-size: 14px; }
        .cta { display: inline-block; margin-top: 24px; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ AtomQuest — Goal Submission</h1>
          <p>Action required: Review and approve goals</p>
        </div>
        <div class="body">
          <p>Hi,</p>
          <p>
            <strong>${employeeName}</strong> has submitted
            <span class="badge">${goalCount} goal${goalCount !== 1 ? 's' : ''}</span>
            for your review and approval.
          </p>
          <p>
            Please log in to AtomQuest to review the goals, provide feedback, and either
            approve or return them with comments.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/manager/approvals" class="cta">
            Review Goals →
          </a>
        </div>
        <div class="footer">
          <p>AtomQuest — In-House Goal Setting & Tracking Portal. Do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(managerEmail, subject, html);
}

// ============================================================
// 2. Goal Approved — notify employee
// ============================================================
async function sendGoalApproved(employeeEmail, managerName) {
  const subject = `[AtomQuest] Your goals have been approved by ${managerName}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; }
        .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
        .success-box p { margin: 0; color: #065f46; font-weight: 600; }
        .cta { display: inline-block; margin-top: 24px; background: #10b981; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ AtomQuest — Goals Approved</h1>
          <p>Your goal sheet is now locked for this cycle</p>
        </div>
        <div class="body">
          <p>Hi,</p>
          <div class="success-box">
            <p>🎉 Your goals have been approved and locked by <strong>${managerName}</strong>.</p>
          </div>
          <p>
            Your goals are now locked for this cycle. You can view your approved goals
            and begin tracking your quarterly check-ins via the AtomQuest portal.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-goals" class="cta">
            View My Goals →
          </a>
        </div>
        <div class="footer">
          <p>AtomQuest — In-House Goal Setting & Tracking Portal. Do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(employeeEmail, subject, html);
}

// ============================================================
// 3. Goal Returned — notify employee with feedback
// ============================================================
async function sendGoalReturned(employeeEmail, managerName, feedback) {
  const subject = `[AtomQuest] Your goals require revision — feedback from ${managerName}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; }
        .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .feedback-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
        .feedback-box p { margin: 0; color: #92400e; }
        .cta { display: inline-block; margin-top: 24px; background: #f59e0b; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 AtomQuest — Goals Returned for Revision</h1>
          <p>Please revise and resubmit your goals</p>
        </div>
        <div class="body">
          <p>Hi,</p>
          <p>
            Your manager <strong>${managerName}</strong> has returned your goal sheet
            with the following feedback:
          </p>
          <div class="feedback-box">
            <p>${feedback || 'Please revise your goals and resubmit for approval.'}</p>
          </div>
          <p>
            Please update your goals in AtomQuest and resubmit for approval before the
            goal-setting window closes.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-goals" class="cta">
            Revise My Goals →
          </a>
        </div>
        <div class="footer">
          <p>AtomQuest — In-House Goal Setting & Tracking Portal. Do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(employeeEmail, subject, html);
}

// ============================================================
// 4. Checkin Reminder — notify employee
// ============================================================
async function sendCheckinReminder(employeeEmail, quarter, deadlineDate) {
  const quarterLabel = quarter.toUpperCase();
  const formattedDate = new Date(deadlineDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subject = `[AtomQuest] ${quarterLabel} Check-in Due — Deadline: ${formattedDate}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; }
        .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .deadline-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin: 16px 0; text-align: center; }
        .deadline-box .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .deadline-box .date { font-size: 22px; font-weight: 700; color: #1d4ed8; margin-top: 4px; }
        .cta { display: inline-block; margin-top: 24px; background: #3b82f6; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 AtomQuest — ${quarterLabel} Check-in Reminder</h1>
          <p>Please submit your quarterly progress update</p>
        </div>
        <div class="body">
          <p>Hi,</p>
          <p>
            The <strong>${quarterLabel} check-in window is now open</strong>.
            Please submit your progress update for all approved goals before the deadline.
          </p>
          <div class="deadline-box">
            <div class="label">Submission Deadline</div>
            <div class="date">${formattedDate}</div>
          </div>
          <p>
            Log in to AtomQuest, navigate to your goals, and enter the actual values
            for each goal this quarter. Late submissions may trigger an escalation.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/checkins" class="cta">
            Submit Check-in →
          </a>
        </div>
        <div class="footer">
          <p>AtomQuest — In-House Goal Setting & Tracking Portal. Do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(employeeEmail, subject, html);
}

// ============================================================
// 5. Escalation Alert — notify recipient
// ============================================================
async function sendEscalationAlert(recipientEmail, employeeName, ruleType, level) {
  const ruleLabels = {
    goal_not_submitted: 'Goal Not Submitted',
    approval_delayed: 'Approval Delayed',
    checkin_missed: 'Check-in Missed',
  };

  const levelLabels = {
    1: 'Level 1 — Employee Notified',
    2: 'Level 2 — Manager Notified',
    3: 'Level 3 — HR Notified',
  };

  const ruleLabel = ruleLabels[ruleType] || ruleType;
  const levelLabel = levelLabels[level] || `Level ${level}`;

  const subject = `[AtomQuest] Escalation Alert — ${ruleLabel} for ${employeeName}`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 32px 40px; }
        .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
        .alert-box .rule { font-weight: 700; color: #dc2626; font-size: 16px; }
        .alert-box .meta { color: #6b7280; font-size: 13px; margin-top: 8px; }
        .badge { display: inline-block; background: #fee2e2; color: #b91c1c; border-radius: 999px; padding: 3px 12px; font-weight: 600; font-size: 12px; }
        .cta { display: inline-block; margin-top: 24px; background: #ef4444; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
        .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 40px; font-size: 12px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 AtomQuest — Escalation Alert</h1>
          <p>Immediate attention required</p>
        </div>
        <div class="body">
          <p>Hi,</p>
          <p>
            An escalation has been triggered for employee <strong>${employeeName}</strong>.
          </p>
          <div class="alert-box">
            <div class="rule">${ruleLabel}</div>
            <div class="meta">
              Escalation level: <span class="badge">${levelLabel}</span>
            </div>
          </div>
          <p>
            Please log in to AtomQuest to review the situation and take appropriate action.
            Timely resolution will prevent further escalation.
          </p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/escalations" class="cta">
            View Escalations →
          </a>
        </div>
        <div class="footer">
          <p>AtomQuest — In-House Goal Setting & Tracking Portal. Do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendEmail(recipientEmail, subject, html);
}

module.exports = {
  sendGoalSubmitted,
  sendGoalApproved,
  sendGoalReturned,
  sendCheckinReminder,
  sendEscalationAlert,
};
