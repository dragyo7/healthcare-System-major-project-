/**
 * test_full_system_multi_role_e2e.js
 *
 * Complete Synthetic Multi-Role End-to-End Journey Verification:
 * Receptionist -> Doctor -> Patient -> Cross-Role Negative Security Matrix.
 */

const fs = require('fs');
const path = require('path');

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

async function runE2E() {
    console.log("===================================================================");
    console.log("    FULL PLATFORM MULTI-ROLE END-TO-END JOURNEY VERIFICATION       ");
    console.log("===================================================================\n");

    const { verifyDestructiveTestSafety, probeGatewaySafety } = require("../tests/safety/databaseSafetyGuard");
    const targetDb = (process.env.DB_NAME || "").trim();
    verifyDestructiveTestSafety(targetDb);
    await probeGatewaySafety(PORT, targetDb);

    try {
        // -------------------------------------------------------------
        // STEP 1: RECEPTIONIST WORKFLOW
        // -------------------------------------------------------------
        console.log("--- STEP 1: RECEPTIONIST WORKFLOW ---");
        // 1.1 Receptionist Login
        const recLoginRes = await fetch(`${BASE_URL}/api/auth/receptionist/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" })
        });
        const recLoginData = await recLoginRes.json();
        assert(recLoginRes.status === 200 && recLoginData.token, "1.1 Receptionist logs in successfully");
        const recToken = recLoginData.token;

        // 1.2 Receptionist registers a new patient
        const testTimestamp = Date.now();
        const regPatientRes = await fetch(`${BASE_URL}/api/receptionist/patients`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${recToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                full_name: `E2E Patient ${testTimestamp}`,
                email: `e2e_pat_${testTimestamp}@gmail.com`,
                password: "patient123",
                phone: `98700${String(testTimestamp).slice(-5)}`,
                date_of_birth: "1988-06-15",
                gender: "Female",
                blood_group: "B+",
                address: "42 Wellness Boulevard",
                emergency_contact: "9870000000",
                allergies: "Penicillin"
            })
        });
        const regPatientData = await regPatientRes.json();
        const newPatientId = regPatientData.patient?.patient_id || regPatientData.patient_id;
        assert(regPatientRes.status === 201 && newPatientId, "1.2 Receptionist registers patient", `-> Patient ID: ${newPatientId}`);
        const newPatientEmail = `e2e_pat_${testTimestamp}@gmail.com`;

        // 1.3 Receptionist schedules an appointment with Doctor 1 (Dr. Rahul Sharma)
        const apptRes = await fetch(`${BASE_URL}/api/receptionist/appointments`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${recToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                doctor_id: 1,
                patient_id: newPatientId,
                appointment_date: "2026-10-30",
                start_time: "10:30:00",
                end_time: "11:00:00",
                reason: "Hypertension follow-up consultation"
            })
        });
        const apptData = await apptRes.json();
        assert(apptRes.status === 201 && apptData.appointment_id, "1.3 Receptionist schedules appointment with Dr. Rahul Sharma", `-> Appt ID: ${apptData.appointment_id}`);

        // -------------------------------------------------------------
        // STEP 2: DOCTOR CLINICAL CONSULTATION & CDS
        // -------------------------------------------------------------
        console.log("\n--- STEP 2: DOCTOR WORKFLOW & CDS ---");
        // 2.1 Doctor Login
        const docLoginRes = await fetch(`${BASE_URL}/api/auth/doctor/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" })
        });
        const docLoginData = await docLoginRes.json();
        assert(docLoginRes.status === 200 && docLoginData.token, "2.1 Doctor logs in successfully");
        const docToken = docLoginData.token;

        // 2.2 Doctor evaluates Clinical Decision Support for patient
        const docCdsRes = await fetch(`${BASE_URL}/api/doctor/cds`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${docToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: newPatientId,
                clinical_query: "What is the recommended first-line therapy for essential hypertension?",
                candidate_medications: ["Amlodipine"]
            })
        });
        const docCdsData = await docCdsRes.json();
        assert(docCdsRes.status === 200 && docCdsData.execution_mode === "doctor", "2.2 Doctor runs clinical CDS evaluation", `-> Verification: ${docCdsData.verification_status}, Citations: ${docCdsData.citations?.length || 0}`);

        // -------------------------------------------------------------
        // STEP 3: PRESCRIPTION OCR & EXPLICIT HUMAN CONFIRMATION
        // -------------------------------------------------------------
        console.log("\n--- STEP 3: PRESCRIPTION OCR & CLINICIAN CONFIRMATION ---");
        const validImagePath = path.join(__dirname, 'synthetic_prescription_test.png');
        const validForm = new FormData();
        validForm.append('patient_id', String(newPatientId));
        const validBlob = new Blob([fs.readFileSync(validImagePath)], { type: 'image/png' });
        validForm.append('prescription_image', validBlob, 'synthetic_prescription_test.png');

        const ocrUploadRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/upload-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${docToken}` },
            body: validForm
        });
        const ocrUploadData = await ocrUploadRes.json();
        assert(ocrUploadRes.status === 201 && ocrUploadData.job_id, "3.1 Doctor uploads prescription image and extracts OCR candidates", `-> Job ID: ${ocrUploadData.job_id}`);
        const jobId = ocrUploadData.job_id;

        // Verify pending review
        assert(ocrUploadData.review_status === "pending_review", "3.2 OCR output placed in pending_review state (zero silent confirmation)");

        // Explicit Clinician Confirmation
        const confirmRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/confirm-ocr`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${docToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                job_id: jobId,
                diagnosis: "Essential Hypertension (Stage 1)",
                notes: "Prescription created from verified clinical OCR review",
                confirmed_medicines: [
                    {
                        medicine_name: "Amlodipine",
                        dosage: "5mg",
                        frequency: "OD",
                        duration: "30 days",
                        instructions: "Once daily morning with water"
                    }
                ]
            })
        });
        const confirmData = await confirmRes.json();
        assert(confirmRes.status === 201 && confirmData.prescription_id, "3.3 Doctor explicitly confirms OCR candidates -> Creates Authoritative Prescription", `-> Rx ID: ${confirmData.prescription_id}`);
        const confirmedRxId = confirmData.prescription_id;

        // -------------------------------------------------------------
        // STEP 4: POST-DISCHARGE CARE CREATION
        // -------------------------------------------------------------
        console.log("\n--- STEP 4: DISCHARGE CARE EPISODE MANAGEMENT ---");
        const dischargeRes = await fetch(`${BASE_URL}/api/doctor/discharge`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${docToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: newPatientId,
                admission_date: "2026-10-20",
                discharge_date: "2026-10-24",
                diagnosis: "Essential Hypertension (Stabilized)",
                discharge_summary: "Patient admitted for blood pressure control and successfully stabilized.",
                discharge_instructions: "Take Amlodipine 5mg daily every morning. Maintain low-sodium diet (<2g daily). Record BP daily.",
                follow_up_instructions: "Cardiology outpatient clinic follow-up in 4 weeks.",
                follow_up_date: "2026-11-20",
                warning_signs: "Seek emergency care immediately if experiencing severe chest pain, shortness of breath, severe dizziness, or fainting.",
                status: "discharged"
            })
        });
        const dischargeData = await dischargeRes.json();
        assert(dischargeRes.status === 201 && dischargeData.discharge_id, "4.1 Doctor creates post-discharge care episode and warning signs", `-> Discharge ID: ${dischargeData.discharge_id}`);

        // -------------------------------------------------------------
        // STEP 5: PATIENT SELF-SERVICE PORTAL ACCESS
        // -------------------------------------------------------------
        console.log("\n--- STEP 5: PATIENT SELF-SERVICE PORTAL ---");
        // 5.1 Patient Login
        const patLoginRes = await fetch(`${BASE_URL}/api/auth/patient/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: newPatientEmail, password: "patient123" })
        });
        const patLoginData = await patLoginRes.json();
        assert(patLoginRes.status === 200 && patLoginData.token, "5.1 Newly registered patient logs into Patient Portal");
        const patToken = patLoginData.token;

        // 5.2 Patient views Dashboard
        const patDashRes = await fetch(`${BASE_URL}/api/patient/dashboard`, {
            headers: { "Authorization": `Bearer ${patToken}` }
        });
        const patDashData = await patDashRes.json();
        assert(patDashRes.status === 200 && patDashData.patient_id === newPatientId, "5.2 Patient retrieves personal dashboard", `-> Active Discharge: ${!!patDashData.active_discharge}`);

        // 5.3 Patient views Confirmed Prescriptions
        const patRxRes = await fetch(`${BASE_URL}/api/patient/prescriptions`, {
            headers: { "Authorization": `Bearer ${patToken}` }
        });
        const patRxData = await patRxRes.json();
        const rxMatch = patRxData.prescriptions?.find(r => r.prescription_id === confirmedRxId);
        assert(!!rxMatch, "5.3 Patient views newly confirmed prescription from doctor OCR workflow", `-> Diagnosis: ${rxMatch?.diagnosis}`);

        // 5.4 Patient views Discharge Care Plan & Warning Signs
        const patDischargeRes = await fetch(`${BASE_URL}/api/patient/discharge`, {
            headers: { "Authorization": `Bearer ${patToken}` }
        });
        const patDischargeData = await patDischargeRes.json();
        assert(patDischargeRes.status === 200 && patDischargeData.discharge?.warning_signs.includes("chest pain"), "5.4 Patient views personalized discharge instructions and warning signs");

        // 5.5 Patient asks Post-Discharge Assistant in Restricted Mode
        console.log("[INFO] Patient querying Post-Discharge Health Assistant...");
        const patCdsRes = await fetch(`${BASE_URL}/api/patient/cds`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${patToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                clinical_query: "What time should I take my Amlodipine blood pressure medication?"
            })
        });
        const patCdsData = await patCdsRes.json();
        assert(patCdsRes.status === 200 && patCdsData.execution_mode === "patient", "5.5 Patient Assistant responds in Restricted Patient Mode", `-> Status: ${patCdsData.verification_status}, Citations: ${patCdsData.citations?.length || 0}`);

        // -------------------------------------------------------------
        // STEP 6: NEGATIVE SECURITY & BOLA MATRIX
        // -------------------------------------------------------------
        console.log("\n--- STEP 6: CROSS-ROLE NEGATIVE SECURITY MATRIX ---");
        // 6.1 Patient attempts to access another patient's records (BOLA)
        const patBolaRes = await fetch(`${BASE_URL}/api/patient/cds`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${patToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patient_id: 1, // Another patient's ID
                clinical_query: "What is my medicine dose?"
            })
        });
        assert(patBolaRes.status === 403, "6.1 BOLA: Patient cannot pass another patient's ID to CDS (403)");

        // 6.2 Receptionist attempts to access Doctor CDS
        const recDocCdsRes = await fetch(`${BASE_URL}/api/doctor/cds`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${recToken}` }
        });
        assert(recDocCdsRes.status === 403, "6.2 Role boundary: Receptionist blocked from Doctor CDS (403)");

        // 6.3 Receptionist attempts to access Patient CDS
        const recPatCdsRes = await fetch(`${BASE_URL}/api/patient/cds`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${recToken}` }
        });
        assert(recPatCdsRes.status === 403, "6.3 Role boundary: Receptionist blocked from Patient CDS (403)");

        // 6.4 Receptionist attempts to confirm prescriptions
        const recConfirmRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/confirm-ocr`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${recToken}` }
        });
        assert(recConfirmRes.status === 403, "6.4 Role boundary: Receptionist blocked from confirming prescriptions (403)");

        // 6.5 Patient attempts to access Doctor Endpoints
        const patDocRes = await fetch(`${BASE_URL}/api/doctor/profile`, {
            headers: { "Authorization": `Bearer ${patToken}` }
        });
        assert(patDocRes.status === 403, "6.5 Role boundary: Patient blocked from Doctor profile/management (403)");

        // 6.6 Unauthenticated request to protected endpoint
        const unauthRes = await fetch(`${BASE_URL}/api/patient/dashboard`);
        assert(unauthRes.status === 401, "6.6 Unauthenticated request to patient dashboard strictly blocked (401)");

    } catch (err) {
        console.error("E2E Execution failed:", err);
        failed++;
    }

    console.log("\n===================================================================");
    console.log(`TOTAL E2E VERIFICATIONS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("===================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runE2E();
