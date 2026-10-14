const http = require("http");

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

async function runRegression() {
    console.log("=== PHASE 0 COMPREHENSIVE REGRESSION TEST ===");

    // 1. Root / health
    const rootRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/",
        method: "GET"
    });
    console.log(`1. Root endpoint: [${rootRes.status === 200 ? "PASS" : "FAIL"}] Status ${rootRes.status}:`, rootRes.body.message);

    // 2. Doctor Login
    const loginRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/auth/doctor/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { email: "doctor@gmail.com", password: "doctor123" });
    const token = loginRes.body?.token;
    console.log(`2. Doctor login: [${loginRes.status === 200 && token ? "PASS" : "FAIL"}] Status ${loginRes.status}, token acquired:`, !!token);

    if (!token) {
        console.error("Login failed, aborting further authenticated tests.");
        process.exit(1);
    }

    const authHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    // 3. Dashboard
    const dashRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/dashboard",
        method: "GET",
        headers: authHeaders
    });
    console.log(`3. Doctor Dashboard: [${dashRes.status === 200 ? "PASS" : "FAIL"}] Status ${dashRes.status}, patients count: ${dashRes.body?.total_patients ?? "N/A"}`);

    // 4. Patients List
    const patientsRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/patients",
        method: "GET",
        headers: authHeaders
    });
    const patients = patientsRes.body?.patients || [];
    console.log(`4. Patient list: [${patientsRes.status === 200 ? "PASS" : "FAIL"}] Status ${patientsRes.status}, count: ${patients.length}`);

    // 5. Patient Details (including symptoms and history)
    const testPatientId = patients[0]?.patient_id || 1;
    const patientDetailsRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: `/api/doctor/patients/${testPatientId}`,
        method: "GET",
        headers: authHeaders
    });
    const symptoms = patientDetailsRes.body?.symptoms || [];
    const medicalHistory = patientDetailsRes.body?.medical_history || [];
    console.log(`5. Patient details (Symptoms/History): [${patientDetailsRes.status === 200 ? "PASS" : "FAIL"}] Status ${patientDetailsRes.status}, Symptoms: ${symptoms.length}, History entries: ${medicalHistory.length}`);

    // 6. Appointments
    const apptsRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/appointments",
        method: "GET",
        headers: authHeaders
    });
    console.log(`6. Doctor Appointments: [${apptsRes.status === 200 ? "PASS" : "FAIL"}] Status ${apptsRes.status}, count: ${(apptsRes.body?.appointments || []).length}`);

    // 7. Doctor Schedule
    const schedRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/schedule",
        method: "GET",
        headers: authHeaders
    });
    console.log(`7. Doctor Schedule: [${schedRes.status === 200 ? "PASS" : "FAIL"}] Status ${schedRes.status}, count: ${(schedRes.body?.schedule || []).length}`);

    // 8. Prescription Creation
    const prescRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/prescriptions",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: testPatientId,
        diagnosis: "Phase 0 Verification Checkup",
        notes: "Automated regression verification test",
        medicines: [
            {
                medicine_name: "Amoxicillin",
                dosage: "500mg",
                frequency: "TDS",
                duration: "5 days",
                instructions: "After food"
            }
        ]
    });
    const prescriptionId = prescRes.body?.prescription_id;
    console.log(`8. Prescription creation: [${prescRes.status === 201 && prescriptionId ? "PASS" : "FAIL"}] Status ${prescRes.status}, Prescription ID: ${prescriptionId}`);

    // 9. Prescription PDF
    let pdfPass = false;
    if (prescriptionId) {
        const pdfRes = await request({
            hostname: "127.0.0.1",
            port: 5000,
            path: `/api/doctor/prescriptions/${prescriptionId}/pdf`,
            method: "GET",
            headers: authHeaders
        });
        const contentType = pdfRes.headers["content-type"];
        pdfPass = pdfRes.status === 200 && contentType?.includes("pdf");
        console.log(`9. Prescription PDF Generation: [${pdfPass ? "PASS" : "FAIL"}] Status ${pdfRes.status}, Content-Type: ${contentType}`);
    } else {
        console.log(`9. Prescription PDF Generation: [SKIP] No prescription created`);
    }

    // 10. Followup Endpoint (Verify 501 Not Implemented, NO 500 MySQL Error)
    const getFollowupRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/followups",
        method: "GET",
        headers: authHeaders
    });
    const postFollowupRes = await request({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/followups",
        method: "POST",
        headers: authHeaders
    }, {
        patient_id: testPatientId,
        followup_date: "2026-10-15",
        reason: "Routine check"
    });

    const followupControlled = getFollowupRes.status === 501 && postFollowupRes.status === 501;
    console.log(`10. Followup Endpoint isolation (GET): [${getFollowupRes.status === 501 ? "PASS" : "FAIL"}] Status ${getFollowupRes.status}, Message: "${getFollowupRes.body?.message}"`);
    console.log(`10. Followup Endpoint isolation (POST): [${postFollowupRes.status === 501 ? "PASS" : "FAIL"}] Status ${postFollowupRes.status}, Message: "${postFollowupRes.body?.message}"`);

    console.log("\n=== ALL REGRESSION TESTS EXECUTED ===");
}

runRegression().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
