/**
 * test_patient_and_discharge.js
 *
 * Comprehensive Verification Suite for Phase 2 (Patient Portal) & Phase 3 (Discharge Care & Follow-up).
 */

const { verifyDestructiveTestSafety, probeGatewaySafety } = require("../tests/safety/databaseSafetyGuard");

const PORT = parseInt(process.env.TEST_EXPRESS_PORT || process.env.EXPRESS_PORT || "5001");
const BASE_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = "") {
    if (condition) {
        console.log(`[PASS] ${testName} ${detail}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName} ${detail}`);
        failed++;
    }
}

async function runTests() {
    console.log("=================================================");
    console.log("  PHASE 2 & 3: PATIENT PORTAL & DISCHARGE SUITE  ");
    console.log("=================================================\n");

    const targetDb = (process.env.DB_NAME || "").trim();
    verifyDestructiveTestSafety(targetDb);
    await probeGatewaySafety(PORT, targetDb);

    try {
        // 1. Patient Login
        const patientLoginRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "aarav@gmail.com", password: "patient123" })
        });
        const patientLoginData = await patientLoginRes.json();
        assert(patientLoginRes.status === 200 && patientLoginData.token, "1. Patient Login succeeds", `-> Role: ${patientLoginData.patient?.role}`);
        const patientToken = patientLoginData.token;

        // 2. Doctor Login
        const docLoginRes = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
        });
        const docLoginData = await docLoginRes.json();
        assert(docLoginRes.status === 200 && docLoginData.token, "2. Doctor Login succeeds", `-> Doctor ID: ${docLoginData.doctor?.user_id}`);
        const doctorToken = docLoginData.token;

        // 3. Receptionist Login
        const recLoginRes = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
        });
        const recLoginData = await recLoginRes.json();
        assert(recLoginRes.status === 200 && recLoginData.token, "3. Receptionist Login succeeds", `-> Role: ${recLoginData.user?.role}`);
        const receptionistToken = recLoginData.token;

        // 4. Patient Profile
        const profileRes = await fetch(`${BASE_URL}/api/patient/profile`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const profileData = await profileRes.json();
        assert(profileRes.status === 200 && profileData.patient?.full_name === "Aarav Patil", "4. Get Patient Profile", `-> Name: ${profileData.patient?.full_name}, Blood: ${profileData.patient?.blood_group}`);

        // 5. Patient Dashboard
        const dashRes = await fetch(`${BASE_URL}/api/patient/dashboard`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const dashData = await dashRes.json();
        assert(dashRes.status === 200 && dashData.patient_id === 1, "5. Get Patient Dashboard", `-> Upcoming: ${dashData.upcoming_appointments?.length}, Prescriptions: ${dashData.recent_prescriptions?.length}, Active Discharge: ${!!dashData.active_discharge}`);

        // 6. Patient Medical History
        const histRes = await fetch(`${BASE_URL}/api/patient/medical-history`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const histData = await histRes.json();
        assert(histRes.status === 200 && Array.isArray(histData.medical_history), "6. Get Patient Medical History", `-> History Count: ${histData.medical_history.length}, Symptoms Count: ${histData.symptoms?.length}`);

        // 7. Patient Prescriptions
        const rxRes = await fetch(`${BASE_URL}/api/patient/prescriptions`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const rxData = await rxRes.json();
        assert(rxRes.status === 200 && Array.isArray(rxData.prescriptions), "7. Get Patient Prescriptions", `-> Prescriptions Count: ${rxData.prescriptions.length}`);

        // 8. Patient Medications
        const medsRes = await fetch(`${BASE_URL}/api/patient/medications`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const medsData = await medsRes.json();
        assert(medsRes.status === 200 && Array.isArray(medsData.medications), "8. Get Patient Distinct Medications", `-> Distinct Meds: ${medsData.medications.length}`);

        // 9. Patient Discharge Record
        const dischargeRes = await fetch(`${BASE_URL}/api/patient/discharge`, {
            headers: { "Authorization": `Bearer ${patientToken}` }
        });
        const dischargeData = await dischargeRes.json();
        assert(dischargeRes.status === 200 && dischargeData.discharge?.diagnosis.includes("Hypertens"), "9. Get Patient Discharge Episode", `-> Diagnosis: ${dischargeData.discharge?.diagnosis}`);

        // 10. BOLA Security: Patient attempting to supply another patient's ID to CDS
        const bolaRes = await fetch(`${BASE_URL}/api/patient/cds`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${patientToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: 999, // Tampered ID
                clinical_query: "What is my blood pressure medication dose?"
            })
        });
        assert(bolaRes.status === 403, "10. BOLA Protection: Cross-patient ID strictly returns 403 Forbidden");

        // 11. Doctor Views Patient Discharge
        const docDischargeRes = await fetch(`${BASE_URL}/api/doctor/patients/1/discharge`, {
            headers: { "Authorization": `Bearer ${doctorToken}` }
        });
        const docDischargeData = await docDischargeRes.json();
        assert(docDischargeRes.status === 200 && docDischargeData.discharge?.patient_id === 1, "11. Doctor views authorized patient discharge episode", `-> Status: ${docDischargeData.discharge?.status}`);

        // 12. Doctor Updates Discharge
        const updateDischargeRes = await fetch(`${BASE_URL}/api/doctor/discharge`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${doctorToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                discharge_id: docDischargeData.discharge?.discharge_id,
                patient_id: 1,
                admission_date: "2026-09-20",
                discharge_date: "2026-09-25",
                diagnosis: "Essential Hypertension & Mild Angina (Stabilized)",
                discharge_summary: "Patient stabilized on Amlodipine regimen.",
                discharge_instructions: "Take Amlodipine 5mg daily every morning with water. Low sodium diet.",
                follow_up_instructions: "Cardiology clinic follow-up in 4 weeks.",
                follow_up_date: "2026-10-25",
                warning_signs: "Severe chest pain, breathlessness, dizziness.",
                status: "discharged"
            })
        });
        const updateDischargeData = await updateDischargeRes.json();
        assert(updateDischargeRes.status === 200, "12. Doctor updates clinical discharge record", `-> Discharge ID: ${updateDischargeData.discharge_id}`);

        // 13. Receptionist Blocked from Patient Endpoints (403/401)
        const recBlockedRes = await fetch(`${BASE_URL}/api/patient/profile`, {
            headers: { "Authorization": `Bearer ${receptionistToken}` }
        });
        assert(recBlockedRes.status === 403 || recBlockedRes.status === 401, "13. Receptionist blocked from Patient Portal endpoints (403)");

        // 14. Restricted Patient Post-Discharge Assistant CDS Evaluation
        console.log("\n[INFO] Evaluating Restricted Patient CDS with Post-Discharge Context...");
        const cdsRes = await fetch(`${BASE_URL}/api/patient/cds`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${patientToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                clinical_query: "What time should I take my Amlodipine blood pressure medicine?"
            })
        });
        const cdsData = await cdsRes.json();
        assert(cdsRes.status === 200 && (cdsData.execution_mode === "patient" || cdsData.mode === "patient"), "14. Post-Discharge Assistant responds in Restricted Patient Mode", `-> Verification: ${cdsData.verification_status}, Citations: ${cdsData.citations?.length || 0}`);

    } catch (err) {
        console.error("Test execution failed:", err);
        failed++;
    }

    console.log("\n=================================================");
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("=================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
