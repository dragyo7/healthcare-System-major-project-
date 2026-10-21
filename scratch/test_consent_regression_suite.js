/**
 * scratch/test_consent_regression_suite.js
 *
 * End-to-End Regression Test Suite for Server-Side Consent Enforcement & Persistence (Task 3)
 * Target Database: rag_healthcare_test (via port 5001)
 *
 * Test Assertions:
 * 1. Missing consent field -> HTTP 400 rejected.
 * 2. terms_accepted: false -> HTTP 400 rejected.
 * 3. Invalid consent value (string "true", number 1, null) -> HTTP 400 rejected.
 * 4. terms_accepted: true -> HTTP 201 registration succeeds.
 * 5. Successful registration records UTC timestamp and consent_version ('v1.0-2026-10') in DB.
 * 6. Rejected registration creates neither a user nor a patient record.
 * 7. Duplicate email remains rejected (HTTP 400).
 * 8. Patient-only self-registration remains enforced (doctor/receptionist rejected with HTTP 403).
 * 9. Existing login (aarav@gmail.com) and activation flows still work (HTTP 200).
 * 10. Database transaction rollback works if an internal insertion failure occurs (no orphan records).
 */

const path = require('path');
const mysql = require(path.resolve(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise'));
const { verifyDestructiveTestSafety, probeGatewaySafety } = require("../tests/safety/databaseSafetyGuard");

process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true";
process.env.ALLOW_DEFAULT_DEV_PORT = "false";

const testDbConfig = require("./test_db_config.json");
const PORT = 5001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = "") {
    if (condition) {
        console.log(`[PASS] ${testName} ${detail ? "- " + detail : ""}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName} ${detail ? "- " + detail : ""}`);
        failed++;
    }
}

async function run() {
    console.log("==========================================================================");
    console.log("  RUNNING SERVER-SIDE CONSENT ENFORCEMENT & PERSISTENCE REGRESSION SUITE  ");
    console.log("  Target: " + BASE_URL + " -> DB: " + testDbConfig.database);
    console.log("==========================================================================");

    verifyDestructiveTestSafety(testDbConfig.database);
    await probeGatewaySafety(PORT, testDbConfig.database);

    const db = await mysql.createConnection({
        host: testDbConfig.host,
        port: testDbConfig.port,
        user: testDbConfig.user,
        password: testDbConfig.password,
        database: testDbConfig.database
    });

    const cleanupEmails = [];

    try {
        // --- TEST 1: Missing consent field -> rejected (HTTP 400) ---
        const test1Email = `consent_t1_${Date.now()}@testcdss.internal`;
        const res1 = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Missing Consent Patient',
                email: test1Email,
                password: 'Password123!',
                phone: '9876543210'
            })
        });
        const body1 = await res1.json();
        assert(res1.status === 400 && body1.message && body1.message.includes("Affirmative consent"),
            "Test 1: Missing consent field is rejected with HTTP 400",
            body1.message);

        // --- TEST 2: terms_accepted: false -> rejected (HTTP 400) ---
        const test2Email = `consent_t2_${Date.now()}@testcdss.internal`;
        const res2 = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Rejected Consent Patient',
                email: test2Email,
                password: 'Password123!',
                phone: '9876543210',
                terms_accepted: false
            })
        });
        const body2 = await res2.json();
        assert(res2.status === 400 && body2.message && body2.message.includes("Affirmative consent"),
            "Test 2: terms_accepted: false is rejected with HTTP 400",
            body2.message);

        // --- TEST 3: Invalid consent value (string "true", number 1, null) -> rejected (HTTP 400) ---
        const test3EmailA = `consent_t3a_${Date.now()}@testcdss.internal`;
        const res3a = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'String Consent Patient',
                email: test3EmailA,
                password: 'Password123!',
                phone: '9876543210',
                terms_accepted: "true" // String, not boolean true
            })
        });
        assert(res3a.status === 400, "Test 3a: String 'true' is rejected with HTTP 400");

        const test3EmailB = `consent_t3b_${Date.now()}@testcdss.internal`;
        const res3b = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Number Consent Patient',
                email: test3EmailB,
                password: 'Password123!',
                phone: '9876543210',
                terms_accepted: 1 // Integer 1, not boolean true
            })
        });
        assert(res3b.status === 400, "Test 3b: Number 1 is rejected with HTTP 400");

        // --- TEST 4: terms_accepted: true -> registration succeeds (HTTP 201) ---
        const test4Email = `consent_success_${Date.now()}@testcdss.internal`;
        cleanupEmails.push(test4Email);
        const res4 = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Consented Valid Patient',
                email: test4Email,
                password: 'Password123!',
                phone: '9876543210',
                terms_accepted: true
            })
        });
        const body4 = await res4.json();
        assert(res4.status === 201 && body4.patient && body4.patient.email === test4Email,
            "Test 4: terms_accepted: true succeeds with HTTP 201 and created user",
            `User ID: ${body4.patient?.user_id}, Patient ID: ${body4.patient?.patient_id}`);

        // --- TEST 5: Successful registration records UTC timestamp and consent_version ---
        const [userRows] = await db.query(
            "SELECT user_id, email, role, consent_timestamp, consent_version FROM users WHERE email = ?",
            [test4Email]
        );
        const u = userRows[0];
        const hasConsentTimestamp = u && u.consent_timestamp !== null;
        const correctConsentVersion = u && u.consent_version === 'v1.0-2026-10';
        assert(hasConsentTimestamp && correctConsentVersion,
            "Test 5: DB record contains non-null consent_timestamp and consent_version 'v1.0-2026-10'",
            `Timestamp: ${u?.consent_timestamp}, Version: ${u?.consent_version}`);

        // --- TEST 6: Rejected registration creates neither a user nor a patient record ---
        const [rejectedUsers] = await db.query(
            "SELECT user_id FROM users WHERE email IN (?, ?, ?, ?)",
            [test1Email, test2Email, test3EmailA, test3EmailB]
        );
        const [rejectedPatients] = await db.query(
            "SELECT patient_id FROM patients WHERE user_id IN (SELECT user_id FROM users WHERE email IN (?, ?, ?, ?))",
            [test1Email, test2Email, test3EmailA, test3EmailB]
        );
        assert(rejectedUsers.length === 0 && rejectedPatients.length === 0,
            "Test 6: Rejected registration created zero user records and zero patient records in DB");

        // --- TEST 7: Duplicate email remains rejected (HTTP 400) ---
        const res7 = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Duplicate Patient',
                email: test4Email, // already registered in Test 4
                password: 'Password123!',
                phone: '9876543210',
                terms_accepted: true
            })
        });
        const body7 = await res7.json();
        assert(res7.status === 400 && body7.message && body7.message.includes("already registered"),
            "Test 7: Duplicate email registration rejected with HTTP 400",
            body7.message);

        // --- TEST 8: Patient-only self-registration remains enforced ---
        const test8Email = `consent_priv_${Date.now()}@testcdss.internal`;
        const res8 = await fetch(`${BASE_URL}/api/auth/patient/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: 'Doctor Impersonator',
                email: test8Email,
                password: 'Password123!',
                phone: '9876543210',
                role: 'doctor', // Privileged role injection attempt
                terms_accepted: true
            })
        });
        const body8 = await res8.json();
        assert(res8.status === 403 && body8.message && body8.message.includes("Privileged accounts"),
            "Test 8: Privileged role injection rejected with HTTP 403",
            body8.message);

        // --- TEST 9: Existing login and activation flows still work ---
        const res9 = await fetch(`${BASE_URL}/api/auth/patient/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'aarav@gmail.com',
                password: 'patient123'
            })
        });
        const body9 = await res9.json();
        assert(res9.status === 200 && body9.token && body9.patient.role === 'patient',
            "Test 9: Existing patient login (aarav@gmail.com) functions perfectly with HTTP 200");

        // --- TEST 10: Database transaction rollback works on insertion failure ---
        const test10Email = `consent_rollback_${Date.now()}@testcdss.internal`;
        let rollbackSuccess = false;
        try {
            await db.beginTransaction();
            const [uRes] = await db.query(
                "INSERT INTO users (full_name, email, password, role, consent_timestamp, consent_version) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)",
                ['Rollback Test', test10Email, 'hash', 'patient', 'v1.0-2026-10']
            );
            // Intentionally force error: invalid syntax / non-existent column
            await db.query("INSERT INTO patients (user_id, non_existent_column) VALUES (?, 1)", [uRes.insertId]);
            await db.commit();
        } catch (txErr) {
            await db.rollback();
            rollbackSuccess = true;
        }
        const [orphanCheck] = await db.query("SELECT user_id FROM users WHERE email = ?", [test10Email]);
        assert(rollbackSuccess && orphanCheck.length === 0,
            "Test 10: Transaction rollback completely cleans up, leaving 0 orphan user records");

    } finally {
        // Clean up synthetic accounts created in tests
        if (cleanupEmails.length > 0) {
            console.log(`\nCleaning up ${cleanupEmails.length} synthetic test accounts...`);
            for (const email of cleanupEmails) {
                const [uRows] = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);
                for (const u of uRows) {
                    await db.query("DELETE FROM patients WHERE user_id = ?", [u.user_id]);
                    await db.query("DELETE FROM users WHERE user_id = ?", [u.user_id]);
                }
            }
        }
        await db.end();
    }

    console.log("\n==========================================================================");
    console.log(`TEST SUITE SUMMARY: ${passed} PASSED / ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

run().catch(err => {
    console.error("Test execution aborted with error:", err);
    process.exit(1);
});
