const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('../frontend/.env', 'utf-8');
const anonKey = env.split('VITE_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].trim();

const supabase = createClient(url, anonKey);

async function testUserManagement() {
  console.log('--- Testing Admin User Management ---');
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'admin@atomquest.com',
    password: 'Drose#27'
  });
  
  if (adminErr) { 
    console.error('❌ Admin Login Failed:', adminErr.message); 
    process.exit(1);
  }
  console.log('✅ Admin Login OK');
  const token = adminAuth.session.access_token;
  
  // 1. Create User
  console.log('Creating Test User...');
  const createRes = await fetch('http://localhost:3001/api/users', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test User',
      email: 'testuser23456@atomquest.com',
      password: 'Drose#27',
      role: 'employee',
      department: 'Testing'
    })
  });
  
  let newUserId;
  if(createRes.ok) {
     const data = await createRes.json();
     newUserId = data.user.id;
     console.log('✅ Created User:', newUserId);
  } else {
     console.error('❌ Failed to create user:', await createRes.text());
     process.exit(1);
  }

  // 2. Fetch Users to verify it's there
  console.log('Fetching Users...');
  const getRes = await fetch('http://localhost:3001/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if(getRes.ok) {
     const data = await getRes.json();
     const found = data.users.find(u => u.id === newUserId);
     if (found) {
       console.log('✅ User found in listing');
     } else {
       console.error('❌ User NOT found in listing');
       process.exit(1);
     }
  } else {
     console.error('❌ Failed to fetch users:', await getRes.text());
     process.exit(1);
  }

  // 3. Delete User
  console.log('Deleting Test User...');
  const deleteRes = await fetch(`http://localhost:3001/api/users/${newUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if(deleteRes.ok) {
     console.log('✅ User deleted successfully');
  } else {
     console.error('❌ Failed to delete user:', await deleteRes.text());
     process.exit(1);
  }

  console.log('🎉 Admin User Management Test Passed!');
  process.exit(0);
}

testUserManagement();
