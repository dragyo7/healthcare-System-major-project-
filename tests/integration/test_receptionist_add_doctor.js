/**
 * test_receptionist_add_doctor.js
 *
 * Verifies Priority 2: Receptionist Doctor Creation
 * 1. Receptionist adds new doctor successfully (atomic users + doctors + account_activations)
 * 2. Verifies cryptographic single-use activation link returned (no plaintext password)
 * 3. Verifies new doctor appears in GET /api/receptionist/doctors directory
 * 4. Verifies duplicate email returns 409 Conflict
 * 5. Verifies duplicate license returns 409 Conflict
 * 6. Verifies missing required fields return 400 Bad Request
 * 7. Verifies non-receptionist role (patient/doctor) blocked with 403 Forbidden
 */

const { httpRequest, generateToken, mysql, DB_CONFIG } = require("./testHelper");

async function runReceptionistAddDoctorTest() {
  console.log("==========================================================================");
  console.log("             RECEPTIONIST DOCTOR CREATION & RBAC VERIFICATION             ");
  console.log("==========================================================================\n");

  const db = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Tokens
    const recToken = generateToken({ user_id: 3, role: "receptionist", email: "receptionist@gmail.com" });
    const patToken = generateToken({ user_id: 2, role: "patient", email: "aarav@gmail.com" });
    const docToken = generateToken({ user_id: 1, role: "doctor", email: "doctor@gmail.com" });

    // Generate unique synthetic doctor data
    const timestamp = Date.now();
    const uniqueEmail = `test.doc.${timestamp}@hospital.org`;
    const uniqueLic = `LIC-TEST-${timestamp}`;

    console.log("► [1] Testing Valid Doctor Creation by Receptionist...");
    const createRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${recToken}`
      }
    }, {
      full_name: "Dr. Test Ananya Sharma",
      email: uniqueEmail,
      phone: "+91 98201 11222",
      specialization: "Neurology",
      qualification: "MBBS, MD, DM (Neurology)",
      license_number: uniqueLic,
      experience_years: 9,
      bio: "Chamber 304, OPD Neuro Wing"
    });

    if (createRes.status !== 201) {
      throw new Error(`Failed to create doctor. Status: ${createRes.status}, Data: ${JSON.stringify(createRes.data)}`);
    }

    const createdDoc = createRes.data.doctor;
    const activationToken = createRes.data.activation_token;
    const activationUrl = createRes.data.activation_url;

    if (!createdDoc || !createdDoc.doctor_id) {
      throw new Error("Created doctor payload missing doctor_id.");
    }
    if (!activationToken || !activationUrl) {
      throw new Error("Missing cryptographic activation token or activation URL.");
    }
    console.log(`[PASS] Doctor successfully created: Dr. ${createdDoc.full_name} (Doctor ID: #${createdDoc.doctor_id}).`);
    console.log(`[PASS] Cryptographic activation token provisioned: ${activationToken.slice(0, 16)}...`);
    console.log(`[PASS] Activation URL provided: ${activationUrl}`);

    // Verify database record has sentinel password and record in account_activations
    const [userRows] = await db.execute("SELECT password, role FROM users WHERE user_id = ?", [createdDoc.user_id]);
    if (userRows.length === 0) throw new Error("User record not found in database.");
    if (!userRows[0].password.startsWith("!ACTIVATION_PENDING$")) {
      throw new Error(`Expected sentinel '!ACTIVATION_PENDING$', found: ${userRows[0].password}`);
    }
    console.log("[PASS] Database verification: user.password set to sentinel hash (zero plaintext default password).");

    const [actRows] = await db.execute("SELECT activation_id, expires_at FROM account_activations WHERE user_id = ?", [createdDoc.user_id]);
    if (actRows.length === 0) throw new Error("account_activations record not found.");
    console.log(`[PASS] account_activations record created (Activation ID: #${actRows[0].activation_id}).`);

    // ► [2] Verify Doctor appears in Physician Directory
    console.log("\n► [2] Verifying New Doctor Appears in Directory...");
    const dirRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "GET",
      headers: {
        Authorization: `Bearer ${recToken}`
      }
    });

    if (dirRes.status !== 200) {
      throw new Error(`Failed to get doctor directory. Status: ${dirRes.status}`);
    }

    const doctorList = dirRes.data.doctors || [];
    const foundInDir = doctorList.some((d) => d.doctor_id === createdDoc.doctor_id);
    if (!foundInDir) {
      throw new Error(`Created doctor #${createdDoc.doctor_id} not visible in physician directory.`);
    }
    console.log(`[PASS] Doctor #${createdDoc.doctor_id} successfully listed in physician directory (total: ${doctorList.length}).`);

    // ► [3] Duplicate Email Rejection
    console.log("\n► [3] Testing Duplicate Email Rejection (409 Conflict)...");
    const dupEmailRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${recToken}`
      }
    }, {
      full_name: "Dr. Duplicate Email Doctor",
      email: uniqueEmail,
      phone: "+91 98201 99999",
      specialization: "Cardiology"
    });

    if (dupEmailRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate email, got ${dupEmailRes.status}`);
    }
    console.log("[PASS] Duplicate email correctly rejected with HTTP 409 Conflict.");

    // ► [4] Duplicate License Rejection
    console.log("\n► [4] Testing Duplicate License Rejection (409 Conflict)...");
    const dupLicRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${recToken}`
      }
    }, {
      full_name: "Dr. Duplicate License Doctor",
      email: `other.${timestamp}@hospital.org`,
      phone: "+91 98201 88888",
      specialization: "Cardiology",
      license_number: uniqueLic
    });

    if (dupLicRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate license, got ${dupLicRes.status}`);
    }
    console.log("[PASS] Duplicate license number correctly rejected with HTTP 409 Conflict.");

    // ► [5] Validation of Missing Required Fields
    console.log("\n► [5] Testing Missing Required Fields (400 Bad Request)...");
    const missingRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${recToken}`
      }
    }, {
      full_name: "",
      email: "invalid-email"
    });

    if (missingRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got ${missingRes.status}`);
    }
    console.log("[PASS] Missing required fields correctly rejected with HTTP 400 Bad Request.");

    // ► [6] Unauthorized Role Access (RBAC)
    console.log("\n► [6] Testing Unauthorized Non-Receptionist Access (403 Forbidden)...");
    const patCreateRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${patToken}`
      }
    }, {
      full_name: "Dr. Malicious Insertion",
      email: "malicious@hospital.org",
      phone: "+91 90000 00000",
      specialization: "General"
    });

    if (patCreateRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for patient token, got ${patCreateRes.status}`);
    }
    console.log("[PASS] Patient token blocked from creating doctors with HTTP 403 Forbidden.");

    const docCreateRes = await httpRequest({
      path: "/api/receptionist/doctors",
      method: "POST",
      headers: {
        Authorization: `Bearer ${docToken}`
      }
    }, {
      full_name: "Dr. Malicious Insertion 2",
      email: "malicious2@hospital.org",
      phone: "+91 90000 00000",
      specialization: "General"
    });

    if (docCreateRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for doctor token, got ${docCreateRes.status}`);
    }
    console.log("[PASS] Doctor token blocked from administrative doctor creation with HTTP 403 Forbidden.");

    console.log("\n==========================================================================");
    console.log("        ALL RECEPTIONIST DOCTOR CREATION & RBAC CHECKS PASSED             ");
    console.log("==========================================================================");

  } finally {
    await db.end();
  }
}

runReceptionistAddDoctorTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
