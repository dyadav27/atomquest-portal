const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('../frontend/.env', 'utf-8');
const anonKey = env.split('VITE_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].trim();

const supabase = createClient(url, anonKey);

async function runTests() {
  let hasErrors = false;

  console.log('--- Testing Employee Flow ---');
  const { data: empAuth, error: empErr } = await supabase.auth.signInWithPassword({
    email: 'da0236969@gmail.com',
    password: 'Drose#27'
  });
  
  if (empErr) { 
    console.error('❌ Employee Login Failed:', empErr.message); 
    hasErrors = true;
  } else {
    console.log('✅ Employee Login OK');
    const token = empAuth.session.access_token;
    
    try {
      const goalsRes = await fetch('http://localhost:3001/api/goals/my', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(goalsRes.ok) {
         const goals = await goalsRes.json();
         console.log('✅ Employee Goals OK, count:', goals.goals?.length);
      } else {
         console.error('❌ Employee Goals API Failed:', await goalsRes.text());
         hasErrors = true;
      }
    } catch(err) {
      console.error('❌ Fetch failed:', err);
      hasErrors = true;
    }
  }

  console.log('\n--- Testing Manager Flow ---');
  const { data: mgrAuth, error: mgrErr } = await supabase.auth.signInWithPassword({
    email: 'priya@atomquest.com',
    password: 'Drose#27'
  });
  
  if (mgrErr) { 
    console.error('❌ Manager Login Failed:', mgrErr.message); 
    hasErrors = true;
  } else {
    console.log('✅ Manager Login OK');
    const token = mgrAuth.session.access_token;
    
    try {
      const teamRes = await fetch('http://localhost:3001/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(teamRes.ok) {
         const team = await teamRes.json();
         console.log('✅ Manager Team API OK, count:', team.users?.length);
      } else {
         console.error('❌ Manager Team API Failed:', await teamRes.text());
         hasErrors = true;
      }

      const teamGoalsRes = await fetch('http://localhost:3001/api/goals/team', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(teamGoalsRes.ok) {
         const goals = await teamGoalsRes.json();
         console.log('✅ Manager Team Goals API OK, count:', goals.goals?.length);
      } else {
         console.error('❌ Manager Team Goals API Failed:', await teamGoalsRes.text());
         hasErrors = true;
      }

    } catch(err) {
      console.error('❌ Fetch failed:', err);
      hasErrors = true;
    }
  }

  console.log('\n--- Testing Admin Flow ---');
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'admin@atomquest.com',
    password: 'Drose#27'
  });
  
  if (adminErr) { 
    console.error('❌ Admin Login Failed:', adminErr.message); 
    hasErrors = true;
  } else {
    console.log('✅ Admin Login OK');
    const token = adminAuth.session.access_token;
    
    try {
      const auditRes = await fetch('http://localhost:3001/api/audit', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(auditRes.ok) {
         const audit = await auditRes.json();
         console.log('✅ Admin Audit API OK, count:', audit.logs?.length);
      } else {
         console.error('❌ Admin Audit API Failed:', await auditRes.text());
         hasErrors = true;
      }

      const escalationsRes = await fetch('http://localhost:3001/api/escalations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(escalationsRes.ok) {
         const esc = await escalationsRes.json();
         console.log('✅ Admin Escalations API OK, count:', esc.escalations?.length);
      } else {
         console.error('❌ Admin Escalations API Failed:', await escalationsRes.text());
         hasErrors = true;
      }
    } catch(err) {
       console.error('❌ Fetch failed:', err);
       hasErrors = true;
    }
  }

  if (hasErrors) {
    console.log('\n⚠️ TEST FINISHED WITH ERRORS');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED');
    process.exit(0);
  }
}

runTests();
