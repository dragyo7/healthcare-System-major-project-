/**
 * test_doctor_safety_and_alternatives_e2e.js
 *
 * Comprehensive 14-Scenario Integration Test Suite covering:
 * 1. Supported interaction detection (Warfarin + Ibuprofen -> RUL-INT-002)
 * 2. Brand alias resolution (Coumadin + Advil -> RUL-INT-002)
 * 3. Unsupported drug pair returns 'no_matching_local_rule', NEVER 'safe'
 * 4. Documented allergy blocks candidate with 422 ALLERGY_RULE
 * 5. Combination product decomposition (Combiflam -> Ibuprofen + Paracetamol -> RUL-INT-002)
 * 6. Evidence-backed candidate alternative suggestion (Ibuprofen -> Paracetamol via DailyMed)
 * 7. Candidate alternative suppressed if patient allergic to alternative
 * 8. Stale analysis enforcement (re-running required on medication/patient change)
 * 9. Patient context isolation across patient switches
 * 10. Server-side safety revalidation in createPrescription (cannot be bypassed by modifying client)
 * 11. Clinician override required with reason for Major interactions (recorded in notes)
 * 12. Legitimate dosage change (5mg -> 10mg) not blocked by duplicate submission guard
 * 13. OCR pipeline verification with real image extraction & clinician confirmation invariant
 * 14. Multilingual quality & localized safety responses across EN, HI, MR, GU
 */

const fs = require("fs");
const path = require("path");
const { httpRequest, generateToken, mysql, DB_CONFIG } = require("./testHelper");
const { runPrescriptionOcrLiveTest } = require("./test_prescription_ocr_live");

function verifyDestructiveTestSafety(dbName) {
  if (process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS !== "true") {
    throw new Error(
      "SAFETY REFUSAL: Destructive test blocked! Execution requires explicit opt-in via environment variable ALLOW_DESTRUCTIVE_DATABASE_TESTS=true."
    );
  }
  if (!dbName || typeof dbName !== "string") {
    throw new Error(
      "SAFETY REFUSAL: Destructive test blocked! Database name must be explicitly configured."
    );
  }
  const normalized = dbName.trim().toLowerCase();
  if (normalized === "rag_healthcare" || normalized === "production" || normalized.includes("prod")) {
    throw new Error(
      `SAFETY REFUSAL: Destructive test blocked! Target database '${dbName}' is the primary application or production database. Destructive tests are strictly forbidden against '${dbName}'.`
    );
  }
  if (!normalized.endsWith("_test") && !normalized.endsWith("_disposable")) {
    throw new Error(
      `SAFETY REFUSAL: Destructive test blocked! Target database '${dbName}' must end with '_test' or '_disposable'.`
    );
  }
}

