const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('=== TESTING PATIENT SIGNUP, LOGIN & AUTH LOOP RESOLUTION ===\n');

  const timestamp = Date.now();
  const testEmail = `self_reg_pat_${timestamp}@example.com`;
  const testPassword = `SecurePass${timestamp}!`;

  // 1. Test Patient Signup (Self-Registration)
  console.log('[1/7] Testing POST /api/auth/patient/signup (Valid details)...');
  const signupRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Self Reg Patient',
    email: testEmail,
    password: testPassword,
    phone: '9876543210',
    date_of_birth: '1996-08-20',
    gender: 'Female',
    blood_group: 'B+',
    address: 'Pune, Maharashtra'
  });

  if (signupRes.status !== 201 || !signupRes.data.token) {
    throw new Error(`Signup failed: status ${signupRes.status}, data: ${JSON.stringify(signupRes.data)}`);
  }
  console.log(`      ✓ Created user ID ${signupRes.data.patient.user_id}, patient ID ${signupRes.data.patient.patient_id}`);
  const authToken = signupRes.data.token;

  // 2. Test Duplicate Email Prevention
  console.log('[2/7] Testing POST /api/auth/patient/signup with duplicate email (Must reject)...');
  const dupRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Duplicate Patient',
    email: testEmail,
    password: 'anotherPassword123'
  });
  if (dupRes.status !== 400) {
    throw new Error(`Duplicate signup expected 400, got ${dupRes.status}`);
  }
  console.log(`      ✓ Duplicate email rejected: "${dupRes.data.message}"`);

  // 3. Test Short Password Rejection (< 8 chars)
  console.log('[3/7] Testing POST /api/auth/patient/signup with short password (Must reject)...');
  const shortPassRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Short Pass Patient',
    email: `short_${timestamp}@example.com`,
    password: 'short'
  });
  if (shortPassRes.status !== 400) {
    throw new Error(`Short password expected 400, got ${shortPassRes.status}`);
  }
  console.log(`      ✓ Short password rejected: "${shortPassRes.data.message}"`);

  // 3b. Test Privilege Escalation Rejection (role === 'doctor')
  console.log('      Testing privilege escalation prevention (role: doctor)...');
  const privRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Attacker Doctor',
    email: `attacker_doc_${timestamp}@example.com`,
    password: 'securePassword123',
    role: 'doctor'
  });
  if (privRes.status !== 403) {
    throw new Error(`Privilege escalation expected 403, got ${privRes.status}`);
  }
  console.log(`      ✓ Privilege escalation rejected (403): "${privRes.data.message}"`);

  // 3c. Test Arbitrary ID Injection Rejection
  console.log('      Testing arbitrary user_id / patient_id injection prevention...');
  const idInjectRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'ID Injector',
    email: `idinject_${timestamp}@example.com`,
    password: 'securePassword123',
    patient_id: 1,
    user_id: 1
  });
  if (idInjectRes.status !== 400) {
    throw new Error(`ID injection expected 400, got ${idInjectRes.status}`);
  }
  console.log(`      ✓ Arbitrary ID injection rejected (400): "${idInjectRes.data.message}"`);

  // 3d. Test Malformed Email Rejection
  console.log('      Testing malformed email format prevention...');
  const badEmailRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Bad Email',
    email: 'not-an-email',
    password: 'securePassword123'
  });
  if (badEmailRes.status !== 400) {
    throw new Error(`Malformed email expected 400, got ${badEmailRes.status}`);
  }
  console.log(`      ✓ Malformed email rejected (400): "${badEmailRes.data.message}"`);

  // 4. Test Login with the newly registered credentials
  console.log('[4/7] Testing POST /api/auth/patient/login with newly registered credentials...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: testEmail,
    password: testPassword
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Login failed for newly registered patient: ${JSON.stringify(loginRes.data)}`);
  }
  console.log(`      ✓ Login succeeded, token issued for ${loginRes.data.patient.name}`);

  // 5. Test Access to Protected Profile & Dashboard (Verify no 404/500)
  console.log('[5/7] Testing GET /api/patient/profile & /api/patient/dashboard with issued token...');
  const profileRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/patient/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (profileRes.status !== 200 || !profileRes.data.patient) {
    throw new Error(`Profile fetch failed: status ${profileRes.status}, data: ${JSON.stringify(profileRes.data)}`);
  }
  console.log(`      ✓ Profile retrieved: ${profileRes.data.patient.full_name}, Blood: ${profileRes.data.patient.blood_group}`);

  const dashRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/patient/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (dashRes.status !== 200 || dashRes.data.patient_name !== 'Self Reg Patient') {
    throw new Error(`Dashboard fetch failed: status ${dashRes.status}, data: ${JSON.stringify(dashRes.data)}`);
  }
  console.log(`      ✓ Dashboard retrieved for: ${dashRes.data.patient_name}`);

  // 6. Test Existing Canonical Patient Login (aarav@gmail.com / patient123)
  console.log('[6/7] Testing canonical patient login (aarav@gmail.com / patient123)...');
  const aaravLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'aarav@gmail.com',
    password: 'patient123'
  });
  if (aaravLogin.status !== 200 || !aaravLogin.data.token) {
    throw new Error(`aarav login failed: ${JSON.stringify(aaravLogin.data)}`);
  }
  console.log(`      ✓ Canonical patient logged in: ${aaravLogin.data.patient.name}`);

  // 7. Verify Unactivated Account Rejection (!ACTIVATION_PENDING$)
  console.log('[7/7] Testing login with unactivated patient account (Must return 403)...');
  
  // Register a patient via receptionist (which creates !ACTIVATION_PENDING$ password)
  const recepAuth = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/receptionist/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'receptionist@gmail.com',
    password: 'receptionist123'
  });

  if (recepAuth.status !== 200) {
    throw new Error(`Receptionist auth failed: ${recepAuth.status} ${JSON.stringify(recepAuth.data)}`);
  }

  const unactivatedEmail = `unact_pat_${timestamp}@example.com`;
  const regRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/receptionist/patients',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${recepAuth.data.token}`
    }
  }, {
    full_name: 'Unactivated Patient',
    email: unactivatedEmail,
    phone: '9888877777',
    date_of_birth: '1998-01-01',
    gender: 'Male',
    blood_group: 'O+'
  });

  if (regRes.status !== 201) {
    throw new Error(`Patient registration failed: ${regRes.status} ${JSON.stringify(regRes.data)}`);
  }

  const unactLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/patient/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: unactivatedEmail,
    password: 'anyPassword123'
  });

  if (unactLogin.status !== 403) {
    throw new Error(`Unactivated account expected 403, got ${unactLogin.status}: ${JSON.stringify(unactLogin.data)}`);
  }
  console.log(`      ✓ Unactivated account safely rejected with 403: "${unactLogin.data.message}"`);

  console.log('\n>>> ALL PATIENT SIGNUP & AUTH LOOP TESTS PASSED PERFECTLY! <<<');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
