const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('../frontend/.env', 'utf-8');
const anonKey = env.split('VITE_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].trim();

// Use Service Role to bypass RLS for quick seeding
const backendEnv = fs.readFileSync('.env', 'utf-8');
const serviceKey = backendEnv.split('SUPABASE_SERVICE_ROLE_KEY=')[1].split('\n')[0].trim();

const supabase = createClient(url, serviceKey);

async function prepareDemoState() {
  console.log('--- Preparing Perfect Demo State ---');

  // 1. Fix Cycle Bug (Ensure only FY 2025-26 is active)
  console.log('1. Fixing Goal Cycles...');
  await supabase.from('goal_cycles').update({ is_active: false }).neq('name', 'FY 2025-26');
  await supabase.from('goal_cycles').update({ is_active: true }).eq('name', 'FY 2025-26');
  
  const { data: cycle } = await supabase.from('goal_cycles').select('id').eq('name', 'FY 2025-26').single();
  const cycleId = cycle.id;

  // 2. Fetch Users
  const { data: users } = await supabase.from('users').select('*');
  const rahul = users.find(u => u.email === 'employee@example.com' || u.name === 'Rahul Mehta');
  const priya = users.find(u => u.email === 'priya@atomquest.com');
  const dev = users.find(u => u.email === 'dev@atomquest.com');
  
  // 3. Create a Submitted Goal for Dev Patel (So Manager Priya can approve it)
  console.log('2. Creating Submitted Goal for Approval Queue...');
  await supabase.from('goals').delete().eq('user_id', dev.id); // clean up
  const { data: devGoal } = await supabase.from('goals').insert({
    user_id: dev.id,
    cycle_id: cycleId,
    title: 'Migrate to Cloud Infrastructure',
    description: 'Move all legacy servers to AWS',
    thrust_area: 'Operations',
    unit_of_measurement: 'Percentage',
    target_value: 100,
    weightage: 100,
    status: 'submitted'
  }).select().single();

  // 4. Create an Active Check-in for Rahul (So Manager Priya can review it)
  console.log('3. Creating Check-in for Review...');
  const { data: rahulGoals } = await supabase.from('goals').select('id').eq('user_id', rahul.id).eq('status', 'approved');
  if (rahulGoals && rahulGoals.length > 0) {
    await supabase.from('checkins').delete().eq('goal_id', rahulGoals[0].id).eq('quarter', 'q1');
    await supabase.from('checkins').insert({
      goal_id: rahulGoals[0].id,
      quarter: 'q1',
      actual_value: 45,
      comments: 'Made solid progress on the UI framework this quarter.',
      status: 'submitted',
      employee_id: rahul.id
    });
  }

  // 5. Create an Escalation for Admin to see
  console.log('4. Creating Dummy Escalation...');
  await supabase.from('escalations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('escalations').insert({
    employee_id: dev.id,
    manager_id: priya.id,
    type: 'missed_checkin',
    severity: 'high',
    status: 'active',
    details: 'Dev missed the Q1 Check-in deadline by 4 days.'
  });

  console.log('🎉 Demo State Preparation Complete! The portal is now perfectly staged.');
  process.exit(0);
}

prepareDemoState();
