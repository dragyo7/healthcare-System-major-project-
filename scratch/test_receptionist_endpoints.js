/**
 * test_receptionist_endpoints.js
 * Verification of Phase 1 Secure Receptionist Integration
 */

const http = require("http");
const { verifyDestructiveTestSafety, probeGatewaySafety } = require("../tests/safety/databaseSafetyGuard");

const PORT = parseInt(process.env.TEST_EXPRESS_PORT || process.env.EXPRESS_PORT || "5001");

function httpRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const targetPort = options && options.port !== undefined
            ? (process.env.TEST_EXPRESS_PORT ? parseInt(process.env.TEST_EXPRESS_PORT) : options.port)
            : PORT;

        if (Number(targetPort) === 5000 && process.env.ALLOW_DEFAULT_DEV_PORT !== "true") {
            return reject(new Error(
                "SAFETY REFUSAL: httpRequest is targeting port 5000 (default development port). " +
                "Tests must target a dedicated test backend (e.g. TEST_EXPRESS_PORT=5001) to avoid mutating development data."
            ));
        }

        const opts = {
            hostname: "127.0.0.1",
            ...options,
            port: targetPort
        };
        const req = http.request(opts, (res) => {
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

async function runTests() {
    console.log("=================================================");
    console.log("  PHASE 1: RECEPTIONIST PORTAL VERIFICATION SUITE ");
    console.log("=================================================\n");

    const targetDb = (process.env.DB_NAME || "").trim();
    verifyDestructiveTestSafety(targetDb);
    await probeGatewaySafety(PORT, targetDb);

    let passed = 0;
    let failed = 0;

    function assert(name, condition, details = "") {
        if (condition) {
            console.log(`[PASS] ${name} ${details ? "-> " + details : ""}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} ${details ? "-> " + details : ""}`);
            failed++;
        }
    }

    // 1. Receptionist Login
    const loginRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/auth/receptionist/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, {
        email: "receptionist@gmail.com",
        password: "receptionist123"
    });

    assert("1. Receptionist Login succeeds", loginRes.status === 200 && loginRes.body.token, `Token: ${loginRes.body.token?.substring(0, 15)}...`);
    const token = loginRes.body.token;

    // 2. Unauthenticated access rejected
    const unauthRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/receptionist/doctors",
        method: "GET"
    });
    assert("2. Unauthenticated access returns 401", unauthRes.status === 401);

    // 3. Get Doctors
    const doctorsRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/receptionist/doctors",
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });
    assert("3. Get Doctors directory", doctorsRes.status === 200 && doctorsRes.body.doctors?.length > 0, `Count: ${doctorsRes.body.count}`);

    // 4. Get Patients
    const patientsRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/receptionist/patients",
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });
    assert("4. Get Patients list", patientsRes.status === 200 && patientsRes.body.patients?.length > 0, `Count: ${patientsRes.body.count}`);

    // 5. Register New Patient
    const uniqueEmail = `testpatient_${Date.now()}@example.com`;
    const regRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/receptionist/patients",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }, {
        full_name: "Ramesh Kulkarni",
        email: uniqueEmail,
        phone: "9823012345",
        date_of_birth: "1988-03-22",
        gender: "Male",
        blood_group: "A+",
        address: "Pune, Maharashtra",
        emergency_contact: "9823012346",
        allergies: "Sulfa drugs"
    });
    assert("5. Register Patient creates user + patient records", regRes.status === 201 && regRes.body.patient?.patient_id, `Patient ID: ${regRes.body.patient?.patient_id}`);
    const newPatientId = regRes.body.patient?.patient_id;

    // 6. Schedule Appointment
    const apptRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/receptionist/appointments",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }, {
        patient_id: newPatientId,
        doctor_id: 1,
        appointment_date: "2026-11-20",
        start_time: "11:00:00",
        reason: "Initial cardiovascular consultation"
    });
    assert("6. Schedule Appointment persists to appointments table", apptRes.status === 201 && apptRes.body.appointment_id, `Appt ID: ${apptRes.body.appointment_id}`);
    const newApptId = apptRes.body.appointment_id;

    // 7. Update Appointment Status
    const updateRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: `/api/receptionist/appointments/${newApptId}/status`,
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }, {
        status: "completed"
    });
    assert("7. Update Appointment status to completed", updateRes.status === 200 && updateRes.body.status === "completed");

    // 8. Negative Security: Receptionist blocked from Doctor CDS
    const doctorCdsRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/doctor/cds",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }, {
        patient_id: 1,
        clinical_query: "What is the dosage for Lisinopril?"
    });
    assert("8. Receptionist token blocked from Doctor CDS (403)", doctorCdsRes.status === 403);

    // 9. Negative Security: Receptionist blocked from Patient CDS
    const patientCdsRes = await httpRequest({
        hostname: "127.0.0.1",
        port: 5000,
        path: "/api/patient/cds",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    }, {
        clinical_query: "Can I take aspirin with warfarin?"
    });
    assert("9. Receptionist token blocked from Patient CDS (403)", patientCdsRes.status === 403);

    console.log(`\n=================================================`);
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`=================================================`);

    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
