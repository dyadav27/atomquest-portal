const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('../frontend/.env', 'utf-8');
const anonKey = env.split('VITE_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].trim();

const supabase = createClient(url, anonKey);

async function addSuresh() {
  console.log('--- Provisioning Suresh ---');
  
  // 1. Login as Admin
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'admin@atomquest.com',
    password: 'Drose#27'
  });
  
  if (adminErr) { 
    console.error('❌ Admin Login Failed:', adminErr.message); 
    process.exit(1);
  }
  const token = adminAuth.session.access_token;

  // 2. Find Priya's ID
  const { data: priya } = await supabase.from('users').select('id').eq('email', 'priya@atomquest.com').single();

  // 3. Provision Suresh
  const res = await fetch('http://localhost:3001/api/users', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Suresh Kumar',
      email: 'suresh109823@gmail.com',
      password: 'Drose#27',
      role: 'employee',
      department: 'Engineering',
      manager_id: priya.id
    })
  });
  
  if (res.ok) {
     console.log(`✅ Successfully created Suresh!`);
  } else {
     const errText = await res.text();
     console.error(`❌ Failed to create Suresh:`, errText);
  }

  process.exit(0);
}

addSuresh();
