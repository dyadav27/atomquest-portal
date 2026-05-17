require('dotenv').config();
const { sendEscalationAlert, sendGoalApproved } = require('./src/services/emailService');

async function triggerDemoEmails() {
  console.log('--- Sending Demo Emails via Resend API ---');

  const targetEmails = [
    'suresh109823@gmail.com'
  ];

  try {
    for (const email of targetEmails) {
      console.log(`\nSending Escalation Alert to: ${email}`);
      
      // Send an Escalation Alert
      const escalationResult = await sendEscalationAlert(
        email, 
        'Dev Patel', 
        'checkin_missed', 
        1
      );
      
      if (escalationResult.id) {
        console.log(`✅ Escalation Email sent successfully! (ID: ${escalationResult.id})`);
      }

      console.log(`Sending Goal Approval Email to: ${email}`);
      
      // Send a Goal Approved notification
      const approvalResult = await sendGoalApproved(
        email,
        'Priya Sharma'
      );

      if (approvalResult.id) {
        console.log(`✅ Approval Email sent successfully! (ID: ${approvalResult.id})`);
      }
    }
    
    console.log('\n🎉 All demo emails triggered successfully! Check your inbox (and spam folder).');
  } catch (error) {
    console.error('❌ Failed to send emails:', error.message);
  }
}

triggerDemoEmails();
