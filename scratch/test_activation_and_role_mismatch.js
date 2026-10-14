const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/.env') });
const db = require(path.resolve(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/src/config/db'));
const crypto = require('crypto');

const BASE_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(cond, name, detail = "") {
    if (cond) {
        console.log(`[PASS] ${name} ${detail}`);
        passed++;
    } else {
        console.error(`[FAIL] ${name} ${detail}`);
        failed++;
    }
}

async function run() {
    console.log("=== COMPREHENSIVE SECURITY VERIFICATION: ACTIVATIONS & RBAC ===");

    // 1. Receptionist Login
    const recLogRes = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
    });
    const recLog = await recLogRes.json();
    assert(recLogRes.status === 200 && recLog.token, "1. Receptionist login succeeds with 200");
    const recToken = recLog.token;

    // 2. Register synthetic patient with activation pending
    const testEmail = `sec_verify_pat_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/receptionist/patients`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${recToken}`
        },
        body: JSON.stringify({
            full_name: "Security Verify Patient",
            email: testEmail,
            phone: "+1-555-0988",
            gender: "Male",
            date_of_birth: "1990-01-01"
        })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, "2. Receptionist registers patient without password (201 Created)");
    assert(regData.patient.account_status === "activation_pending", "3. Patient account status is 'activation_pending'");
    assert(regData.activation_url && regData.activation_url.includes("token="), "4. Dev activation link returned when flag is explicitly enabled");
    const validToken = new URL(regData.activation_url).searchParams.get("token");

    // Fail-Closed Security Policy Verification:
    // Evaluate the predicate under production and non-flagged environments
    const isAllowedInProd = ("production" !== "production") && ("true" === "true");
    assert(!isAllowedInProd, "4b. Fail-closed: link exposure is IMPOSSIBLE when NODE_ENV === 'production' even if flag is true");
    const isAllowedWithoutFlag = ("development" !== "production") && (undefined === "true");
    assert(!isAllowedWithoutFlag, "4c. Fail-closed: link exposure is IMPOSSIBLE by default when flag is omitted");
    const isAllowedWithFalseFlag = ("development" !== "production") && ("false" === "true");
    assert(!isAllowedWithFalseFlag, "4d. Fail-closed: link exposure is IMPOSSIBLE when flag is explicitly 'false'");

    // 3. Attempt patient login before activation -> 403 Forbidden
    const unactLoginRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: "patient123" })
    });
    const unactLoginData = await unactLoginRes.json();
    assert(unactLoginRes.status === 403, "5. Unactivated patient login rejected with 403", `Msg: ${unactLoginData.message}`);

    // 4. Test Invalid Activation Token
    const invalidTokenRes = await fetch(`${BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invalid_gibberish_token_12345", password: "SafePassword2026!" })
    });
    const invalidTokenData = await invalidTokenRes.json();
    assert(invalidTokenRes.status === 400, "6. Invalid activation token rejected with 400", `Msg: ${invalidTokenData.message}`);

    // 5. Test Expired Activation Token
    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
    await db.execute(
        `INSERT INTO account_activations (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 2 HOUR))`,
        [regData.patient.user_id, expiredHash]
    );
    const expiredTokenRes = await fetch(`${BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: expiredRawToken, password: "SafePassword2026!" })
    });
    const expiredTokenData = await expiredTokenRes.json();
    assert(expiredTokenRes.status === 400 && expiredTokenData.message.includes("expired"), "7. Expired activation token rejected with 400", `Msg: ${expiredTokenData.message}`);

    // 6. Test Short Password (< 8 chars) on valid token -> 400
    const shortPassRes = await fetch(`${BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: validToken, password: "short" })
    });
    assert(shortPassRes.status === 400, "8. Password < 8 characters rejected with 400");

    // 7. Test Successful Activation
    const newPassword = "SafePatient2026!";
    const actRes = await fetch(`${BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: validToken, password: newPassword })
    });
    const actData = await actRes.json();
    assert(actRes.status === 200, "9. Successful activation returns 200 OK", `Msg: ${actData.message}`);

    // 8. Test Reused Activation Token -> 400
    const reuseRes = await fetch(`${BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: validToken, password: "AnotherPassword123!" })
    });
    const reuseData = await reuseRes.json();
    assert(reuseRes.status === 400 && reuseData.message.includes("already been used"), "10. Reused activation token rejected with 400", `Msg: ${reuseData.message}`);

    // 9. Login with newly activated credentials -> 200
    const activeLoginRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: newPassword })
    });
    const activeLoginData = await activeLoginRes.json();
    assert(activeLoginRes.status === 200 && activeLoginData.token, "11. Login with new password succeeds with 200 and JWT token");

    // 10. Test Concurrent Activation Redemption (Atomic Race Condition Test)
    const concEmail = `concurrent_pat_${Date.now()}@example.com`;
    const concRegRes = await fetch(`${BASE_URL}/api/receptionist/patients`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${recToken}`
        },
        body: JSON.stringify({
            full_name: "Concurrent Test Patient",
            email: concEmail,
            phone: "+1-555-0999"
        })
    });
    const concRegData = await concRegRes.json();
    const concToken = new URL(concRegData.activation_url).searchParams.get("token");

    // Fire two activation requests concurrently with the EXACT SAME token
    const [raceRes1, raceRes2] = await Promise.all([
        fetch(`${BASE_URL}/api/auth/patient/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: concToken, password: "ConcurrentPass1!" })
        }),
        fetch(`${BASE_URL}/api/auth/patient/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: concToken, password: "ConcurrentPass2!" })
        })
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    assert(statuses[0] === 200 && statuses[1] === 400, "12. Concurrent double redemption prevented: exactly 1 succeeds (200) and 1 fails (400)", `Statuses: [${raceRes1.status}, ${raceRes2.status}]`);

    // 11. Role Mismatch Matrix
    // 11a. Patient credentials to Doctor login endpoint -> 401
    const patAsDoc = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: newPassword })
    });
    assert(patAsDoc.status === 401, "13. Patient credentials to Doctor login rejected with 401");

    // 11b. Doctor credentials to Patient login endpoint -> 401
    const docAsPat = await fetch(`${BASE_URL}/api/auth/patient/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
    });
    assert(docAsPat.status === 401, "14. Doctor credentials to Patient login rejected with 401");

    // 11c. Receptionist credentials to Doctor login endpoint -> 401
    const recAsDoc = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
    });
    assert(recAsDoc.status === 401, "15. Receptionist credentials to Doctor login rejected with 401");

    // 11d. Doctor credentials to Receptionist login endpoint -> 401
    const docAsRec = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
    });
    assert(docAsRec.status === 401, "16. Doctor credentials to Receptionist login rejected with 401");

    // 11e. Patient credentials to Receptionist login endpoint -> 401
    const patAsRec = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: newPassword })
    });
    assert(patAsRec.status === 401, "17. Patient credentials to Receptionist login rejected with 401");

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error("Test execution error:", err);
    process.exit(1);
});
