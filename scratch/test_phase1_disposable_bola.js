const path = require("path");
const fs = require("fs");

// Set up environment before requiring app
const testDbName = "rag_healthcare_phase1_security_test";
process.env.DB_NAME = testDbName;
process.env.DB_HOST = "localhost";
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "bhumi";
process.env.JWT_SECRET = "rag_healthcare_secret";
process.env.PORT = "5002";

const mysql = require("mysql2/promise");

async function runVerification() {
    console.log("=== PHASE 1 DISPOSABLE TEST FIXTURE EXECUTION ===");
    const rootConn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    // 1. Create isolated disposable database
    console.log(`Creating database ${testDbName}...`);
    await rootConn.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    await rootConn.execute(`CREATE DATABASE \`${testDbName}\``);

    // 2. Clone schema from rag_healthcare
    const [tables] = await rootConn.execute("SHOW TABLES FROM `rag_healthcare`");
    for (const t of tables) {
        const tbl = Object.values(t)[0];
        await rootConn.execute(`CREATE TABLE \`${testDbName}\`.\`${tbl}\` LIKE \`rag_healthcare\`.\`${tbl}\``);
    }
    console.log("Schema cloned successfully.");

    const testConn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: testDbName
    });

    // 3. Populate minimal isolated fixtures
    // Bcrypt hash for "doctor123"
    const passHash = "$2b$10$XbK8H8vIO4rNt1JZBWRUnuxg14L/6MtE.GtUbKYWdxaZmCzByJivi";

    // Users
    await testConn.execute(`
        INSERT INTO users (user_id, full_name, email, password, role, phone) VALUES
        (101, 'Dr. Alice Smith', 'alice@gmail.com', '${passHash}', 'doctor', '9876543210'),
        (102, 'Dr. Bob Jones', 'bob@gmail.com', '${passHash}', 'doctor', '9876543211'),
        (201, 'Patient Alice Patient', 'patient_a@gmail.com', '${passHash}', 'patient', '9876543220'),
        (202, 'Patient Bob Patient', 'patient_b@gmail.com', '${passHash}', 'patient', '9876543221')
    `);

    // Doctors
    await testConn.execute(`
        INSERT INTO doctors (doctor_id, user_id, specialization, qualification, license_number, experience_years) VALUES
        (1, 101, 'Cardiology', 'MBBS, MD', 'DOC-A-101', 10),
        (2, 102, 'Neurology', 'MBBS, MD', 'DOC-B-102', 8)
    `);

    // Patients
    await testConn.execute(`
        INSERT INTO patients (patient_id, user_id, date_of_birth, gender, blood_group, address, allergies) VALUES
        (1, 201, '1990-01-01', 'Male', 'O+', '123 Baker St', 'Penicillin'),
        (2, 202, '1992-02-02', 'Female', 'A+', '456 Elm St', 'Sulfa')
    `);

    // Medical history & symptoms
    await testConn.execute(`
        INSERT INTO medical_history (history_id, patient_id, condition_name, diagnosis, diagnosed_date) VALUES
        (1, 1, 'Hypertension', 'Essential hypertension', '2025-01-01'),
        (2, 2, 'Migraine', 'Chronic migraine', '2025-02-01')
    `);
    await testConn.execute(`
        INSERT INTO symptoms (symptom_id, patient_id, symptoms, severity, reported_date) VALUES
        (1, 1, 'Chest tightness', 'Moderate', '2026-10-01'),
        (2, 2, 'Severe headache', 'Severe', '2026-10-02')
    `);

    // Appointments: Appt 1 for Doctor 1 + Patient 1, Appt 2 for Doctor 2 + Patient 2
    await testConn.execute(`
        INSERT INTO appointments (appointment_id, doctor_id, patient_id, appointment_date, start_time, end_time, reason, status) VALUES
        (1, 1, 1, '2026-10-15', '09:00:00', '09:30:00', 'Cardiac Consultation', 'scheduled'),
        (2, 2, 2, '2026-10-16', '10:00:00', '10:30:00', 'Neurology Consultation', 'scheduled')
    `);

    // Prescriptions: Presc 1 for Doctor 1 + Patient 1, Presc 2 for Doctor 2 + Patient 2
    await testConn.execute(`
        INSERT INTO prescriptions (prescription_id, doctor_id, patient_id, diagnosis, notes, prescription_date) VALUES
        (1, 1, 1, 'Stage 1 HTN', 'Low sodium diet', '2026-10-01 10:00:00'),
        (2, 2, 2, 'Migraine with Aura', 'Hydrate well', '2026-10-02 11:00:00')
    `);
    await testConn.execute(`
        INSERT INTO prescription_medicines (medicine_id, prescription_id, medicine_name, dosage, frequency, duration) VALUES
        (1, 1, 'Amlodipine', '5mg', 'Once daily', '30 days'),
        (2, 2, 'Sumatriptan', '50mg', 'As needed', '10 days')
    `);

    // Medical Reports: Report 1 for Patient 1, Report 2 for Patient 2
    await testConn.execute(`
        INSERT INTO medical_reports (report_id, patient_id, report_type, report_name, report_date, report_summary, file_path) VALUES
        (1, 1, 'Blood Test', 'CBC Report A', '2026-10-01', 'Normal', 'uploads/reports/aarav_cbc_report.pdf'),
        (2, 2, 'MRI', 'Brain MRI Report B', '2026-10-02', 'Normal MRI', 'uploads/reports/aarav_cbc_report.pdf'),
        (3, 1, 'Path Traversal Test', 'Evil Report', '2026-10-03', 'Traversal', 'uploads/reports/../../server.js')
    `);

    // Doctor Schedule
    await testConn.execute(`
        INSERT INTO doctor_schedule (schedule_id, doctor_id, day_of_week, start_time, end_time, activity_type, available) VALUES
        (1, 1, 'Monday', '09:00:00', '12:00:00', 'OPD', 1),
        (2, 2, 'Tuesday', '10:00:00', '13:00:00', 'Consultation', 1)
    `);

    console.log("Fixtures successfully inserted.");

    // 4. Start Express App pointing to disposable test database
    const app = require("../Portal Major P/Bhumi/Doctor portal/backend/src/app");
    const server = app.listen(5002);
    console.log("Test Express server listening on port 5002.");

    const results = [];
    function record(step, testName, expected, actual, status, details = "") {
        results.push({ step, testName, expected, actual, status, details });
        console.log(`[${status}] ${step} - ${testName}: actual=${actual} (expected=${expected}) ${details ? "- " + details : ""}`);
    }

    const BASE = "http://localhost:5002";

    try {
        // --- STEP 4: AUTHENTICATION PROOF ---
        // Doctor A login
        const loginResA = await fetch(`${BASE}/api/auth/doctor/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "alice@gmail.com", password: "doctor123" })
        });
        const loginDataA = await loginResA.json();
        const tokenA = loginDataA.token;
        record("Step 4", "Doctor A Login", "200", String(loginResA.status), loginResA.status === 200 ? "PASS" : "FAIL");

        // Doctor B login
        const loginResB = await fetch(`${BASE}/api/auth/doctor/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "bob@gmail.com", password: "doctor123" })
        });
        const loginDataB = await loginResB.json();
        const tokenB = loginDataB.token;
        record("Step 4", "Doctor B Login", "200", String(loginResB.status), loginResB.status === 200 ? "PASS" : "FAIL");

        // Verify distinct identity
        const profResA = await fetch(`${BASE}/api/doctor/profile`, { headers: { Authorization: "Bearer " + tokenA } });
        const profA = (await profResA.json()).doctor;
        const profResB = await fetch(`${BASE}/api/doctor/profile`, { headers: { Authorization: "Bearer " + tokenB } });
        const profB = (await profResB.json()).doctor;
        record("Step 4", "Distinct Doctor A Profile", "1", String(profA.doctor_id), profA.doctor_id === 1 ? "PASS" : "FAIL", profA.full_name);
        record("Step 4", "Distinct Doctor B Profile", "2", String(profB.doctor_id), profB.doctor_id === 2 ? "PASS" : "FAIL", profB.full_name);

        // --- STEP 5: PATIENT-LEVEL BOLA TEST ---
        // Test A: Doctor A -> Patient A (positive control)
        const paRes = await fetch(`${BASE}/api/doctor/patients/1`, { headers: { Authorization: "Bearer " + tokenA } });
        const paData = await paRes.json();
        record("Step 5", "Doctor A -> Patient A (Legitimate)", "200", String(paRes.status), paRes.status === 200 ? "PASS" : "FAIL", paData.patient?.full_name);

        // Test B: Doctor A -> Patient B (BOLA protection)
        const pbRes = await fetch(`${BASE}/api/doctor/patients/2`, { headers: { Authorization: "Bearer " + tokenA } });
        const pbData = await pbRes.json();
        const pbLeaked = pbData.patient || pbData.medical_history || pbData.symptoms || pbData.prescriptions;
        record("Step 5", "Doctor A -> Patient B (Unauthorized)", "403", String(pbRes.status), (pbRes.status === 403 && !pbLeaked) ? "PASS" : "FAIL", pbLeaked ? "LEAKED MEDICAL DATA" : "0 bytes leaked");

        // Test C: Doctor B -> Patient A (BOLA protection reverse)
        const pbaRes = await fetch(`${BASE}/api/doctor/patients/1`, { headers: { Authorization: "Bearer " + tokenB } });
        const pbaData = await pbaRes.json();
        const pbaLeaked = pbaData.patient || pbaData.medical_history || pbaData.symptoms || pbaData.prescriptions;
        record("Step 5", "Doctor B -> Patient A (Unauthorized Reverse)", "403", String(pbaRes.status), (pbaRes.status === 403 && !pbaLeaked) ? "PASS" : "FAIL", pbaLeaked ? "LEAKED MEDICAL DATA" : "0 bytes leaked");

        // Test D: Doctor B -> Patient B (Legitimate positive control)
        const pbbRes = await fetch(`${BASE}/api/doctor/patients/2`, { headers: { Authorization: "Bearer " + tokenB } });
        const pbbData = await pbbRes.json();
        record("Step 5", "Doctor B -> Patient B (Legitimate)", "200", String(pbbRes.status), pbbRes.status === 200 ? "PASS" : "FAIL", pbbData.patient?.full_name);

        // Nested prescriptions: Doctor A -> Patient A prescriptions
        const prescARes = await fetch(`${BASE}/api/doctor/patients/1/prescriptions`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 5", "Doctor A -> Patient A Prescriptions (Legitimate)", "200", String(prescARes.status), prescARes.status === 200 ? "PASS" : "FAIL");

        // Nested prescriptions: Doctor A -> Patient B prescriptions (Unauthorized)
        const prescBRes = await fetch(`${BASE}/api/doctor/patients/2/prescriptions`, { headers: { Authorization: "Bearer " + tokenA } });
        const prescBData = await prescBRes.json();
        record("Step 5", "Doctor A -> Patient B Prescriptions (Unauthorized)", "403", String(prescBRes.status), (prescBRes.status === 403 && !prescBData.prescriptions) ? "PASS" : "FAIL");

        // --- STEP 6: CROSS-DOCTOR APPOINTMENT OBJECT BOLA ---
        // Doctor A attempts to update Appointment B (doctor_id = 2)
        const apptModA = await fetch(`${BASE}/api/doctor/appointments/2/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ status: "completed" })
        });
        const [appt2Check1] = await testConn.execute("SELECT status FROM appointments WHERE appointment_id = 2");
        const appt2Unchanged = appt2Check1[0].status === "scheduled";
        record("Step 6", "Doctor A -> Appointment B Status (Cross-Doctor Unauthorized)", "403", String(apptModA.status), (apptModA.status === 403 && appt2Unchanged) ? "PASS" : "FAIL", `DB status: ${appt2Check1[0].status}`);

        // Doctor B legitimately updates Appointment B
        const apptModB = await fetch(`${BASE}/api/doctor/appointments/2/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenB },
            body: JSON.stringify({ status: "completed" })
        });
        const [appt2Check2] = await testConn.execute("SELECT status FROM appointments WHERE appointment_id = 2");
        record("Step 6", "Doctor B -> Appointment B Status (Legitimate)", "200", String(apptModB.status), (apptModB.status === 200 && appt2Check2[0].status === "completed") ? "PASS" : "FAIL", `DB status: ${appt2Check2[0].status}`);

        // --- STEP 7: CROSS-DOCTOR PRESCRIPTION OBJECT BOLA ---
        // Doctor A attempts to download Prescription B PDF
        const prescPdfA = await fetch(`${BASE}/api/doctor/prescriptions/2/pdf`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 7", "Doctor A -> Prescription B PDF (Cross-Doctor Unauthorized)", "403", String(prescPdfA.status), prescPdfA.status === 403 ? "PASS" : "FAIL");

        // Doctor B downloads Prescription B PDF
        const prescPdfB = await fetch(`${BASE}/api/doctor/prescriptions/2/pdf`, { headers: { Authorization: "Bearer " + tokenB } });
        record("Step 7", "Doctor B -> Prescription B PDF (Legitimate)", "200", String(prescPdfB.status), (prescPdfB.status === 200 && prescPdfB.headers.get("content-type") === "application/pdf") ? "PASS" : "FAIL", prescPdfB.headers.get("content-type"));

        // Doctor B attempts to download Prescription A PDF (Reverse)
        const prescPdfBA = await fetch(`${BASE}/api/doctor/prescriptions/1/pdf`, { headers: { Authorization: "Bearer " + tokenB } });
        record("Step 7", "Doctor B -> Prescription A PDF (Cross-Doctor Unauthorized Reverse)", "403", String(prescPdfBA.status), prescPdfBA.status === 403 ? "PASS" : "FAIL");

        // --- STEP 8: CROSS-DOCTOR MEDICAL REPORT BOLA ---
        // Doctor A attempts to access Report B (Patient B, Doctor B)
        const repA = await fetch(`${BASE}/api/doctor/reports/2`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 8", "Doctor A -> Report B (Cross-Doctor Unauthorized)", "403", String(repA.status), repA.status === 403 ? "PASS" : "FAIL");

        // Doctor B accesses Report B
        const repB = await fetch(`${BASE}/api/doctor/reports/2`, { headers: { Authorization: "Bearer " + tokenB } });
        record("Step 8", "Doctor B -> Report B (Legitimate)", "200", String(repB.status), (repB.status === 200 && repB.headers.get("content-type") === "application/pdf") ? "PASS" : "FAIL", repB.headers.get("content-type"));

        // Doctor B attempts to access Report A (Reverse)
        const repBA = await fetch(`${BASE}/api/doctor/reports/1`, { headers: { Authorization: "Bearer " + tokenB } });
        record("Step 8", "Doctor B -> Report A (Cross-Doctor Unauthorized Reverse)", "403", String(repBA.status), repBA.status === 403 ? "PASS" : "FAIL");

        // Unauthenticated Report Access
        const repUnauth = await fetch(`${BASE}/api/doctor/reports/2`);
        record("Step 8", "Unauthenticated Report Access", "401", String(repUnauth.status), repUnauth.status === 401 ? "PASS" : "FAIL");

        // Invalid Report ID
        const repInv = await fetch(`${BASE}/api/doctor/reports/999999`, { headers: { Authorization: "Bearer " + tokenB } });
        record("Step 8", "Invalid Report ID (999999)", "404", String(repInv.status), repInv.status === 404 ? "PASS" : "FAIL");

        // Old public static path
        const oldStatic = await fetch(`${BASE}/uploads/reports/aarav_cbc_report.pdf`);
        record("Step 8", "Old Public Static Path Bypass", "404", String(oldStatic.status), oldStatic.status === 404 ? "PASS" : "FAIL");

        // Path Traversal Attempt (Report 3 has file_path with ../../)
        const repTrav = await fetch(`${BASE}/api/doctor/reports/3`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 8", "Path Traversal Protection", "403", String(repTrav.status), repTrav.status === 403 ? "PASS" : "FAIL");

        // --- STEP 9: APPOINTMENT AUTHORIZATION MANUFACTURING TEST ---
        const [apptsBeforeA] = await testConn.execute("SELECT COUNT(*) as cnt FROM appointments WHERE doctor_id = 1");
        const createNonAuthAppt = await fetch(`${BASE}/api/doctor/appointments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({
                patient_id: 2,
                appointment_date: "2026-10-20",
                start_time: "14:00:00",
                reason: "Unauthorized attempt"
            })
        });
        const [apptsAfterA] = await testConn.execute("SELECT COUNT(*) as cnt FROM appointments WHERE doctor_id = 1");
        const apptNotCreated = apptsBeforeA[0].cnt === apptsAfterA[0].cnt;
        record("Step 9", "Appointment Manufacturing Bypass Prevention", "403", String(createNonAuthAppt.status), (createNonAuthAppt.status === 403 && apptNotCreated) ? "PASS" : "FAIL", `DB count before: ${apptsBeforeA[0].cnt}, after: ${apptsAfterA[0].cnt}`);

        // --- STEP 10: PRESCRIPTION AUTHORIZATION MANUFACTURING TEST ---
        const [prescBeforeA] = await testConn.execute("SELECT COUNT(*) as cnt FROM prescriptions WHERE doctor_id = 1");
        const createNonAuthPresc = await fetch(`${BASE}/api/doctor/prescriptions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({
                patient_id: 2,
                diagnosis: "Malicious diagnosis",
                medicines: [{ medicine_name: "Drug X", dosage: "10mg" }]
            })
        });
        const [prescAfterA] = await testConn.execute("SELECT COUNT(*) as cnt FROM prescriptions WHERE doctor_id = 1");
        const prescNotCreated = prescBeforeA[0].cnt === prescAfterA[0].cnt;
        record("Step 10", "Prescription Manufacturing Bypass Prevention", "403", String(createNonAuthPresc.status), (createNonAuthPresc.status === 403 && prescNotCreated) ? "PASS" : "FAIL", `DB count before: ${prescBeforeA[0].cnt}, after: ${prescAfterA[0].cnt}`);

        // --- STEP 11: PATIENT LIST CONSISTENCY ---
        const plistA = await fetch(`${BASE}/api/doctor/patients`, { headers: { Authorization: "Bearer " + tokenA } });
        const plistAData = await plistA.json();
        const plistB = await fetch(`${BASE}/api/doctor/patients`, { headers: { Authorization: "Bearer " + tokenB } });
        const plistBData = await plistB.json();
        const aSeesOnlyA = plistAData.patients.length === 1 && plistAData.patients[0].patient_id === 1;
        const bSeesOnlyB = plistBData.patients.length === 1 && plistBData.patients[0].patient_id === 2;
        record("Step 11", "Doctor A Patient List Isolation", "1 (Patient 1 only)", String(plistAData.patients.length), aSeesOnlyA ? "PASS" : "FAIL");
        record("Step 11", "Doctor B Patient List Isolation", "1 (Patient 2 only)", String(plistBData.patients.length), bSeesOnlyB ? "PASS" : "FAIL");

        // --- STEP 13: FULL ROUTE REGRESSION (17 ROUTES) ---
        const rProfileGet = await fetch(`${BASE}/api/doctor/profile`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /profile", "200", String(rProfileGet.status), rProfileGet.status === 200 ? "PASS" : "FAIL");

        const rProfilePut = await fetch(`${BASE}/api/doctor/profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ full_name: "Dr. Alice Smith Updated" })
        });
        record("Step 13", "PUT /profile", "200", String(rProfilePut.status), rProfilePut.status === 200 ? "PASS" : "FAIL");

        const rDashGet = await fetch(`${BASE}/api/doctor/dashboard`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /dashboard", "200", String(rDashGet.status), rDashGet.status === 200 ? "PASS" : "FAIL");

        const rPatientsGet = await fetch(`${BASE}/api/doctor/patients`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /patients", "200", String(rPatientsGet.status), rPatientsGet.status === 200 ? "PASS" : "FAIL");

        const rPatDetailsGet = await fetch(`${BASE}/api/doctor/patients/1`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /patients/:patientId", "200", String(rPatDetailsGet.status), rPatDetailsGet.status === 200 ? "PASS" : "FAIL");

        const rPatPrescGet = await fetch(`${BASE}/api/doctor/patients/1/prescriptions`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /patients/:patientId/prescriptions", "200", String(rPatPrescGet.status), rPatPrescGet.status === 200 ? "PASS" : "FAIL");

        const rApptsGet = await fetch(`${BASE}/api/doctor/appointments`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /appointments", "200", String(rApptsGet.status), rApptsGet.status === 200 ? "PASS" : "FAIL");

        const rApptPost = await fetch(`${BASE}/api/doctor/appointments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ patient_id: 1, appointment_date: "2026-10-25", start_time: "15:00:00", reason: "Followup Checkup" })
        });
        record("Step 13", "POST /appointments (Authorized)", "201", String(rApptPost.status), rApptPost.status === 201 ? "PASS" : "FAIL");

        const rApptStatusPut = await fetch(`${BASE}/api/doctor/appointments/1/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ status: "completed" })
        });
        record("Step 13", "PUT /appointments/:appointmentId/status (Authorized)", "200", String(rApptStatusPut.status), rApptStatusPut.status === 200 ? "PASS" : "FAIL");

        const rPrescPost = await fetch(`${BASE}/api/doctor/prescriptions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ patient_id: 1, diagnosis: "Routine Check", medicines: [{ medicine_name: "Vitamin D3", dosage: "60000 IU" }] })
        });
        record("Step 13", "POST /prescriptions (Authorized)", "201", String(rPrescPost.status), rPrescPost.status === 201 ? "PASS" : "FAIL");

        const rPrescPdfGet = await fetch(`${BASE}/api/doctor/prescriptions/1/pdf`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /prescriptions/:prescriptionId/pdf (Authorized)", "200", String(rPrescPdfGet.status), rPrescPdfGet.status === 200 ? "PASS" : "FAIL");

        const rReportGet = await fetch(`${BASE}/api/doctor/reports/1`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /reports/:reportId (Authorized)", "200", String(rReportGet.status), rReportGet.status === 200 ? "PASS" : "FAIL");

        const rSchedGet = await fetch(`${BASE}/api/doctor/schedule`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /schedule", "200", String(rSchedGet.status), rSchedGet.status === 200 ? "PASS" : "FAIL");

        const rSchedPost = await fetch(`${BASE}/api/doctor/schedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + tokenA },
            body: JSON.stringify({ day_of_week: "Wednesday", start_time: "08:00:00", end_time: "11:00:00", activity_type: "Ward Rounds" })
        });
        const rSchedPostData = await rSchedPost.json();
        const schedCreatedId = rSchedPostData.schedule_id;
        record("Step 13", "POST /schedule (Authorized)", "201", String(rSchedPost.status), rSchedPost.status === 201 ? "PASS" : "FAIL");

        const rSchedDel = await fetch(`${BASE}/api/doctor/schedule/${schedCreatedId}`, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + tokenA }
        });
        record("Step 13", "DELETE /schedule/:scheduleId (Authorized)", "200", String(rSchedDel.status), rSchedDel.status === 200 ? "PASS" : "FAIL");

        const rFollowupGet = await fetch(`${BASE}/api/doctor/followups`, { headers: { Authorization: "Bearer " + tokenA } });
        record("Step 13", "GET /followups (Safe Isolation)", "501", String(rFollowupGet.status), rFollowupGet.status === 501 ? "PASS" : "FAIL");

        const rFollowupPost = await fetch(`${BASE}/api/doctor/followups`, {
            method: "POST",
            headers: { Authorization: "Bearer " + tokenA }
        });
        record("Step 13", "POST /followups (Safe Isolation)", "501", String(rFollowupPost.status), rFollowupPost.status === 501 ? "PASS" : "FAIL");

    } finally {
        server.close();
        await testConn.end();
        console.log("Test server closed and test DB connection ended.");
    }

    // Step 14: Drop the disposable test database
    console.log(`Dropping disposable database ${testDbName}...`);
    await rootConn.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    console.log("Disposable test database dropped.");

    // Step 14: Verify development database rag_healthcare remains intact
    const [devTables] = await rootConn.execute("SHOW TABLES FROM `rag_healthcare`");
    console.log("=== VERIFYING DEVELOPMENT DATABASE rag_healthcare ===");
    const finalCounts = {};
    for (const t of devTables) {
        const tbl = Object.values(t)[0];
        const [cnt] = await rootConn.execute(`SELECT COUNT(*) as cnt FROM \`rag_healthcare\`.\`${tbl}\``);
        finalCounts[tbl] = cnt[0].cnt;
    }
    console.table(finalCounts);

    await rootConn.end();

    const allPassed = results.every(r => r.status === "PASS");
    console.log("\n==================================================");
    console.log(`TOTAL TESTS: ${results.length} | ALL PASSED: ${allPassed}`);
    console.log("==================================================");

    fs.writeFileSync(
        path.join(__dirname, "phase1_bola_evidence.json"),
        JSON.stringify({ results, finalCounts, allPassed }, null, 2)
    );
}

runVerification().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
