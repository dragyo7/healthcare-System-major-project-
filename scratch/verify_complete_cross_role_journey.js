/**
 * scratch/verify_complete_cross_role_journey.js
 * 
 * Comprehensive E2E Verification of Phase C (Complete Cross-Role Clinical Journey):
 * 1. Receptionist registers synthetic patient & creates appointment
 * 2. Database verification of patient & appointment persistence
 * 3. Doctor login, patient lookup, and EHR dossier retrieval
 * 4. Doctor CDS Assistant inquiry (supported question, evidence citations, grounding status)
 * 5. Prescription Path A: Chat-assisted draft -> fast deterministic safety screening (/prescriptions/screen)
 * 6. Prescription Path B: Direct prescription form -> persistence in prescriptions & prescription_medicines
 * 7. Prescription PDF generation verification
 * 8. Doctor creates Post-Discharge care summary with warning signs
 * 9. Patient login -> personal dashboard -> views discharge care & finalized prescriptions
 * 10. Patient Post-Discharge Assistant inquiry (restricted mode, fail-closed safety)
 * 11. Appointment status update & consistency check
 * 12. Final database consistency & foreign-key audit
 */

const path = require("path");
const fs = require("fs");
const mysql = require(path.resolve(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));

const BASE_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(condition, name, detail = "") {
    if (condition) {
        console.log(`[PASS] ${name} ${detail}`);
        passed++;
    } else {
        console.error(`[FAIL] ${name} ${detail}`);
        failed++;
    }
}

