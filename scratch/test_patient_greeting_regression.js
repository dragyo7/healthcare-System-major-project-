const axios = require('axios');
const assert = require('assert');

async function testGreetingRegression() {
  console.log('--- Testing Patient Assistant Greetings in Express Bridge ---');
  
  // 1. Authenticate as demo patient (aarav@gmail.com)
  const loginRes = await axios.post('http://localhost:5000/api/auth/patient/login', {
    email: 'aarav@gmail.com',
    password: 'patient123'
  });
  const token = loginRes.data.token;
  assert(token, 'Must receive patient JWT');
  console.log('[PASS] Logged in as aarav@gmail.com');

  // 2. Test natural greeting 'hello'
  const chatRes = await axios.post(
    'http://localhost:5000/api/patient/cds',
    { clinical_query: 'hello', language: 'en' },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('Status code:', chatRes.status);
  console.log('Response verification status:', chatRes.data.verification_status);
  console.log('Response pipeline mode:', chatRes.data.pipeline_mode);
  console.log('Answer text:', chatRes.data.reply);
  
  assert.strictEqual(chatRes.data.verification_status, 'conversational_greeting', 'Status must be conversational_greeting');
  assert.strictEqual(chatRes.data.abstained, false, 'Must not abstain on greeting');
  assert(chatRes.data.answer.toLowerCase().includes('hello') || chatRes.data.answer.toLowerCase().includes('welcome'), 'Reply must be friendly greeting');
  console.log('[PASS] Greeting "hello" succeeded without policy abstention!');

  // 3. Test Hindi greeting 'नमस्ते'
  const hiRes = await axios.post(
    'http://localhost:5000/api/patient/cds',
    { clinical_query: 'नमस्ते', language: 'hi' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(hiRes.data.verification_status, 'conversational_greeting');
  console.log('[PASS] Greeting "नमस्ते" succeeded without policy abstention!');

  // 4. Test discharge medication timing
  const timingRes = await axios.post(
    'http://localhost:5000/api/patient/cds',
    { clinical_query: 'What time should I take my medicine?', language: 'en' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(timingRes.data.verification_status, 'verified_grounded');
  console.log('[PASS] Discharge query "What time should I take my medicine?" grounded in EHR records!');

  console.log('=== ALL PATIENT ASSISTANT EXPRESS BRIDGE REGRESSIONS PASSED ===');
}

testGreetingRegression().catch(err => {
  console.error('[FAIL]', err.response ? err.response.data : err.message);
  process.exit(1);
});