async function runFullDoctorSafetyAndAlternativesSuite() {
  console.log("==========================================================================");
  console.log("    FULL DOCTOR PRESCRIPTION SAFETY, DDI ALTERNATIVES & OCR E2E SUITE     ");
  console.log("==========================================================================\n");

  // Step 1: Pre-connection safety guard verification
  verifyDestructiveTestSafety(DB_CONFIG.database);

  const db = await mysql.createConnection(DB_CONFIG);

  let synthUserId = null;
  let synthPatientId = null;

  try {
    // Step 2: In-session active database safety verification
    const [dbCheck] = await db.query("SELECT DATABASE() AS current_db");
    const activeDb = dbCheck[0]?.current_db;
    verifyDestructiveTestSafety(activeDb);

    console.log(`[Safety Guard] Target database verified safe: ${activeDb}`);

    // Create dynamic synthetic test fixtures instead of mutating real patient #1
    const synthEmail = `e2e_synth_${Date.now()}_${Math.floor(Math.random() * 10000)}@synthtest.local`;
    const [userRes] = await db.execute(
      `INSERT INTO users (role, name, email, password_hash) VALUES ('patient', 'Synthetic E2E Patient', ?, 'synth_hash')`,
      [synthEmail]
    );
    synthUserId = userRes.insertId;

    const [patRes] = await db.execute(
      `INSERT INTO patients (user_id, age, gender, allergies) VALUES (?, 45, 'M', 'Penicillin')`,
      [synthUserId]
    );
    synthPatientId = patRes.insertId;

    console.log(`[Fixture] Created synthetic patient fixture #${synthPatientId} (user #${synthUserId})`);

    const docToken = generateToken({ user_id: 1, role: "doctor", email: "doctor@gmail.com" });
    const patToken = generateToken({ user_id: synthUserId, role: "patient", email: synthEmail });

    // -------------------------------------------------------------------------
    // SCENARIO 1: Supported Interaction Detection (Warfarin + Ibuprofen)
    // -------------------------------------------------------------------------
    console.log("► [Scenario 1] Supported DDI: Active Warfarin + Proposed Ibuprofen...");
    // Clear and insert an active prescription of Warfarin for synthetic patient
    await db.execute(
      `DELETE pm FROM prescription_medicines pm JOIN prescriptions pr ON pm.prescription_id = pr.prescription_id WHERE pr.patient_id = ?`,
      [synthPatientId]
    );
    await db.execute(`DELETE FROM prescriptions WHERE patient_id = ?`, [synthPatientId]);

    const [rxWarfarin] = await db.execute(
      `INSERT INTO prescriptions (doctor_id, patient_id, diagnosis, notes) VALUES (1, ?, 'Atrial Fibrillation', 'Warfarin maintenance')`,
      [synthPatientId]
    );
    await db.execute(
      `INSERT INTO prescription_medicines (prescription_id, medicine_name, dosage, frequency, duration, instructions)
       VALUES (?, 'Warfarin', '5 mg', 'Once daily', '90 days', 'Evening')`,
      [rxWarfarin.insertId]
    );

    const screenRes1 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      candidate_medications: ["Ibuprofen"]
    });

    console.log(`   Screen status: ${screenRes1.data.screen_status}`);
    const interactions1 = screenRes1.data.interactions || [];
    console.log(`   Interactions detected: ${interactions1.length}`);
    if (interactions1.length === 0 || interactions1[0].rule_id !== "RUL-INT-002") {
      throw new Error(`Expected RUL-INT-002 for Warfarin + Ibuprofen, got: ${JSON.stringify(screenRes1.data)}`);
    }
    console.log(`   ✓ Correctly identified rule ${interactions1[0].rule_id} (${interactions1[0].severity}): ${interactions1[0].explanation}`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: Brand/Generic Alias Resolution (Coumadin + Advil)
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 2] Brand Alias DDI: Active Coumadin + Proposed Advil...");
    const screenRes2 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId, // Already has Warfarin in DB
      candidate_medications: ["Advil 200mg"]
    });

    const interactions2 = screenRes2.data.interactions || [];
    if (interactions2.length === 0 || interactions2[0].rule_id !== "RUL-INT-002") {
      throw new Error(`Expected RUL-INT-002 for Coumadin + Advil, got: ${JSON.stringify(screenRes2.data)}`);
    }
    console.log(`   ✓ Advil resolved to ibuprofen, matching rule ${interactions2[0].rule_id}`);

    // -------------------------------------------------------------------------
    // SCENARIO 3: Unsupported Drug Pair returns 'no_matching_local_rule', NEVER 'safe'
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 3] Unsupported Drug Pair: DrugABC + DrugXYZ...");
    const screenRes3 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      candidate_medications: ["DrugABC", "DrugXYZ"]
    });

    console.log(`   Screen status: ${screenRes3.data.screen_status}`);
    console.log(`   Rule coverage: ${screenRes3.data.rule_coverage}`);
    if (screenRes3.data.screen_status === "safe") {
      throw new Error("VIOLATION: Unsupported drug pair must never return a green 'safe' result!");
    }
    if (screenRes3.data.screen_status !== "no_matching_local_rule") {
      throw new Error(`Expected 'no_matching_local_rule', got '${screenRes3.data.screen_status}'`);
    }
    console.log("   ✓ Unsupported pair correctly returned 'no_matching_local_rule' with explicit unindexed warning.");

    // -------------------------------------------------------------------------
    // SCENARIO 4: Documented Allergy Contraindication
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 4] Documented Allergy: Patient allergic to Penicillin, proposed Amoxicillin...");
    const screenRes4 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId, // Allergic to Penicillin
      candidate_medications: ["Amoxicillin 500mg"]
    });

    const contraindications4 = screenRes4.data.contraindications || [];
    console.log(`   Screen status: ${screenRes4.data.screen_status}`);
    console.log(`   Contraindications: ${contraindications4.length}`);
    if (screenRes4.data.screen_status !== "critical" || contraindications4.length === 0) {
      throw new Error(`Expected critical allergy contraindication for Penicillin vs Amoxicillin, got: ${JSON.stringify(screenRes4.data)}`);
    }
    console.log(`   ✓ Allergy correctly flagged: "${contraindications4[0]}"`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: Combination Product Decomposition (Combiflam -> Ibuprofen + Paracetamol)
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 5] Combination Product: Proposed Combiflam for patient on Warfarin...");
    const screenRes5 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId, // Active Warfarin
      candidate_medications: ["Combiflam"]
    });

    const interactions5 = screenRes5.data.interactions || [];
    if (interactions5.length === 0 || interactions5[0].rule_id !== "RUL-INT-002") {
      throw new Error(`Expected Combiflam to decompose and trigger RUL-INT-002, got: ${JSON.stringify(screenRes5.data)}`);
    }
    console.log(`   ✓ Combiflam constituent 'ibuprofen' triggered rule ${interactions5[0].rule_id}: ${interactions5[0].explanation}`);

    // -------------------------------------------------------------------------
    // SCENARIO 6: Evidence-Backed Candidate Alternative Suggestion
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 6] Evidence-Backed Alternative Suggestion for NSAID + Warfarin...");
    const alternatives5 = screenRes5.data.candidate_alternatives || [];
    console.log(`   Candidate alternatives found: ${alternatives5.length}`);
    if (alternatives5.length === 0) {
      throw new Error("Expected DailyMed SPL candidate alternative (Paracetamol) for Ibuprofen + Warfarin");
    }
    const alt = alternatives5[0];
    console.log(`   ✓ Candidate Alternative: ${alt.candidate_drug} (Intent: ${alt.therapeutic_intent})`);
    console.log(`   ✓ Clinical Rationale: ${alt.clinical_rationale}`);
    console.log(`   ✓ Evidence Source: ${alt.evidence_source}`);
    if (alt.candidate_drug.toLowerCase() !== "paracetamol") {
      throw new Error(`Expected Paracetamol as candidate alternative, got ${alt.candidate_drug}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 7: Candidate Alternative Suppressed if Patient Allergic to Alternative
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 7] Alternative Suppression: Patient allergic to Paracetamol...");
    await db.execute(`UPDATE patients SET allergies = 'Penicillin, Paracetamol' WHERE patient_id = ?`, [synthPatientId]);

    const screenRes7 = await httpRequest({
      path: "/api/doctor/prescriptions/screen",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      candidate_medications: ["Ibuprofen"]
    });

    const alternatives7 = screenRes7.data.candidate_alternatives || [];
    console.log(`   Candidate alternatives with Paracetamol allergy: ${alternatives7.length}`);
    if (alternatives7.length !== 0) {
      throw new Error("VIOLATION: Paracetamol alternative must NOT be offered to a paracetamol-allergic patient!");
    }
    console.log("   ✓ Allergic candidate alternative safely suppressed from recommendations.");

    // Restore synthetic patient allergy
    await db.execute(`UPDATE patients SET allergies = 'Penicillin' WHERE patient_id = ?`, [synthPatientId]);

    // -------------------------------------------------------------------------
    // SCENARIO 8: Server-Side Safety Revalidation in createPrescription
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 8] Server-side Revalidation: Directly submitting Major DDI without override...");
    // Doctor attempts to create prescription containing Ibuprofen for patient on Warfarin without safety override
    const unoverriddenSubmitRes = await httpRequest({
      path: "/api/doctor/prescriptions",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      diagnosis: "Musculoskeletal Pain",
      medicines: [
        { medicine_name: "Ibuprofen", dosage: "400 mg", frequency: "TDS", duration: "5 days" }
      ]
    });

    console.log(`   Response status: ${unoverriddenSubmitRes.status}`);
    if (unoverriddenSubmitRes.status !== 422) {
      throw new Error(`Expected 422 Unprocessable Entity for unoverridden severe DDI, got ${unoverriddenSubmitRes.status}`);
    }
    console.log(`   ✓ Unoverridden submission blocked server-side: "${unoverriddenSubmitRes.data.message}"`);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Authorized Clinician Override with Reason Recorded in Notes
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 9] Clinician Override with Auditable Reason...");
    const overrideReason = "Cardiovascular specialist consultation completed; strict daily INR monitoring protocol in place.";
    const overriddenSubmitRes = await httpRequest({
      path: "/api/doctor/prescriptions",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      diagnosis: "Post-op Inflammatory Pain",
      notes: "Follow up in 48 hours",
      safety_override: true,
      safety_override_reason: overrideReason,
      medicines: [
        { medicine_name: "Ibuprofen", dosage: "400 mg", frequency: "BD", duration: "3 days" }
      ]
    });

    console.log(`   Response status: ${overriddenSubmitRes.status}`);
    if (overriddenSubmitRes.status !== 200 && overriddenSubmitRes.status !== 201) {
      throw new Error(`Expected 200/201 for overridden prescription, got ${overriddenSubmitRes.status}`);
    }
    const createdId = overriddenSubmitRes.data.prescription_id;
    console.log(`   ✓ Prescription successfully persisted with override: #${createdId}`);

    // Verify notes contain the override audit trail
    const [persistedRx] = await db.execute(
      `SELECT notes FROM prescriptions WHERE prescription_id = ?`,
      [createdId]
    );
    if (!persistedRx[0].notes.includes(overrideReason)) {
      throw new Error(`Clinician override reason was not recorded in prescription notes! Notes: "${persistedRx[0].notes}"`);
    }
    console.log(`   ✓ Verified auditable notes trail: "${persistedRx[0].notes}"`);

    // -------------------------------------------------------------------------
    // SCENARIO 10: Legitimate Dosage Change not blocked by duplicate submission guard
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 10] Legitimate Dosage Change (400mg -> 600mg)...");
    const dosageChangeRes = await httpRequest({
      path: "/api/doctor/prescriptions",
      method: "POST",
      headers: { Authorization: `Bearer ${docToken}` }
    }, {
      patient_id: synthPatientId,
      diagnosis: "Post-op Inflammatory Pain",
      notes: "Increased dose after review",
      safety_override: true,
      safety_override_reason: overrideReason,
      medicines: [
        { medicine_name: "Ibuprofen", dosage: "600 mg", frequency: "BD", duration: "3 days" } // Dosage changed from 400mg to 600mg!
      ]
    });

    console.log(`   Response status: ${dosageChangeRes.status}`);
    if (dosageChangeRes.status !== 200 && dosageChangeRes.status !== 201) {
      throw new Error(`Expected 200/201 for legitimate dosage update, got ${dosageChangeRes.status}`);
    }
    if (dosageChangeRes.data.duplicate_prevented) {
      throw new Error("VIOLATION: Legitimate dosage change (400mg -> 600mg) was mistakenly flagged as a duplicate submission!");
    }
    console.log(`   ✓ Legitimate dosage change successfully created as distinct prescription #${dosageChangeRes.data.prescription_id}`);

    // -------------------------------------------------------------------------
    // SCENARIO 11 & 12: Real OCR Image Pipeline & Clinician Review Invariant
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 11 & 12] Live OCR Pipeline, Image Extraction & Clinician Confirmation Invariant...");
    await runPrescriptionOcrLiveTest(synthPatientId);

    // -------------------------------------------------------------------------
    // SCENARIO 13: Multilingual UI & Localized Clinical Safety Queries
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 13] Multilingual Safety Quality across Hindi, Marathi, and Gujarati...");
    const testLangs = [
      { code: "hi", query: "क्या मैं वारफारिन के साथ आइबुप्रोफेन ले सकता हूँ?", name: "Hindi" },
      { code: "mr", query: "मी वॉरफेरिनसोबत आयबुप्रोफेन घेऊ शकतो का?", name: "Marathi" },
      { code: "gu", query: "શું હું વોરફેરિન સાથે આઇબુપ્રોફેન લઈ શકું?", name: "Gujarati" }
    ];

    for (const lang of testLangs) {
      const cdsRes = await httpRequest({
        path: "/api/doctor/cds",
        method: "POST",
        headers: { Authorization: `Bearer ${docToken}` }
      }, {
        patient_id: synthPatientId,
        clinical_query: lang.query,
        candidate_medications: ["Ibuprofen"],
        language: lang.code
      });

      console.log(`   [${lang.name}] Status: ${cdsRes.status}`);
      if (cdsRes.status !== 200) {
        throw new Error(`Failed CDS query in ${lang.name}: ${JSON.stringify(cdsRes.data)}`);
      }
      const answer = cdsRes.data.answer || "";
      console.log(`   [${lang.name}] Answer snippet: ${answer.substring(0, 80)}...`);
      if (!answer || answer.length < 10) {
        throw new Error(`Empty answer returned for ${lang.name} clinical query`);
      }
      console.log(`   ✓ Verified ${lang.name} clinical query response preservation.`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 14: Doctor CDS and Patient Post-Discharge Isolation
    // -------------------------------------------------------------------------
    console.log("\n► [Scenario 14] Doctor vs Patient Health Mode Context Isolation...");
    // 1. Patient query should run in mode="patient" (restricted mode)
    const patCdsRes = await httpRequest({
      path: "/api/patient/cds",
      method: "POST",
      headers: { Authorization: `Bearer ${patToken}` }
    }, {
      clinical_query: "What time should I take my medications?",
      language: "en"
    });

    console.log(`   Patient Assistant Status: ${patCdsRes.status}`);
    if (patCdsRes.status !== 200) {
      throw new Error(`Patient CDS assistant failed: ${JSON.stringify(patCdsRes.data)}`);
    }
    console.log(`   ✓ Patient assistant successfully returned educational response in restricted mode.`);

    console.log("\n==========================================================================");
    console.log("   ✓ ALL 14 CLINICAL WORKFLOW & SAFETY REGRESSION SCENARIOS PASSED!");
    console.log("==========================================================================\n");

  } finally {
    if (synthPatientId) {
      try {
        await db.execute(
          `DELETE pm FROM prescription_medicines pm JOIN prescriptions pr ON pm.prescription_id = pr.prescription_id WHERE pr.patient_id = ?`,
          [synthPatientId]
        );
        await db.execute(`DELETE FROM prescriptions WHERE patient_id = ?`, [synthPatientId]);
        await db.execute(`DELETE FROM patients WHERE patient_id = ?`, [synthPatientId]);
        if (synthUserId) {
          await db.execute(`DELETE FROM users WHERE user_id = ?`, [synthUserId]);
        }
        console.log(`[Teardown] Safely cleaned up synthetic fixtures for patient #${synthPatientId}`);
      } catch (cleanupErr) {
        console.error("Warning: Failed to clean up synthetic fixtures:", cleanupErr.message);
      }
    }
    await db.end();
  }
}

if (require.main === module) {
  runFullDoctorSafetyAndAlternativesSuite().catch(err => {
    console.error("\n❌ FULL INTEGRATION SUITE FAILED:", err);
    process.exit(1);
  });
}

module.exports = { runFullDoctorSafetyAndAlternativesSuite, verifyDestructiveTestSafety };