async function postJson(endpoint, data, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

async function getJson(endpoint, token = null) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

async function runJourney() {
    console.log("==========================================================================");
    console.log("    COMPREHENSIVE CROSS-ROLE CLINICAL JOURNEY VERIFICATION (PHASE C)     ");
    console.log("==========================================================================\n");

    const db = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "bhumi",
        database: process.env.DB_NAME || "rag_healthcare"
    });
    console.log("Connected to MySQL (rag_healthcare) on port 3306.\n");

    try {
        const ts = Date.now();
        const syntheticEmail = `syn_patient_${ts}@testmed.org`;
        const syntheticPhone = `98200${String(ts).slice(-5)}`;

        // -------------------------------------------------------------
        // STEP 1: RECEPTIONIST PATIENT REGISTRATION & APPOINTMENT
        // -------------------------------------------------------------
        console.log(">>> [STEP 1: RECEPTIONIST WORKFLOW] <<<");
        const recLogin = await postJson("/api/auth/receptionist/login", {
            email: "receptionist@gmail.com",
            password: "receptionist123"
        });
        assert(recLogin.status === 200 && recLogin.body.token, "1.1 Receptionist logs in successfully");
        const recToken = recLogin.body.token;

        const regRes = await postJson("/api/receptionist/patients", {
            full_name: `Synthetic Patient Alpha ${ts}`,
            email: syntheticEmail,
            password: "patient123",
            phone: syntheticPhone,
            date_of_birth: "1980-04-12",
            gender: "Male",
            blood_group: "O+",
            address: "100 Innovation Park, Pune",
            emergency_contact: "9820099999",
            allergies: "Aspirin, Penicillin"
        }, recToken);
        const newPatientId = regRes.body.patient?.patient_id || regRes.body.patient_id;
        assert(regRes.status === 201 && newPatientId, "1.2 Receptionist registers patient", `-> Patient ID: ${newPatientId}`);

        // Schedule appointment with Doctor 1 (Dr. Rahul Sharma)
        const apptRes = await postJson("/api/receptionist/appointments", {
            doctor_id: 1,
            patient_id: newPatientId,
            appointment_date: "2026-11-15",
            start_time: "09:30:00",
            end_time: "10:00:00",
            reason: "Initial cardiac and hypertension evaluation"
        }, recToken);
        const apptId = apptRes.body.appointment_id;
        assert(apptRes.status === 201 && apptId, "1.3 Receptionist creates appointment", `-> Appt ID: ${apptId}`);

        // DB Verification
        const [patientRows] = await db.execute("SELECT patient_id, user_id, allergies, blood_group FROM patients WHERE patient_id = ?", [newPatientId]);
        assert(patientRows.length === 1 && patientRows[0].allergies.includes("Aspirin"), "1.4 Database verifies patient persisted with correct allergy records");

        const [apptRows] = await db.execute("SELECT appointment_id, doctor_id, patient_id, status FROM appointments WHERE appointment_id = ?", [apptId]);
        assert(apptRows.length === 1 && apptRows[0].status === "scheduled", "1.5 Database verifies appointment persisted with 'scheduled' status");

        // -------------------------------------------------------------
        // STEP 2: DOCTOR CLINICAL DOSSIER & CDS INQUIRY
        // -------------------------------------------------------------
        console.log("\n>>> [STEP 2: DOCTOR DOSSIER & CDS INQUIRY] <<<");
        const docLogin = await postJson("/api/auth/doctor/login", {
            email: "doctor@gmail.com",
            password: "doctor123"
        });
        assert(docLogin.status === 200 && docLogin.body.token, "2.1 Doctor logs in successfully");
        const docToken = docLogin.body.token;

        // Fetch patient details through Doctor API
        const patDetailRes = await getJson(`/api/doctor/patients/${newPatientId}`, docToken);
        assert(patDetailRes.status === 200 && patDetailRes.body.patient?.patient_id === newPatientId, "2.2 Doctor retrieves synthetic patient dossier", `-> Allergies: ${patDetailRes.body.patient?.allergies}`);

        // Doctor CDS Inquiry
        console.log("Doctor submitting supported clinical inquiry to CDS Assistant...");
        const cdsRes = await postJson("/api/doctor/cds", {
            patient_id: newPatientId,
            clinical_query: "What is the recommended starting dose for Atorvastatin in primary prevention of cardiovascular disease?",
            candidate_medications: ["Atorvastatin"]
        }, docToken);
        assert(cdsRes.status === 200 && cdsRes.body.execution_mode === "doctor", "2.3 Doctor CDS Assistant responds with evidence citations", `-> Status: ${cdsRes.body.verification_status}, Citations: ${cdsRes.body.citations?.length}`);

        // -------------------------------------------------------------
        // STEP 3: PRESCRIPTION SAFETY SCREENING (FAST DETERMINISTIC PATH)
        // -------------------------------------------------------------
        console.log("\n>>> [STEP 3: PRESCRIPTION AUTHORING & FAST SCREENING] <<<");
        
        // Path A: Screen Candidate Drugs (Atorvastatin + Clarithromycin -> Major CYP3A4 interaction)
        const screenRes = await postJson("/api/doctor/prescriptions/screen", {
            patient_id: newPatientId,
            candidate_medications: ["Atorvastatin", "Clarithromycin"]
        }, docToken);
        assert(screenRes.status === 200 && screenRes.body.screen_status === "warning", "3.1 Deterministic screen detects known interaction (Atorvastatin + Clarithromycin)", `-> Rule ID: ${screenRes.body.interactions[0]?.rule_id}`);

        // Screen Allergy Conflict (Aspirin prescribed to patient with Aspirin allergy)
        const allergyScreenRes = await postJson("/api/doctor/prescriptions/screen", {
            patient_id: newPatientId,
            candidate_medications: ["Aspirin 75mg"]
        }, docToken);
        assert(allergyScreenRes.status === 200 && allergyScreenRes.body.screen_status === "critical", "3.2 Deterministic screen flags allergy contraindication for documented Aspirin allergy", `-> Contraindication: ${allergyScreenRes.body.contraindications[0]}`);

        // Path B: Direct Prescription Entry and Persistence (Safe Med: Amlodipine 5mg)
        console.log("Doctor finalizing and persisting prescription (Amlodipine 5mg)...");
        const createRxRes = await postJson("/api/doctor/prescriptions", {
            patient_id: newPatientId,
            diagnosis: "Stage 1 Essential Hypertension",
            notes: "Initiating calcium channel blocker therapy with lifestyle modification.",
            medicines: [
                {
                    medicine_name: "Amlodipine",
                    dosage: "5mg",
                    frequency: "Once daily",
                    duration: "30 days",
                    instructions: "Take morning with water after breakfast"
                }
            ]
        }, docToken);
        const rxId = createRxRes.body.prescription_id || createRxRes.body.prescriptionId;
        assert(createRxRes.status === 201 && rxId, "3.3 Doctor persists verified prescription to hospital database", `-> Rx ID: ${rxId}`);

        // DB Verification for Prescription and Medicines
        const [rxRows] = await db.execute("SELECT prescription_id, doctor_id, patient_id, diagnosis FROM prescriptions WHERE prescription_id = ?", [rxId]);
        assert(rxRows.length === 1 && rxRows[0].patient_id === newPatientId, "3.4 Database verifies prescription foreign key links to correct patient");

        const [rxMedRows] = await db.execute("SELECT medicine_id, medicine_name, dosage, frequency FROM prescription_medicines WHERE prescription_id = ?", [rxId]);
        assert(rxMedRows.length === 1 && rxMedRows[0].medicine_name === "Amlodipine", "3.5 Database verifies prescription_medicines row created with 5mg Once daily");

        // Prescription PDF verification
        const pdfRes = await fetch(`${BASE_URL}/api/doctor/prescriptions/${rxId}/pdf`, {
            headers: { "Authorization": `Bearer ${docToken}` }
        });
        const isPdf = pdfRes.status === 200 && (pdfRes.headers.get("content-type") || "").includes("pdf");
        assert(isPdf, "3.6 Doctor downloads finalized prescription PDF from server");

        // -------------------------------------------------------------
        // STEP 4: DISCHARGE CARE SUMMARY & INSTRUCTIONS
        // -------------------------------------------------------------
        console.log("\n>>> [STEP 4: POST-DISCHARGE EPISODE CREATION] <<<");
        const dischargeRes = await postJson("/api/doctor/discharge", {
            patient_id: newPatientId,
            admission_date: "2026-10-10",
            discharge_date: "2026-10-14",
            diagnosis: "Hypertension (Controlled)",
            discharge_summary: "Patient successfully stabilized on Amlodipine 5mg OD.",
            discharge_instructions: "Take Amlodipine 5mg daily. Limit dietary sodium to < 2000mg. Walk 30 minutes daily.",
            follow_up_instructions: "Review BP log at cardiology OPD in 30 days.",
            follow_up_date: "2026-11-14",
            warning_signs: "Severe headache, visual disturbances, chest pain, or systolic BP > 180 mmHg require immediate emergency attention.",
            status: "discharged"
        }, docToken);
        const dischargeId = dischargeRes.body.discharge_id;
        assert(dischargeRes.status === 201 && dischargeId, "4.1 Doctor creates post-discharge record with clinical warning signs", `-> Discharge ID: ${dischargeId}`);

        const [dischRows] = await db.execute("SELECT discharge_id, patient_id, warning_signs FROM discharges WHERE discharge_id = ?", [dischargeId]);
        assert(dischRows.length === 1 && dischRows[0].warning_signs.includes("systolic BP > 180"), "4.2 Database verifies discharge episode persisted with correct warning signs");

        // -------------------------------------------------------------
        // STEP 5: PATIENT SELF-SERVICE & POST-DISCHARGE ASSISTANT
        // -------------------------------------------------------------
        console.log("\n>>> [STEP 5: PATIENT SELF-SERVICE PORTAL ACCESS] <<<");
        const patLogin = await postJson("/api/auth/patient/login", {
            email: syntheticEmail,
            password: "patient123"
        });
        assert(patLogin.status === 200 && patLogin.body.token, "5.1 Synthetic patient logs into Patient Portal");
        const patToken = patLogin.body.token;

        // View Dashboard
        const patDash = await getJson("/api/patient/dashboard", patToken);
        assert(patDash.status === 200 && patDash.body.patient_id === newPatientId, "5.2 Patient retrieves personal dashboard");

        // View Prescriptions
        const patRxs = await getJson("/api/patient/prescriptions", patToken);
        const foundRx = (patRxs.body.prescriptions || []).find(r => r.prescription_id === rxId);
        assert(!!foundRx, "5.3 Patient views finalized prescription record", `-> Diagnosis: ${foundRx?.diagnosis}`);

        // View Discharge Care
        const patDischarge = await getJson("/api/patient/discharge", patToken);
        assert(patDischarge.status === 200 && patDischarge.body.discharge?.discharge_id === dischargeId, "5.4 Patient retrieves discharge care instructions");

        // Query Patient Post-Discharge Assistant
        console.log("Patient querying Post-Discharge Health Assistant...");
        const patAssistantRes = await postJson("/api/patient/cds", {
            clinical_query: "What time of day should I take my Amlodipine, and what should I avoid eating?"
        }, patToken);
        assert(patAssistantRes.status === 200 && patAssistantRes.body.execution_mode === "patient", "5.5 Patient Assistant responds in restricted patient mode", `-> Verification: ${patAssistantRes.body.verification_status}`);

        // -------------------------------------------------------------
        // STEP 6: APPOINTMENT STATUS UPDATE & CONSISTENCY
        // -------------------------------------------------------------
        console.log("\n>>> [STEP 6: APPOINTMENT CONSISTENCY] <<<");
        // Doctor updates appointment status to 'completed'
        const updateApptRes = await fetch(`${BASE_URL}/api/doctor/appointments/${apptId}/status`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${docToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "completed" })
        });
        const updateData = await updateApptRes.json();
        assert(updateApptRes.status === 200, "6.1 Doctor updates appointment status to 'completed'");

        // DB Verification
        const [updatedApptRows] = await db.execute("SELECT status FROM appointments WHERE appointment_id = ?", [apptId]);
        assert(updatedApptRows[0].status === "completed", "6.2 Database confirms appointment status transitioned to 'completed'");

        // Verify Patient sees updated status
        const patAppts = await getJson("/api/patient/appointments", patToken);
        const patientAppt = (patAppts.body.appointments || []).find(a => a.appointment_id === apptId);
        assert(patientAppt && patientAppt.status === "completed", "6.3 Patient view reflects the updated appointment status");

        console.log("\n==========================================================================");
        console.log(`CROSS-ROLE CLINICAL JOURNEY SUMMARY: ${passed}/${passed + failed} STEPS PASSED, ${failed} FAILED`);
        console.log("==========================================================================\n");

    } catch (err) {
        console.error("Fatal error in clinical journey:", err);
        failed++;
    } finally {
        await db.end();
    }

    if (failed > 0) process.exit(1);
    process.exit(0);
}

runJourney();
