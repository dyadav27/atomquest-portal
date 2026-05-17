const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('../frontend/.env', 'utf-8');
const anonKey = env.split('VITE_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
const url = env.split('VITE_SUPABASE_URL=')[1].split('\n')[0].trim();

const supabase = createClient(url, anonKey);

const employeesToCreate = [
  { name: 'Anita Desai', email: 'anita@atomquest.com', department: 'Engineering' },
  { name: 'Dev Patel', email: 'dev@atomquest.com', department: 'DevOps' },
  { name: 'Sneha Reddy', email: 'sneha@atomquest.com', department: 'Design' },
  { name: 'Amit Singh', email: 'amit@atomquest.com', department: 'Sales' },
  { name: 'Kavita Joshi', email: 'kavita@atomquest.com', department: 'HR' },
  { name: 'Rohan Verma', email: 'rohan@atomquest.com', department: 'Product' }
];

async function seedEmployees() {
  console.log('--- Provisioning Remaining Employees ---');
  
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

  // 2. Provision Each Employee
  for (const emp of employeesToCreate) {
    console.log(`Creating user: ${emp.name} (${emp.email})...`);
    
    const res = await fetch('http://localhost:3001/api/users', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: emp.name,
        email: emp.email,
        password: 'Drose#27',
        role: 'employee',
        department: emp.department
      })
    });
    
    if (res.ok) {
       console.log(`✅ Successfully created ${emp.name}`);
    } else {
       const errText = await res.text();
       if (errText.includes('already exists') || errText.includes('Email exists')) {
          console.log(`⚠️ ${emp.name} already exists. Skipping.`);
       } else {
          console.error(`❌ Failed to create ${emp.name}:`, errText);
       }
    }
  }

  console.log('🎉 Employee provisioning complete!');
  process.exit(0);
}

seedEmployees();
