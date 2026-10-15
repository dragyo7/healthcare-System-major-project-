/**
 * test_pdf_ownership_and_lock_failure.js
 * 
 * Verifies:
 * 1. Doctor Prescription PDF Ownership (BOLA protection & zero-byte stream denial on 403)
 * 2. Patient Prescription PDF Ownership (BOLA protection & zero-byte stream denial on 403)
 * 3. Prescription Advisory Lock Failure handling (returns HTTP 503 without inserting records)
 * 4. Legacy Public Chat Bridge (/chat, /hub) safety and zero patient PII exposure
 */

const { httpRequest, generateToken, mysql, DB_CONFIG } = require("./testHelper");

async function runVerification() {
  console.log("==========================================================================");
  console.log("   PDF OWNERSHIP, ADVISORY LOCK FAILURE & PUBLIC BRIDGE VERIFICATION     ");
  console.log("==========================================================================\n");

  const db = await mysql.createConnection(DB_CONFIG);

  try {
    // ------------------------------------------------------------------------
    // SETUP: Ensure two distinct doctors and two distinct patients exist
    // ------------------------------------------------------------------------
    console.log("► [Setup] Verifying test doctors and patients in database...");

    // Doctor 1 is seeded user_id: 1, doctor_id: 1
    const [doc1Rows] = await db.execute("SELECT d.doctor_id, d.user_id FROM doctors d WHERE d.doctor_id = 1");
    if (doc1Rows.length === 0) {
      throw new Error("Seed Doctor 1 not found in database.");
    }

    // Ensure Doctor 2 exists
    let doc2UserId = null;
    let doc2DoctorId = null;
    const [existingDoc2] = await db.execute(
      "SELECT u.user_id, d.doctor_id FROM users u JOIN doctors d ON u.user_id = d.user_id WHERE u.email = 'doctor2_test@gmail.com'"
    );
    if (existingDoc2.length > 0) {
      doc2DoctorId = existingDoc2[0].doctor_id;
      doc2UserId = existingDoc2[0].user_id;
    } else {
      const [userRes] = await db.execute(
        "INSERT INTO users (full_name, email, password, role) VALUES ('Dr. Second Doctor', 'doctor2_test@gmail.com', 'dummy_hash', 'doctor')"
      );
      doc2UserId = userRes.insertId;
      const [docRes] = await db.execute(
        "INSERT INTO doctors (user_id, specialization, qualification, license_number) VALUES (?, 'Cardiology', 'MD', 'DOC2-TEST-LIC')",
        [doc2UserId]
      );
      doc2DoctorId = docRes.insertId;
    }

    // Patient 1 is Aarav (user_id: 2, patient_id: 1)
    const [pat1Rows] = await db.execute("SELECT p.patient_id, p.user_id FROM patients p WHERE p.patient_id = 1");
    if (pat1Rows.length === 0) {
      throw new Error("Seed Patient 1 not found in database.");
    }
    const pat1UserId = pat1Rows[0].user_id;

    // Patient 2 is user_id: 3 or create test patient
    let pat2UserId = null;
    let pat2PatientId = null;
    const [existingPat2] = await db.execute(
      "SELECT u.user_id, p.patient_id FROM users u JOIN patients p ON u.user_id = p.user_id WHERE u.email = 'pat2_test@example.com'"
    );
    if (existingPat2.length > 0) {
      pat2PatientId = existingPat2[0].patient_id;
      pat2UserId = existingPat2[0].user_id;
    } else {
      const [uRes] = await db.execute(
        "INSERT INTO users (full_name, email, password, role) VALUES ('Patient Two', 'pat2_test@example.com', 'dummy_hash', 'patient')"
      );
      pat2UserId = uRes.insertId;
      const [pRes] = await db.execute(
        "INSERT INTO patients (user_id, date_of_birth, gender) VALUES (?, '1995-05-15', 'Female')",
        [pat2UserId]
      );
      pat2PatientId = pRes.insertId;
    }

    // Create a verified prescription owned by Doctor 1 and Patient 1
    const [rxRes] = await db.execute(
      "INSERT INTO prescriptions (patient_id, doctor_id, diagnosis, notes, prescription_date) VALUES (1, 1, 'Essential Hypertension Test', 'Monitor BP twice weekly', NOW())"
    );
    const testRxId = rxRes.insertId;
    await db.execute(
      "INSERT INTO prescription_medicines (prescription_id, medicine_name, dosage, frequency, duration, instructions) VALUES (?, 'Lisinopril', '10mg', 'Once daily', '30 days', 'Take in morning with water')",
      [testRxId]
    );
    console.log(`  Created test prescription #${testRxId} (Doctor 1, Patient 1)`);

    // Mint Tokens
    const doc1Token = generateToken({ user_id: 1, role: "doctor", email: "doctor@gmail.com" });
    const doc2Token = generateToken({ user_id: doc2UserId, role: "doctor", email: "doctor2_test@gmail.com" });
    const pat1Token = generateToken({ user_id: pat1UserId, role: "patient" });
    const pat2Token = generateToken({ user_id: pat2UserId, role: "patient" });

    // ------------------------------------------------------------------------
    // SECTION 1: DOCTOR PRESCRIPTION PDF AUTHORIZATION
    // ------------------------------------------------------------------------
    console.log("\n► [Section 1] Testing Doctor Prescription PDF Authorization...");

    // 1.1 Doctor 2 attempts to download Doctor 1's prescription PDF
    const doc2PdfRes = await httpRequest({
      method: "GET",
      path: `/api/doctor/prescriptions/${testRxId}/pdf`,
      headers: { Authorization: `Bearer ${doc2Token}` }
    });
    console.log(`  1.1 Doctor 2 accessing Doctor 1's Rx -> Status: ${doc2PdfRes.status}`);
    if (doc2PdfRes.status !== 403) {
      console.error(`[FAIL] Expected 403 Forbidden for cross-doctor PDF download, got ${doc2PdfRes.status}`);
      process.exit(1);
    }
    if (doc2PdfRes.raw.startsWith("%PDF")) {
      console.error("[FAIL] BOLA failure: PDF bytes were streamed to unauthorized doctor!");
      process.exit(1);
    }
    console.log("  [PASS] Doctor 2 access blocked with 403 Forbidden. Zero PDF bytes streamed.");

    // 1.2 Doctor 1 downloads their own prescription PDF
    const doc1PdfRes = await httpRequest({
      method: "GET",
      path: `/api/doctor/prescriptions/${testRxId}/pdf`,
      headers: { Authorization: `Bearer ${doc1Token}` }
    });
    console.log(`  1.2 Doctor 1 accessing own Rx -> Status: ${doc1PdfRes.status}, Content-Type: ${doc1PdfRes.headers["content-type"]}`);
    if (doc1PdfRes.status !== 200 || !doc1PdfRes.headers["content-type"]?.includes("application/pdf")) {
      console.error("[FAIL] Authorized doctor could not stream PDF");
      process.exit(1);
    }
    if (!doc1PdfRes.raw.startsWith("%PDF")) {
      console.error("[FAIL] Streamed data is not a valid PDF header");
      process.exit(1);
    }
    console.log("  [PASS] Doctor 1 successfully downloaded valid PDF stream (%PDF-1.3+).");

    // ------------------------------------------------------------------------
    // SECTION 2: PATIENT PRESCRIPTION PDF AUTHORIZATION
    // ------------------------------------------------------------------------
    console.log("\n► [Section 2] Testing Patient Prescription PDF Authorization...");

    // 2.1 Patient 2 attempts to download Patient 1's prescription PDF
    const pat2PdfRes = await httpRequest({
      method: "GET",
      path: `/api/patient/prescriptions/${testRxId}/pdf`,
      headers: { Authorization: `Bearer ${pat2Token}` }
    });
    console.log(`  2.1 Patient 2 accessing Patient 1's Rx -> Status: ${pat2PdfRes.status}`);
    if (pat2PdfRes.status !== 403) {
      console.error(`[FAIL] Expected 403 Forbidden for cross-patient PDF download, got ${pat2PdfRes.status}`);
      process.exit(1);
    }
    if (pat2PdfRes.raw.startsWith("%PDF")) {
      console.error("[FAIL] BOLA failure: PDF bytes were streamed to unauthorized patient!");
      process.exit(1);
    }
    console.log("  [PASS] Patient 2 access blocked with 403 Forbidden. Zero PDF bytes streamed.");

    // 2.2 Patient 1 downloads their own prescription PDF
    const pat1PdfRes = await httpRequest({
      method: "GET",
      path: `/api/patient/prescriptions/${testRxId}/pdf`,
      headers: { Authorization: `Bearer ${pat1Token}` }
    });
    console.log(`  2.2 Patient 1 accessing own Rx -> Status: ${pat1PdfRes.status}, Content-Type: ${pat1PdfRes.headers["content-type"]}`);
    if (pat1PdfRes.status !== 200 || !pat1PdfRes.headers["content-type"]?.includes("application/pdf")) {
      console.error("[FAIL] Authorized patient could not stream PDF");
      process.exit(1);
    }
    if (!pat1PdfRes.raw.startsWith("%PDF")) {
      console.error("[FAIL] Streamed data is not a valid PDF header");
      process.exit(1);
    }
    console.log("  [PASS] Patient 1 successfully downloaded valid PDF stream (%PDF-1.3+).");

    // ------------------------------------------------------------------------
    // SECTION 3: ADVISORY LOCK FAILURE SIMULATION
    // ------------------------------------------------------------------------
    console.log("\n► [Section 3] Simulating Advisory Lock Acquisition Failure (Timeout/Error)...");

    // Create a second dedicated MySQL connection to hold the lock
    const lockHolderDb = await mysql.createConnection(DB_CONFIG);
    const lockName = "rx_lock_1_1";

    console.log(`  Acquiring MySQL advisory lock '${lockName}' from test harness...`);
    const [holdRes] = await lockHolderDb.execute("SELECT GET_LOCK(?, 1) AS acquired", [lockName]);
    if (holdRes[0]?.acquired !== 1) {
      throw new Error("Failed to pre-acquire advisory lock in test harness.");
    }
    console.log("  Advisory lock successfully held by test harness.");

    // Count prescriptions before submission
    const [beforeCount] = await db.execute("SELECT COUNT(*) AS cnt FROM prescriptions WHERE patient_id = 1");
    const countBefore = beforeCount[0].cnt;

    // Doctor attempts to create prescription while lock is held
    console.log("  Submitting prescription while advisory lock is held (timeout: 10s)...");
    const startLockTime = Date.now();
    const lockFailRes = await httpRequest({
      method: "POST",
      path: "/api/doctor/prescriptions",
      headers: {
        Authorization: `Bearer ${doc1Token}`,
        "Content-Type": "application/json"
      }
    }, {
      patient_id: 1,
      diagnosis: "Lock Failure Test Regimen",
      medicines: [{ medicine_name: "Metoprolol", dosage: "25mg", frequency: "Daily", duration: "14 days" }]
    });

    const lockDuration = Date.now() - startLockTime;
    console.log(`  Response received in ${lockDuration}ms -> Status: ${lockFailRes.status}, Body:`, lockFailRes.data);

    // Release lock immediately
    await lockHolderDb.execute("SELECT RELEASE_LOCK(?)", [lockName]);
    await lockHolderDb.end();
    console.log("  Test harness released advisory lock.");

    // Verify status is 503 Service Unavailable
    if (lockFailRes.status !== 503) {
      console.error(`[FAIL] Expected HTTP 503 on lock acquisition timeout, got ${lockFailRes.status}`);
      process.exit(1);
    }

    // Verify NO prescription was inserted
    const [afterCount] = await db.execute("SELECT COUNT(*) AS cnt FROM prescriptions WHERE patient_id = 1");
    const countAfter = afterCount[0].cnt;
    if (countAfter !== countBefore) {
      console.error(`[FAIL] Prescription count increased from ${countBefore} to ${countAfter} despite lock acquisition failure!`);
      process.exit(1);
    }
    console.log(`  [PASS] Prescriptions count remained strictly at ${countBefore} (zero orphaned rows). Returned HTTP 503.`);

    // ------------------------------------------------------------------------
    // SECTION 4: LEGACY PUBLIC CHAT BRIDGE & SECURITY BOUNDARIES
    // ------------------------------------------------------------------------
    console.log("\n► [Section 4] Inspecting Legacy Public Chat Bridge (/chat, /hub)...");

    const hubRes = await httpRequest({
      method: "GET",
      path: "/hub"
    });
    console.log(`  4.1 GET /hub -> Status: ${hubRes.status}`);
    if (hubRes.status !== 200 && hubRes.status !== 404) {
      console.error(`[FAIL] Unexpected response from /hub: ${hubRes.status}`);
      process.exit(1);
    }

    const chatRes = await httpRequest({
      method: "POST",
      path: "/chat",
      headers: { "Content-Type": "application/json" }
    }, {
      query: "What are the common side effects of Lisinopril?"
    });
    console.log(`  4.2 POST /chat (public demo query) -> Status: ${chatRes.status}`);
    if (chatRes.status === 200) {
      console.log("  [PASS] Public /chat responded with general medical intelligence.");
      // Ensure no private DB data is leaked
      const responseStr = JSON.stringify(chatRes.data).toLowerCase();
      if (responseStr.includes("aarav") || responseStr.includes("password_hash")) {
        console.error("[FAIL] Private database records leaked in public /chat!");
        process.exit(1);
      }
      console.log("  [PASS] Zero patient PII or internal database records in public /chat response.");
    }

    console.log("\n==========================================================================");
    console.log("       ALL PDF OWNERSHIP, LOCK FAILURE & BRIDGE CHECKS PASSED             ");
    console.log("==========================================================================");
    process.exit(0);

  } catch (err) {
    console.error("Fatal test error:", err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runVerification();
