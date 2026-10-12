/**
 * test_route_authorization_matrix.js
 * 
 * Comprehensive endpoint-by-endpoint route authorization and cross-patient
 * isolation (BOLA/IDOR) verification suite.
 * 
 * Enforces:
 * 1. Unauthenticated requests return 401 Unauthorized
 * 2. Wrong-role requests return 403 Forbidden
 * 3. Authorized same-owner requests return 200/201
 * 4. Cross-patient tampering (path, query, body) is strictly rejected or scoped server-side
 * 5. Privilege escalation attempts in registration return 403
 * 6. Arbitrary user/patient ID injections return 400
 */

const {
  mysql,
  DB_CONFIG,
  httpRequest,
  generateToken,
} = require("./testHelper");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runAuthorizationMatrix() {
  console.log("\n==========================================================================");
  console.log("   ENDPOINT AUTHORIZATION & CROSS-PATIENT ISOLATION MATRIX (BOLA / IDOR)  ");
  console.log("==========================================================================\n");

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Fetch synthetic doctor, patient A, patient B, and receptionist IDs from database
    const [doctors] = await connection.execute(
      "SELECT d.doctor_id, u.user_id, u.email FROM doctors d JOIN users u ON d.user_id = u.user_id LIMIT 1"
    );
    const [patients] = await connection.execute(
      "SELECT p.patient_id, u.user_id, u.email FROM patients p JOIN users u ON p.user_id = u.user_id LIMIT 2"
    );
    const [receptionists] = await connection.execute(
      "SELECT user_id, email FROM users WHERE role = 'receptionist' LIMIT 1"
    );

    if (doctors.length === 0 || patients.length < 2 || receptionists.length === 0) {
      throw new Error("Insufficient synthetic users in database to run complete matrix. Run migrations and demo seeds first.");
    }

    const doctorUser = doctors[0];
    const patientA = patients[0];
    const patientB = patients[1];
    const receptionistUser = receptionists[0];

    const doctorToken = generateToken({ user_id: doctorUser.user_id, role: "doctor", email: doctorUser.email });
    const patientAToken = generateToken({ user_id: patientA.user_id, role: "patient", email: patientA.email });
    const patientBToken = generateToken({ user_id: patientB.user_id, role: "patient", email: patientB.email });
    const receptionistToken = generateToken({ user_id: receptionistUser.user_id, role: "receptionist", email: receptionistUser.email });

    console.log(`[Setup] Doctor User ID: ${doctorUser.user_id}, Patient A User ID: ${patientA.user_id}, Patient B User ID: ${patientB.user_id}, Receptionist User ID: ${receptionistUser.user_id}`);

    // =========================================================================
    // SECTION 1: Patient Profile & Dossier Isolation
    // =========================================================================
    console.log("\n--- Section 1: Patient Profile & Dossier Isolation ---");

    // 1.1 Unauthenticated
    let res = await httpRequest({ path: "/api/patient/profile", method: "GET" });
    assert(res.status === 401, "GET /api/patient/profile unauthenticated returns 401");

    // 1.2 Wrong role: Doctor
    res = await httpRequest({
      path: "/api/patient/profile",
      method: "GET",
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.status === 403, "GET /api/patient/profile with Doctor token returns 403");

    // 1.3 Wrong role: Receptionist
    res = await httpRequest({
      path: "/api/patient/profile",
      method: "GET",
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    assert(res.status === 403, "GET /api/patient/profile with Receptionist token returns 403");

    // 1.4 Authorized Patient A
    res = await httpRequest({
      path: "/api/patient/profile",
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(
      res.status === 200 && res.data.patient && res.data.patient.patient_id === patientA.patient_id,
      "GET /api/patient/profile Patient A returns only Patient A profile"
    );

    // 1.5 BOLA Attempt: Patient A queries Patient B via query param tampering
    res = await httpRequest({
      path: `/api/patient/profile?patient_id=${patientB.patient_id}&user_id=${patientB.user_id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(
      res.status === 200 && res.data.patient && res.data.patient.patient_id === patientA.patient_id,
      "BOLA defense: Tampered query params are ignored; server scopes strictly to caller JWT"
    );

    // =========================================================================
    // SECTION 2: Patient Prescriptions Isolation
    // =========================================================================
    console.log("\n--- Section 2: Patient Prescriptions Isolation ---");

    // 2.1 Unauthenticated
    res = await httpRequest({ path: "/api/patient/prescriptions", method: "GET" });
    assert(res.status === 401, "GET /api/patient/prescriptions unauthenticated returns 401");

    // 2.2 Wrong role: Doctor
    res = await httpRequest({
      path: "/api/patient/prescriptions",
      method: "GET",
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.status === 403, "GET /api/patient/prescriptions with Doctor token returns 403");

    // 2.3 Authorized Patient A
    res = await httpRequest({
      path: "/api/patient/prescriptions",
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.prescriptions), "GET /api/patient/prescriptions Patient A returns array of prescriptions");

    // 2.4 BOLA Check: Tampered patient_id in prescriptions query
    res = await httpRequest({
      path: `/api/patient/prescriptions?patient_id=${patientB.patient_id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    const leakFound = Array.isArray(res.data.prescriptions) && res.data.prescriptions.some((p) => p.patient_id === patientB.patient_id);
    assert(res.status === 200 && !leakFound, "BOLA defense: Patient A cannot access Patient B prescriptions via query tampering");

    // =========================================================================
    // SECTION 3: Post-Discharge Care Isolation
    // =========================================================================
    console.log("\n--- Section 3: Post-Discharge Care Isolation ---");

    // 3.1 Unauthenticated
    res = await httpRequest({ path: "/api/patient/discharge", method: "GET" });
    assert(res.status === 401, "GET /api/patient/discharge unauthenticated returns 401");

    // 3.2 Wrong role: Receptionist
    res = await httpRequest({
      path: "/api/patient/discharge",
      method: "GET",
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    assert(res.status === 403, "GET /api/patient/discharge with Receptionist token returns 403");

    // 3.3 Authorized Patient A
    res = await httpRequest({
      path: "/api/patient/discharge",
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(res.status === 200 && ("discharge" in res.data), "GET /api/patient/discharge Patient A returns discharge episode (or null if none)");

    // =========================================================================
    // SECTION 4: Doctor Privileged Clinical Routes
    // =========================================================================
    console.log("\n--- Section 4: Doctor Privileged Clinical Routes ---");

    // 4.1 GET /api/doctor/patients Unauthenticated
    res = await httpRequest({ path: "/api/doctor/patients", method: "GET" });
    assert(res.status === 401, "GET /api/doctor/patients unauthenticated returns 401");

    // 4.2 Patient token accessing doctor route
    res = await httpRequest({
      path: "/api/doctor/patients",
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(res.status === 403, "GET /api/doctor/patients with Patient token returns 403");

    // 4.3 Receptionist token accessing doctor route
    res = await httpRequest({
      path: "/api/doctor/patients",
      method: "GET",
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    assert(res.status === 403, "GET /api/doctor/patients with Receptionist token returns 403");

    // 4.4 Authorized Doctor
    res = await httpRequest({
      path: "/api/doctor/patients",
      method: "GET",
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.status === 200 && Array.isArray(res.data.patients), "GET /api/doctor/patients with Doctor token returns patient list");

    // 4.5 Doctor Discharge Creation: Unauthenticated
    res = await httpRequest(
      {
        path: "/api/doctor/discharge",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { patient_id: patientA.patient_id, diagnosis: "Test" }
    );
    assert(res.status === 401, "POST /api/doctor/discharge unauthenticated returns 401");

    // 4.6 Patient trying to create a discharge order
    res = await httpRequest(
      {
        path: "/api/doctor/discharge",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${patientAToken}`,
        },
      },
      { patient_id: patientA.patient_id, diagnosis: "Self discharge" }
    );
    assert(res.status === 403, "POST /api/doctor/discharge with Patient token returns 403");

    // 4.7 OCR Confirmation: Patient trying to sign off on OCR
    res = await httpRequest(
      {
        path: "/api/doctor/prescriptions/confirm-ocr",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${patientAToken}`,
        },
      },
      { job_id: 1 }
    );
    assert(res.status === 403, "POST /api/doctor/prescriptions/confirm-ocr with Patient token returns 403");

    // 4.8 OCR Confirmation: Receptionist trying to sign off on OCR
    res = await httpRequest(
      {
        path: "/api/doctor/prescriptions/confirm-ocr",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${receptionistToken}`,
        },
      },
      { job_id: 1 }
    );
    assert(res.status === 403, "POST /api/doctor/prescriptions/confirm-ocr with Receptionist token returns 403");

    // =========================================================================
    // SECTION 5: Receptionist Administrative Operations
    // =========================================================================
    console.log("\n--- Section 5: Receptionist Administrative Operations ---");

    // 5.1 GET /api/receptionist/patients Unauthenticated
    res = await httpRequest({ path: "/api/receptionist/patients", method: "GET" });
    assert(res.status === 401, "GET /api/receptionist/patients unauthenticated returns 401");

    // 5.2 Patient token accessing receptionist patient directory
    res = await httpRequest({
      path: "/api/receptionist/patients",
      method: "GET",
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(res.status === 403, "GET /api/receptionist/patients with Patient token returns 403");

    // 5.3 Authorized Receptionist accessing patient directory
    res = await httpRequest({
      path: "/api/receptionist/patients",
      method: "GET",
      headers: { Authorization: `Bearer ${receptionistToken}` },
    });
    assert(res.status === 200, "GET /api/receptionist/patients with Receptionist token returns 200");

    // =========================================================================
    // SECTION 6: Registration Privilege Escalation & ID Injection Guards
    // =========================================================================
    console.log("\n--- Section 6: Registration Privilege Escalation & ID Injection ---");

    // 6.1 Privilege escalation: role = 'doctor'
    res = await httpRequest(
      {
        path: "/api/auth/patient/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        full_name: "Attacker Role",
        email: `escalate_doc_${Date.now()}@example.com`,
        password: "Password123!",
        role: "doctor",
      }
    );
    assert(res.status === 403, "POST /api/auth/patient/signup with role='doctor' returns 403 Forbidden");

    // 6.2 Privilege escalation: role = 'receptionist'
    res = await httpRequest(
      {
        path: "/api/auth/patient/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        full_name: "Attacker Role",
        email: `escalate_rec_${Date.now()}@example.com`,
        password: "Password123!",
        role: "receptionist",
      }
    );
    assert(res.status === 403, "POST /api/auth/patient/signup with role='receptionist' returns 403 Forbidden");

    // 6.3 Arbitrary user_id injection
    res = await httpRequest(
      {
        path: "/api/auth/patient/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        full_name: "Attacker ID",
        email: `inject_uid_${Date.now()}@example.com`,
        password: "Password123!",
        user_id: 1,
      }
    );
    assert(res.status === 400, "POST /api/auth/patient/signup with user_id injection returns 400 Bad Request");

    // 6.4 Arbitrary patient_id injection
    res = await httpRequest(
      {
        path: "/api/auth/patient/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        full_name: "Attacker ID",
        email: `inject_pid_${Date.now()}@example.com`,
        password: "Password123!",
        patient_id: 1,
      }
    );
    assert(res.status === 400, "POST /api/auth/patient/signup with patient_id injection returns 400 Bad Request");

    console.log("\n==========================================================================");
    console.log(`  AUTHORIZATION MATRIX SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
    console.log("==========================================================================\n");

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

runAuthorizationMatrix().catch((err) => {
  console.error("FATAL: Route authorization test matrix execution failed:", err);
  process.exit(1);
});
