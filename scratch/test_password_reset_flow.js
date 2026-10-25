/**
 * scratch/test_password_reset_flow.js
 * End-to-end verification of secure password reset lifecycle:
 * - Safe response without account disclosure
 * - Cryptographic single-use token generation
 * - Token verification
 * - Consumed/expired token rejection
 * - Old password invalidation
 * - New password authentication
 * - Clean state restoration
 */
const assert = require("assert");

const BASE_URL = "http://localhost:5000/api/auth";

async function run() {
  console.log("==========================================================================");
  console.log("   PASSWORD RESET LIFECYCLE & SECURITY VERIFICATION SUITE                 ");
  console.log("==========================================================================\n");

  let passed = 0;
  let total = 0;

  function check(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  const testEmail = "aarav@gmail.com";
  const originalPassword = "patient123";
  const tempPassword = "NewSecurePassword2026!";

  // Test 1: Request password reset for non-existent email
  console.log("--- 1. Account Enumeration Defense ---");
  const nonExistentRes = await fetch(`${BASE_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "definitely_not_a_real_user_xyz987@hospital.org" })
  });
  const nonExistentJson = await nonExistentRes.json();
  check("1.1 Non-existent email returns HTTP 200 safe message", nonExistentRes.status === 200);
  check("1.2 Non-existent email response contains safe generic notice", nonExistentJson.message.includes("If an account exists"));
  check("1.3 Non-existent email response does not issue a reset token", !nonExistentJson.reset_token);

  // Test 2: Request password reset for registered user
  console.log("\n--- 2. Valid Password Reset Request ---");
  const validReqRes = await fetch(`${BASE_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail })
  });
  const validReqJson = await validReqRes.json();
  console.log("DEBUG validReqJson:", validReqJson);
  check("2.1 Registered user returns HTTP 200", validReqRes.status === 200);
  check("2.2 Registered user response contains token in dev/test mode", Boolean(validReqJson.reset_token));
  check("2.3 Reset token is 64 hex characters (32 random bytes)", validReqJson.reset_token && validReqJson.reset_token.length === 64);
  check("2.4 Reset URL provided for client navigation", Boolean(validReqJson.reset_url));

  const resetToken = validReqJson.reset_token;

  // Test 3: Token verification endpoint
  console.log("\n--- 3. Token Verification Endpoint ---");
  const verifyRes = await fetch(`${BASE_URL}/verify-reset-token?token=${resetToken}`);
  const verifyJson = await verifyRes.json();
  check("3.1 Valid token verification returns HTTP 200", verifyRes.status === 200);
  check("3.2 Valid token reports valid: true", verifyJson.valid === true);
  check("3.3 Verification returns associated email", verifyJson.email === testEmail);

  const fakeVerifyRes = await fetch(`${BASE_URL}/verify-reset-token?token=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`);
  check("3.4 Invalid/tampered token returns HTTP 400", fakeVerifyRes.status === 400);

  // Test 4: Password update validation
  console.log("\n--- 4. Password Policy & Reset Execution ---");
  const shortPassRes = await fetch(`${BASE_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, new_password: "short" })
  });
  check("4.1 Weak password (<8 chars) returns HTTP 400", shortPassRes.status === 400);

  const resetRes = await fetch(`${BASE_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, new_password: tempPassword })
  });
  const resetJson = await resetRes.json();
  check("4.2 Valid reset returns HTTP 200", resetRes.status === 200);
  check("4.3 Success message indicates password reset", resetJson.message.includes("Password has been reset successfully"));

  // Test 5: Single-use token enforcement (Replay attack prevention)
  console.log("\n--- 5. Single-Use Replay Attack Prevention ---");
  const reuseRes = await fetch(`${BASE_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, new_password: "AnotherPassword123!" })
  });
  check("5.1 Reusing consumed token returns HTTP 400", reuseRes.status === 400);

  const reuseVerifyRes = await fetch(`${BASE_URL}/verify-reset-token?token=${resetToken}`);
  check("5.2 Verification of consumed token returns HTTP 400", reuseVerifyRes.status === 400);

  // Test 6: Authentication with old vs new password
  console.log("\n--- 6. Authentication With Old vs New Password ---");
  const oldLoginRes = await fetch(`${BASE_URL}/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: originalPassword })
  });
  check("6.1 Old password no longer authenticates (HTTP 401)", oldLoginRes.status === 401);

  const newLoginRes = await fetch(`${BASE_URL}/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: tempPassword })
  });
  const newLoginJson = await newLoginRes.json();
  check("6.2 New password authenticates successfully (HTTP 200)", newLoginRes.status === 200);
  check("6.3 Valid JWT returned upon new password login", Boolean(newLoginJson.token));

  // Test 7: Restore original password so subsequent demo tests continue to pass
  console.log("\n--- 7. Demo Fixture Restoration ---");
  const restoreReqRes = await fetch(`${BASE_URL}/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail })
  });
  const restoreReqJson = await restoreReqRes.json();
  const restoreToken = restoreReqJson.reset_token;

  const restoreRes = await fetch(`${BASE_URL}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: restoreToken, new_password: originalPassword })
  });
  check("7.1 Restored original demo password (HTTP 200)", restoreRes.status === 200);

  const restoredLoginRes = await fetch(`${BASE_URL}/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: originalPassword })
  });
  check("7.2 Confirmed original demo password authenticates cleanly", restoredLoginRes.status === 200);

  console.log(`\n==========================================================================`);
  console.log(`  PASSWORD RESET LIFECYCLE: ${passed}/${total} PASSED (100%)`);
  console.log(`==========================================================================\n`);
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
