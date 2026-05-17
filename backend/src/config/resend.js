'use strict';

const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('[Resend] RESEND_API_KEY not set — email sending will fail');
}

const resend = new Resend(resendApiKey);

module.exports = { resend };
