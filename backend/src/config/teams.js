'use strict';

/**
 * Microsoft Teams Incoming Webhook configuration.
 * The webhook URL is a Teams channel connector URL that accepts
 * Adaptive Card payloads.
 */
const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;

if (!teamsWebhookUrl) {
  console.warn('[Teams] TEAMS_WEBHOOK_URL not set — Teams notifications will be skipped');
}

module.exports = { teamsWebhookUrl };
