'use strict';

const { teamsWebhookUrl } = require('../config/teams');

/**
 * Sends a Teams Adaptive Card via incoming webhook.
 * Returns false (never throws) if webhook URL is not configured.
 *
 * @param {object} card - Adaptive Card JSON payload
 * @returns {Promise<boolean>}
 */
async function sendAdaptiveCard(card) {
  if (!teamsWebhookUrl) {
    console.warn('[TeamsService] Webhook URL not configured — skipping Teams notification');
    return false;
  }

  try {
    const response = await fetch(teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[TeamsService] Webhook responded with ${response.status}: ${body}`);
      return false;
    }

    console.log('[TeamsService] Adaptive Card sent successfully');
    return true;
  } catch (err) {
    console.error('[TeamsService] Failed to send Teams notification:', err.message);
    return false;
  }
}

// ============================================================
// 1. Goal Submitted Card
// ============================================================
async function sendGoalSubmittedCard(employeeName, goalCount, deepLink) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = deepLink || `${frontendUrl}/manager/approvals`;

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'TextBlock',
                  text: '⚡ AtomQuest — Goal Submission',
                  weight: 'Bolder',
                  size: 'Medium',
                  color: 'Accent',
                },
              ],
            },
            {
              type: 'Container',
              items: [
                {
                  type: 'TextBlock',
                  text: `**${employeeName}** has submitted **${goalCount} goal${goalCount !== 1 ? 's' : ''}** for your approval.`,
                  wrap: true,
                  spacing: 'Medium',
                },
                {
                  type: 'TextBlock',
                  text: 'Please review and approve or return the goals in AtomQuest.',
                  wrap: true,
                  color: 'Default',
                  isSubtle: true,
                },
              ],
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: '🔍 Review Goals',
              url: link,
              style: 'positive',
            },
          ],
          msteams: {
            width: 'Full',
          },
        },
      },
    ],
  };

  return sendAdaptiveCard(card);
}

// ============================================================
// 2. Escalation Alert Card
// ============================================================
async function sendEscalationCard(employeeName, ruleType, deepLink) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = deepLink || `${frontendUrl}/admin/escalations`;

  const ruleLabels = {
    goal_not_submitted: 'Goal Not Submitted',
    approval_delayed: 'Approval Delayed',
    checkin_missed: 'Check-in Missed',
  };
  const ruleLabel = ruleLabels[ruleType] || ruleType;

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'attention',
              items: [
                {
                  type: 'TextBlock',
                  text: '🚨 AtomQuest — Escalation Alert',
                  weight: 'Bolder',
                  size: 'Medium',
                  color: 'Attention',
                },
              ],
            },
            {
              type: 'Container',
              items: [
                {
                  type: 'FactSet',
                  facts: [
                    { title: 'Employee', value: employeeName },
                    { title: 'Rule Triggered', value: ruleLabel },
                    { title: 'Timestamp', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' },
                  ],
                  spacing: 'Medium',
                },
                {
                  type: 'TextBlock',
                  text: 'Immediate action required. Please log in to AtomQuest to resolve this escalation.',
                  wrap: true,
                  color: 'Attention',
                  spacing: 'Medium',
                },
              ],
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: '🚀 Open AtomQuest Portal',
              url: link,
              style: 'destructive',
            },
          ],
          msteams: {
            width: 'Full',
          },
        },
      },
    ],
  };

  return sendAdaptiveCard(card);
}

module.exports = { sendGoalSubmittedCard, sendEscalationCard };
