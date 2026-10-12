const http = require("http");
const jwt = require("jsonwebtoken");

async function request(options, postData) {
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

async function runSecurityAudit() {
    console.log("=================================================================");
    console.log("  PHASE 1 FORENSIC SECURITY & REGRESSION AUDIT SUITE");
    console.log("=================================================================\n");

    // 1. Doctor Login (Doctor 1)
    const loginRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/auth/doctor/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { email: "doctor@gmail.com", password: "doctor123" });

    const token = loginRes.body?.token;
    console.log(`[AUTH] Doctor login: Status ${loginRes.status}, Token: ${!!token}`);
    if (!token) {
        console.error("FATAL: Doctor login failed!");
        process.exit(1);
    }

    const authHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    // Create a rogue / second doctor JWT token (Doctor 2: user_id=99, role="doctor")
    const rogueToken = jwt.sign(
        { user_id: 99, role: "doctor" },
        "rag_healthcare_secret",
        { expiresIn: "1h" }
    );
    const rogueHeaders = {
        "Authorization": `Bearer ${rogueToken}`,
        "Content-Type": "application/json"
    };

    console.log("\n--- SECTION A: BOLA / HORIZONTAL PATIENT ACCESS TESTS ---");

    // Case A: Authorized doctor -> authorized patient (Patient 1)
    const caseA = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients/1",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Case A (Authorized doctor -> Patient 1): Status ${caseA.status} (Expected 200). Has dossier data: ${!!caseA.body?.patient}`);

    // Case B: Authorized doctor -> unauthorized patient (Patient 999 - patient with no clinical relationship)
    const caseB = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients/999",
        method: "GET",
        headers: authHeaders
    });
    const leakedDataCaseB = caseB.body?.patient || caseB.body?.medical_history || caseB.body?.symptoms;
    console.log(`Case B (Authorized doctor -> Unauthorized Patient 999): Status ${caseB.status} (Expected 403). Leaked sensitive data: ${!!leakedDataCaseB}. Message: "${caseB.body?.message}"`);

    // Case B2: BOLA Escalation Prevention (Doctor attempts to manufacture authorization by booking appointment for Patient 999)
    const caseB2 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/appointments",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 999,
        appointment_date: "2026-11-01",
        start_time: "10:00:00"
    });
    console.log(`Case B2 (BOLA Loop Prevention: POST /appointments for Patient 999): Status ${caseB2.status} (Expected 403). Message: "${caseB2.body?.message}"`);

    // Case B3: Prescription creation for unauthorized patient (Patient 999)
    const caseB3 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/prescriptions",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: 999,
        diagnosis: "Malicious Injection",
        medicines: [{ medicine_name: "TestMed" }]
    });
    console.log(`Case B3 (POST /prescriptions for unauthorized Patient 999): Status ${caseB3.status} (Expected 403). Message: "${caseB3.body?.message}"`);

    // Case C: Cross-Doctor Appointment Access (Doctor 2 -> Doctor 1's Appointment 1)
    const caseC = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/appointments/1/status",
        method: "PUT",
        headers: rogueHeaders
    }, { status: "cancelled" });
    console.log(`Case C (Rogue Doctor -> Doctor 1's Appointment 1 PUT status): Status ${caseC.status} (Expected 403 or 404). Message: "${caseC.body?.message}"`);

    // Case D: Cross-Doctor Prescription PDF Access (Doctor 2 -> Doctor 1's Prescription 1)
    const caseD = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/prescriptions/1/pdf",
        method: "GET",
        headers: rogueHeaders
    });
    console.log(`Case D (Rogue Doctor -> Doctor 1's Prescription 1 PDF): Status ${caseD.status} (Expected 403 or 404). Message: "${caseD.body?.message}"`);

    // Case E: Cross-Doctor Medical Report Access (Doctor 2 -> Report 1 belonging to Patient 1)
    const caseE = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/1",
        method: "GET",
        headers: rogueHeaders
    });
    console.log(`Case E (Rogue Doctor -> Report 1): Status ${caseE.status} (Expected 403 or 404). Message: "${caseE.body?.message}"`);

    // Case F: Unauthenticated requests
    const caseF1 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients/1",
        method: "GET"
    });
    const caseF2 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/1",
        method: "GET"
    });
    console.log(`Case F1 (Unauthenticated GET /patients/1): Status ${caseF1.status} (Expected 401). Message: "${caseF1.body?.message}"`);
    console.log(`Case F2 (Unauthenticated GET /reports/1): Status ${caseF2.status} (Expected 401). Message: "${caseF2.body?.message}"`);

    // Case G: Invalid object IDs
    const caseG1 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/99999",
        method: "GET",
        headers: authHeaders
    });
    const caseG2 = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/prescriptions/99999/pdf",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Case G1 (Invalid Report 99999): Status ${caseG1.status} (Expected 404). Message: "${caseG1.body?.message}"`);
    console.log(`Case G2 (Invalid Prescription 99999): Status ${caseG2.status} (Expected 404). Message: "${caseG2.body?.message}"`);

    console.log("\n--- SECTION B: MEDICAL REPORT PROTECTION TESTS ---");

    // 1. Old Public Static Bypass Test
    const pubBypass = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/uploads/reports/aarav_cbc_report.pdf",
        method: "GET"
    });
    console.log(`Old Public Path (/uploads/reports/aarav_cbc_report.pdf): Status ${pubBypass.status} (Expected NOT 200, strictly 404).`);

    // 2. Authenticated Authorized Doctor Report Retrieval
    const authReport = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/1",
        method: "GET",
        headers: authHeaders
    });
    const isPdf = authReport.headers["content-type"]?.includes("pdf");
    console.log(`Authorized Report Retrieval (/api/doctor/reports/1): Status ${authReport.status} (Expected 200), Content-Type: ${authReport.headers["content-type"]}, Is PDF: ${isPdf}`);

    // 3. Report without attached file (Report 2: file_path is NULL)
    const noFileReport = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/2",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Report with NULL file_path (/api/doctor/reports/2): Status ${noFileReport.status} (Expected 404). Message: "${noFileReport.body?.message}"`);

    // 4. Path Traversal Test via URL encoding
    const traversalTest = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/reports/1/../../../../etc/passwd",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Path Traversal Attempt: Status ${traversalTest.status} (Expected 404 or 403, NEVER 200).`);

    console.log("\n--- SECTION C: REGRESSION VERIFICATION ---");

    // 1. Dashboard
    const dash = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/dashboard",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Dashboard: Status ${dash.status} [${dash.status === 200 ? "PASS" : "FAIL"}]`);

    // 2. Patient List
    const patients = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Patient List: Status ${patients.status} [${patients.status === 200 ? "PASS" : "FAIL"}], Count: ${patients.body?.patients?.length}`);

    // 3. Schedule
    const sched = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/schedule",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Doctor Schedule: Status ${sched.status} [${sched.status === 200 ? "PASS" : "FAIL"}], Slots: ${sched.body?.schedule?.length}`);

    // 4. Appointments
    const appts = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/appointments",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Appointments: Status ${appts.status} [${appts.status === 200 ? "PASS" : "FAIL"}], Count: ${appts.body?.appointments?.length}`);

    // 5. Prescription PDF (Prescription 1)
    const prescPdf = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/prescriptions/1/pdf",
        method: "GET",
        headers: authHeaders
    });
    console.log(`Prescription PDF: Status ${prescPdf.status} [${prescPdf.status === 200 ? "PASS" : "FAIL"}], Content-Type: ${prescPdf.headers["content-type"]}`);

    // 6. Followup endpoints
    const fGet = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/followups",
        method: "GET",
        headers: authHeaders
    });
    const fPost = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/followups",
        method: "POST",
        headers: authHeaders
    }, { patient_id: 1, followup_date: "2026-11-01" });
    console.log(`Followup GET: Status ${fGet.status} [${fGet.status === 501 ? "PASS" : "FAIL"}]`);
    console.log(`Followup POST: Status ${fPost.status} [${fPost.status === 501 ? "PASS" : "FAIL"}]`);

    console.log("\n=================================================================");
    console.log("  ALL TESTS EXECUTED");
    console.log("=================================================================");
}

runSecurityAudit().catch(err => {
    console.error("Audit test error:", err);
    process.exit(1);
});
