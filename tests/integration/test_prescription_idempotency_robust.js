/**
 * test_prescription_idempotency_robust.js
 *
 * Comprehensive 8-Scenario Integration Test Suite for Hardened Prescription Idempotency & Safety Boundary:
 * 1. Initial creation with client Idempotency-Key -> 201 Created + persists key & prescription.
 * 2. Exact replay with same Idempotency-Key -> 200 OK, duplicate_prevented: true, idempotent_replay: true, identical rx ID, no extra DB row.
 * 3. Reused Idempotency-Key with conflicting payload -> 409 Conflict (IDEMPOTENCY_CONFLICT).
 * 4. Legitimate dosage change (e.g. 5mg -> 10mg) -> 201 Created (NOT blocked by legacy name-only deduplication).
 * 5. Identical submission without key within 15s debounce window -> 200 OK, duplicate_prevented: true.
 * 6. High-concurrency simultaneous requests with same key -> serializes cleanly via advisory lock, exactly 1 row created.
 * 7. Documented allergy contraindication (Patient 1 Penicillin allergy) -> 422 Unprocessable Entity, zero persisted key or prescription.
 * 8. Retrying after allergy correction succeeds cleanly without orphaned locks or key lockouts.
 */

const http = require("http");
const path = require("path");
const mysql = require(path.join(__dirname, "../../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));
require(path.join(__dirname, "../../Portal Major P/Bhumi/Doctor portal/backend/node_modules/dotenv")).config({
    path: path.join(__dirname, "../../Portal Major P/Bhumi/Doctor portal/backend/.env")
});

function httpRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on("error", reject);
        if (postData) {
            req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runIdempotencyAudit() {
    console.log("==========================================================================");
    console.log("   PRESCRIPTION IDEMPOTENCY & ALLERGY SAFETY INTEGRATION TEST SUITE       ");
    console.log("==========================================================================\n");

    const pool = mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "rag_healthcare",
        port: Number(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 5
    });

    const results = [];
    function record(id, name, pass, detail) {
        results.push({ id, name, pass, detail });
        const tag = pass ? "[PASS]" : "[FAIL]";
        console.log(`${tag} Scenario ${id}: ${name}`);
        if (detail) console.log(`       Detail: ${detail}`);
    }

    try {
        // Step 0: Doctor Login
        const loginRes = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/auth/doctor/login",
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, {
            email: "doctor@gmail.com",
            password: "doctor123"
        });

        if (loginRes.status !== 200 || !loginRes.body.token) {
            throw new Error(`Doctor login failed: ${JSON.stringify(loginRes.body)}`);
        }
        const doctorToken = loginRes.body.token;

        const authHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${doctorToken}`
        };

        const testPatientId = 1; // Aarav Patil (Allergy: Penicillin)
        const uniqueNonce = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);

        // --- Scenario 1: Initial Creation with Idempotency-Key ---
        const key1 = `idemp_key_1_${uniqueNonce}`;
        const payload1 = {
            patient_id: testPatientId,
            diagnosis: "Stage 1 Essential Hypertension",
            notes: "Initial therapeutic line for blood pressure control",
            medicines: [
                {
                    medicine_name: "Amlodipine",
                    dosage: "5 mg",
                    frequency: "Once daily",
                    duration: "30 days",
                    instructions: "Take in the morning with water"
                }
            ]
        };

        const [rxCountBefore] = await pool.execute(
            `SELECT COUNT(*) AS total FROM prescriptions WHERE patient_id = ?`,
            [testPatientId]
        );

        const res1 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": key1
            }
        }, payload1);

        const s1Pass = res1.status === 201 && res1.body.prescription_id && res1.body.idempotency_key === key1;
        const initialRxId = res1.body.prescription_id;
        record(
            "1",
            "Initial Creation with Client Idempotency-Key",
            s1Pass,
            `HTTP ${res1.status}, Rx ID: ${initialRxId}, Key: ${res1.body.idempotency_key}`
        );

        // --- Scenario 2: Exact Replay with Same Idempotency-Key ---
        const res2 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": key1
            }
        }, payload1);

        const [rxCountAfterReplay] = await pool.execute(
            `SELECT COUNT(*) AS total FROM prescriptions WHERE patient_id = ?`,
            [testPatientId]
        );

        const noExtraRow = rxCountAfterReplay[0].total === rxCountBefore[0].total + 1;
        const s2Pass = res2.status === 200 &&
            res2.body.prescription_id === initialRxId &&
            res2.body.duplicate_prevented === true &&
            res2.body.idempotent_replay === true &&
            noExtraRow;

        record(
            "2",
            "Exact Replay with Same Idempotency-Key (Zero Duplicate Rows)",
            s2Pass,
            `HTTP ${res2.status}, Replayed Rx ID: ${res2.body.prescription_id}, duplicate_prevented: ${res2.body.duplicate_prevented}, idempotent_replay: ${res2.body.idempotent_replay}, noExtraRow: ${noExtraRow}`
        );

        // --- Scenario 3: Reused Key with Conflicting Payload ---
        const conflictingPayload = {
            patient_id: testPatientId,
            diagnosis: "Altered Diagnosis For Conflict Test",
            notes: "Different clinical notes",
            medicines: [
                {
                    medicine_name: "Metoprolol",
                    dosage: "25 mg",
                    frequency: "Twice daily",
                    duration: "14 days",
                    instructions: "Take with food"
                }
            ]
        };

        const res3 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": key1
            }
        }, conflictingPayload);

        const s3Pass = res3.status === 409 && res3.body.error === "IDEMPOTENCY_CONFLICT";
        record(
            "3",
            "Reused Key with Conflicting Request Payload (HTTP 409)",
            s3Pass,
            `HTTP ${res3.status}, Error: ${res3.body.error}, Message: ${res3.body.message}`
        );

        // --- Scenario 4: Legitimate Dosage Change (5mg -> 10mg) with Distinct Key ---
        const keyDosageChange = `idemp_key_dosage_${uniqueNonce}`;
        const payloadDosageChange = {
            patient_id: testPatientId,
            diagnosis: "Stage 1 Essential Hypertension",
            notes: "Dose titrated upward due to insufficient response",
            medicines: [
                {
                    medicine_name: "Amlodipine",
                    dosage: "10 mg", // Changed from 5mg
                    frequency: "Once daily",
                    duration: "30 days",
                    instructions: "Take in the morning with water"
                }
            ]
        };

        const res4 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": keyDosageChange
            }
        }, payloadDosageChange);

        const s4Pass = res4.status === 201 && res4.body.prescription_id && res4.body.prescription_id !== initialRxId;
        record(
            "4",
            "Legitimate Dosage Adjustment Allowed (5mg -> 10mg Titration)",
            s4Pass,
            `HTTP ${res4.status}, New Rx ID: ${res4.body.prescription_id} (Previous: ${initialRxId})`
        );

        // --- Scenario 5: Identical Submission Without Key (15s Window Deduplication) ---
        const res5Initial = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: authHeaders
        }, payloadDosageChange);

        const s5Pass = res5Initial.status === 200 &&
            res5Initial.body.duplicate_prevented === true &&
            res5Initial.body.prescription_id === res4.body.prescription_id;

        record(
            "5",
            "Identical Payload Without Key Handled by 15s Debounce Window",
            s5Pass,
            `HTTP ${res5Initial.status}, duplicate_prevented: ${res5Initial.body.duplicate_prevented}, Reused Rx ID: ${res5Initial.body.prescription_id}`
        );

        // --- Scenario 6: High-Concurrency Submissions with Identical Key ---
        const concurrentKey = `idemp_concurrent_${uniqueNonce}`;
        const concurrentPayload = {
            patient_id: testPatientId,
            diagnosis: "Lipid Disorder",
            notes: "Concurrency race test",
            medicines: [
                {
                    medicine_name: "Atorvastatin",
                    dosage: "20 mg",
                    frequency: "Once daily bedtime",
                    duration: "30 days",
                    instructions: "Take at night"
                }
            ]
        };

        const [rxTotalBeforeConcurrent] = await pool.execute(
            `SELECT COUNT(*) AS total FROM prescriptions WHERE patient_id = ?`,
            [testPatientId]
        );

        // Fire 4 concurrent requests with the identical key
        const concurrentPromises = [1, 2, 3, 4].map(() => httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": concurrentKey
            }
        }, concurrentPayload));

        const concurrentResponses = await Promise.all(concurrentPromises);

        const [rxTotalAfterConcurrent] = await pool.execute(
            `SELECT COUNT(*) AS total FROM prescriptions WHERE patient_id = ?`,
            [testPatientId]
        );

        const allStatusesOk = concurrentResponses.every(r => r.status === 200 || r.status === 201);
        const rxIds = concurrentResponses.map(r => r.body.prescription_id).filter(Boolean);
        const uniqueRxIds = [...new Set(rxIds)];
        const exactlyOneAdded = rxTotalAfterConcurrent[0].total === rxTotalBeforeConcurrent[0].total + 1;

        const s6Pass = allStatusesOk && uniqueRxIds.length === 1 && exactlyOneAdded;
        record(
            "6",
            "High-Concurrency Lock & Key Serialization (Zero Race Duplicates)",
            s6Pass,
            `Statuses: [${concurrentResponses.map(r => r.status).join(", ")}], Unique Rx IDs: [${uniqueRxIds.join(", ")}], exactlyOneAdded: ${exactlyOneAdded}`
        );

        // --- Scenario 7: Documented Allergy Contraindication (Penicillin for Patient 1) ---
        const allergyKey = `idemp_allergy_${uniqueNonce}`;
        const allergicPayload = {
            patient_id: testPatientId, // Aarav Patil has Penicillin allergy
            diagnosis: "Bacterial Pharyngitis",
            notes: "Candidate antibiotic",
            medicines: [
                {
                    medicine_name: "Amoxicillin", // Aminopenicillin class cross-reactivity
                    dosage: "500 mg",
                    frequency: "Three times daily",
                    duration: "7 days",
                    instructions: "Take before meals"
                }
            ]
        };

        const res7 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": allergyKey
            }
        }, allergicPayload);

        // Verify key was NOT stored in idempotency table
        const [orphanedKeyRows] = await pool.execute(
            `SELECT idempotency_key FROM prescription_idempotency_keys WHERE idempotency_key = ?`,
            [allergyKey]
        );

        const s7Pass = res7.status === 422 &&
            res7.body.rule_id === "ALLERGY_RULE" &&
            (res7.body.contraindications || []).length > 0 &&
            orphanedKeyRows.length === 0;

        record(
            "7",
            "Safety Boundary Allergy Rejection (HTTP 422, Zero Orphaned Key)",
            s7Pass,
            `HTTP ${res7.status}, Rule: ${res7.body.rule_id}, Orphaned DB Keys: ${orphanedKeyRows.length}, Contraindications: ${JSON.stringify(res7.body.contraindications)}`
        );

        // --- Scenario 8: Follow-up Corrected Submission with That Same Key ---
        const correctedPayload = {
            patient_id: testPatientId,
            diagnosis: "Bacterial Pharyngitis",
            notes: "Prescribing safe alternative macrolide (non-contraindicated)",
            medicines: [
                {
                    medicine_name: "Azithromycin",
                    dosage: "500 mg",
                    frequency: "Once daily",
                    duration: "3 days",
                    instructions: "Take 1 hour before food"
                }
            ]
        };

        const res8 = await httpRequest({
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/doctor/prescriptions",
            method: "POST",
            headers: {
                ...authHeaders,
                "Idempotency-Key": allergyKey // Retrying with same key after correcting clinical error
            }
        }, correctedPayload);

        const s8Pass = res8.status === 201 && res8.body.prescription_id && res8.body.idempotency_key === allergyKey;
        record(
            "8",
            "Post-Correction Submission with Key Succeeds Cleanly",
            s8Pass,
            `HTTP ${res8.status}, New Rx ID: ${res8.body.prescription_id}, Key: ${res8.body.idempotency_key}`
        );

    } finally {
        await pool.end();
    }

    console.log("\n==========================================================================");
    const allPassed = results.every(r => r.pass);
    const passCount = results.filter(r => r.pass).length;
    console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
    if (allPassed) {
        console.log("RESULT: ALL 8 IDEMPOTENCY & ALLERGY SCENARIOS PASSED WITH RIGOROUS INVARIANTS!");
    } else {
        console.error("RESULT: SOME SCENARIOS FAILED. CHECK DETAILS ABOVE.");
        process.exit(1);
    }
    console.log("==========================================================================");
}

runIdempotencyAudit().catch(err => {
    console.error("Test execution failed with error:", err);
    process.exit(1);
});
