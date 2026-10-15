/**
 * Comprehensive Backend RBAC & Client Tampering Security Regression Suite
 * 
 * Verifies that:
 * 1. Unauthenticated requests to protected Doctor/Patient/Receptionist routes return 401.
 * 2. Fabricated tokens (tampered signatures) return 401.
 * 3. Expired tokens return 401.
 * 4. Cross-role privilege escalation (Patient -> Doctor, Receptionist -> Doctor) returns 403.
 * 5. Request body role spoofing (e.g. { role: "doctor" }) cannot grant access.
 * 6. Doctor attempting to access Patient dashboard returns 403.
 * 7. Legitimate Doctor and Patient logins obtain verified server JWTs.
 */

const path = require("path");
let jwt;
try {
  jwt = require("jsonwebtoken");
} catch {
  jwt = require(path.resolve(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/jsonwebtoken"));
}

const BASE_URL = "http://127.0.0.1:5000";

async function runSecuritySuite() {
  console.log("=== STARTING AUTH & TAMPERING SECURITY REGRESSION SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Obtain legitimate server JWTs via real server login
  let realDoctorToken = null;
  let realPatientToken = null;
  let realReceptionistToken = null;

  try {
    const docRes = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
    });
    const docData = await docRes.json();
    assert(docRes.status === 200 && docData.token, `Legitimate Doctor login succeeds with server-signed JWT`);
    realDoctorToken = docData.token;
  } catch (err) {
    assert(false, `Doctor login error: ${err.message}`);
  }

  try {
    const patRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "aarav@gmail.com", password: "patient123" })
    });
    const patData = await patRes.json();
    assert(patRes.status === 200 && patData.token, `Legitimate Patient login succeeds with server-signed JWT`);
    realPatientToken = patData.token;
  } catch (err) {
    assert(false, `Patient login error: ${err.message}`);
  }

  try {
    const recRes = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
    });
    const recData = await recRes.json();
    assert(recRes.status === 200 && recData.token, `Legitimate Receptionist login succeeds with server-signed JWT`);
    realReceptionistToken = recData.token;
  } catch (err) {
    assert(false, `Receptionist login error: ${err.message}`);
  }

  // 2. Generate tampered and forged tokens
  const forgedSecretToken = jwt.sign({ id: 99, email: "attacker@evil.com", role: "doctor" }, "completely_wrong_secret", { expiresIn: "1h" });
  const expiredDoctorToken = jwt.sign({ id: 1, email: "doctor@gmail.com", role: "doctor" }, "rag_healthcare_secret", { expiresIn: "-10s" });

  // Test: Unauthenticated request to /api/doctor/dashboard -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/dashboard`);
    assert(res.status === 401, `Unauthenticated GET /api/doctor/dashboard returns 401 (got ${res.status})`);
    const data = await res.json();
    assert(data.message === "Authentication token required", `Expected 'Authentication token required' message`);
  } catch (err) {
    assert(false, `Unauthenticated test error: ${err.message}`);
  }

  // Test: Forged signature token to /api/doctor/dashboard -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${forgedSecretToken}` }
    });
    assert(res.status === 401, `Forged token GET /api/doctor/dashboard returns 401 (got ${res.status})`);
    const data = await res.json();
    assert(data.message === "Invalid or expired token", `Expected 'Invalid or expired token' message`);
  } catch (err) {
    assert(false, `Forged token test error: ${err.message}`);
  }

  // Test: Expired token to /api/doctor/dashboard -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${expiredDoctorToken}` }
    });
    assert(res.status === 401, `Expired token GET /api/doctor/dashboard returns 401 (got ${res.status})`);
  } catch (err) {
    assert(false, `Expired token test error: ${err.message}`);
  }

  // Test: Patient token attempting to access Doctor route -> 403
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${realPatientToken}` }
    });
    assert(res.status === 403, `Patient token GET /api/doctor/dashboard returns 403 (got ${res.status})`);
    const data = await res.json();
    assert(data.message === "Doctor access required", `Expected 'Doctor access required' message`);
  } catch (err) {
    assert(false, `Cross-role test error: ${err.message}`);
  }

  // Test: Receptionist token attempting to access Doctor route -> 403
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/dashboard`, {
      headers: { Authorization: `Bearer ${realReceptionistToken}` }
    });
    assert(res.status === 403, `Receptionist token GET /api/doctor/dashboard returns 403 (got ${res.status})`);
    const data = await res.json();
    assert(data.message.includes("Administrative roles are not permitted"), `Expected administrative restriction message`);
  } catch (err) {
    assert(false, `Receptionist cross-role test error: ${err.message}`);
  }

  // Test: Request body role spoofing with Patient token -> 403
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/prescriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${realPatientToken}`
      },
      body: JSON.stringify({
        role: "doctor",
        userRole: "doctor",
        user: { role: "doctor", id: 1 },
        patient_id: 1,
        diagnosis: "Malicious injection attempt"
      })
    });
    assert(res.status === 403, `Body-spoofed role POST /api/doctor/prescriptions returns 403 (got ${res.status})`);
  } catch (err) {
    assert(false, `Body spoofing test error: ${err.message}`);
  }

  // Test: Doctor token attempting to access Patient dashboard -> 403
  try {
    const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      headers: { Authorization: `Bearer ${realDoctorToken}` }
    });
    assert(res.status === 403, `Doctor token GET /api/patient/dashboard returns 403 (got ${res.status})`);
  } catch (err) {
    assert(false, `Doctor cross-role test error: ${err.message}`);
  }

  // Test: Receptionist token attempting to access Patient dashboard -> 403
  try {
    const res = await fetch(`${BASE_URL}/api/patient/dashboard`, {
      headers: { Authorization: `Bearer ${realReceptionistToken}` }
    });
    assert(res.status === 403, `Receptionist token GET /api/patient/dashboard returns 403 (got ${res.status})`);
  } catch (err) {
    assert(false, `Receptionist cross-role test error: ${err.message}`);
  }

  // Test: Valid Doctor token accessing Doctor profile -> 200
  try {
    const res = await fetch(`${BASE_URL}/api/doctor/profile`, {
      headers: { Authorization: `Bearer ${realDoctorToken}` }
    });
    assert(res.status === 200, `Valid Doctor token GET /api/doctor/profile returns 200 (got ${res.status})`);
  } catch (err) {
    assert(false, `Valid Doctor profile error: ${err.message}`);
  }

  // Test: Valid Patient token accessing Patient profile -> 200
  try {
    const res = await fetch(`${BASE_URL}/api/patient/profile`, {
      headers: { Authorization: `Bearer ${realPatientToken}` }
    });
    assert(res.status === 200, `Valid Patient token GET /api/patient/profile returns 200 (got ${res.status})`);
  } catch (err) {
    assert(false, `Valid Patient profile error: ${err.message}`);
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite();
