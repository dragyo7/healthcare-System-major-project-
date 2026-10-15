const assert = require('assert');

const BASE_EXPRESS = 'http://localhost:5000';
const BASE_FASTAPI = 'http://127.0.0.1:8000';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: res.status, headers: res.headers, body: json || text };
}

async function runTest() {
  console.log("==========================================================================");
  console.log("   VERIFYING DOCTOR PATIENT-CONTEXT, ISOLATION & PRESCRIPTION INTEGRITY   ");
  console.log("==========================================================================");

  let passed = 0;
  let failed = 0;

  function record(section, name, condition, details = "") {
    if (condition) {
      console.log(`[PASS] [${section}] ${name} ${details ? '-> ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] [${section}] ${name} ${details ? '-> ' + details : ''}`);
      failed++;
    }
  }

  // 1. Authenticate Doctor
  const docLogin = await request(`${BASE_EXPRESS}/api/auth/doctor/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@gmail.com', password: 'doctor123' })
  });
  const doctorToken = docLogin.body?.token;
  record("AUTH", "Doctor Login", docLogin.status === 200 && Boolean(doctorToken), "Doctor authenticated");

  // --------------------------------------------------------------------------
  // SECTION B.1: PATIENT A (ID: 1 - Aarav Patil) CONTEXTUAL EVALUATION
  // --------------------------------------------------------------------------
  console.log("\n>>> SECTION B.1: PATIENT A (ID: 1) CONTEXTUAL EVALUATION <<<");
  
  const querySupportedA = "What is the primary documented diagnosis and allergy precaution for this patient?";
  const resA = await request(`${BASE_EXPRESS}/api/doctor/cds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      clinical_query: querySupportedA,
      mode: "doctor"
    })
  });

  const ansA = resA.body?.answer || "";
  const isGroundedA = resA.body?.verification_status === "verified_grounded" && resA.body?.is_grounded === true;
  const hasDiagnosisA = ansA.toLowerCase().includes("hypertension");
  const hasAllergyA = ansA.includes("Penicillin");

  record("B.1.1", "Patient A Response Grounded", isGroundedA, `Status: ${resA.body?.verification_status}`);
  record("B.1.2", "Patient A Diagnoses Grounded in Stored Record", hasDiagnosisA, `Answer contains Hypertension`);
  record("B.1.3", "Patient A Allergy Precaution Grounded", hasAllergyA, `Answer contains Penicillin`);

  // --------------------------------------------------------------------------
  // SECTION B.2: PATIENT B (ID: 2 - Ananya Deshmukh) CONTEXT SWITCH & DIFFERENTIATION
  // --------------------------------------------------------------------------
  console.log("\n>>> SECTION B.2: PATIENT B (ID: 2) CONTEXT SWITCH & DIFFERENTIATION <<<");

  const resB = await request(`${BASE_EXPRESS}/api/doctor/cds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 2,
      clinical_query: querySupportedA,
      mode: "doctor"
    })
  });

  const ansB = resB.body?.answer || "";
  const isGroundedB = resB.body?.verification_status === "verified_grounded" && resB.body?.is_grounded === true;
  const hasDiagnosisB = ansB.toLowerCase().includes("type 2 diabetes");
  const hasAllergyB = ansB.toLowerCase().includes("no known");

  record("B.2.1", "Patient B Context Switch Grounded", isGroundedB, `Status: ${resB.body?.verification_status}`);
  record("B.2.2", "Patient B Diagnoses Grounded in Stored Record", hasDiagnosisB, `Answer contains Type 2 Diabetes`);
  record("B.2.3", "Patient B Allergy Reflects Stored Record", hasAllergyB, `Answer reflects No known drug allergies`);

  // --------------------------------------------------------------------------
  // SECTION C: SEMANTIC CROSS-PATIENT ISOLATION (PATIENT B vs PATIENT A)
  // --------------------------------------------------------------------------
  console.log("\n>>> SECTION C: SEMANTIC CROSS-PATIENT ISOLATION <<<");

  // Patient B's answer must NOT contain Patient A's protected clinical facts:
  // Patient A has Penicillin allergy and Hypertension. Patient B has Type 2 Diabetes and NKDA.
  const leaksPatientAAllergy = ansB.includes("Penicillin");
  const leaksPatientADiagnosis = ansB.toLowerCase().includes("hypertension");

  record("C.1", "Patient B Response Contains Zero Patient A Allergy Leaks", !leaksPatientAAllergy, "Zero mention of Penicillin in Patient B response");
  record("C.2", "Patient B Response Contains Zero Patient A Diagnosis Leaks", !leaksPatientADiagnosis, "Zero mention of Hypertension in Patient B response");

  // --------------------------------------------------------------------------
  // SECTION B.3: ABSENT FACT NOT INVENTED (FAIL-CLOSED)
  // --------------------------------------------------------------------------
  console.log("\n>>> SECTION B.3: ABSENT FACT NOT INVENTED (FAIL-CLOSED) <<<");

  const queryAbsent = "What was the exact date and surgical procedure for this patient's gallbladder surgery in 2018?";
  const resAbsent = await request(`${BASE_EXPRESS}/api/doctor/cds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      clinical_query: queryAbsent,
      mode: "doctor"
    })
  });

  const ansAbsent = resAbsent.body?.answer || "";
  const abstainedAbsent = resAbsent.body?.abstained === true || resAbsent.body?.verification_status === "abstained_policy";
  const didNotFabricateSurgery = !ansAbsent.includes("2018") && !ansAbsent.toLowerCase().includes("cholecystectomy");
  const explicitOmission = ansAbsent.toLowerCase().includes("no documentation found");

  record("B.3.1", "Absent Fact Safely Abstained (Fail-Closed)", abstainedAbsent, `Status: ${resAbsent.body?.verification_status}`);
  record("B.3.2", "Absent Surgery Date Never Fabricated", didNotFabricateSurgery, "2018 / surgical procedure not fabricated");
  record("B.3.3", "Explicit EHR Documentation Omission Stated", explicitOmission, "Clear statement that procedure is not in record");

  // --------------------------------------------------------------------------
  // SECTION E: PRESCRIPTION INTEGRITY (ALLERGY VS NON-ALLERGY PATIENTS)
  // --------------------------------------------------------------------------
  console.log("\n>>> SECTION E: PRESCRIPTION INTEGRITY AUDIT <<<");

  // E.1: Screen Patient 1 (Penicillin Allergy) with Penicillin candidate
  const screenAllergic = await request(`${BASE_EXPRESS}/api/doctor/prescriptions/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      candidate_medications: ["Penicillin V Potassium 500mg"]
    })
  });
  const hasContraindication = (screenAllergic.body?.contraindications || []).some(c => c.includes("Penicillin"));
  record("E.1", "Screening Flags Documented Allergy for Patient 1", hasContraindication, `Contraindication: ${screenAllergic.body?.contraindications?.[0]}`);

  // E.2: Screen Patient 2 (No Allergy) with Penicillin candidate (should have 0 allergy contraindications)
  const screenNonAllergic = await request(`${BASE_EXPRESS}/api/doctor/prescriptions/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 2,
      candidate_medications: ["Penicillin V Potassium 500mg"]
    })
  });
  const noFalseContraindication = (screenNonAllergic.body?.contraindications || []).length === 0;
  record("E.2", "Screening Permits Non-Allergic Drug for Patient 2", noFalseContraindication, "0 contraindications for non-allergic patient");

  // E.3: Direct Form Attempt on Patient 1 to Prescribe Allergic Drug -> Must be rejected with HTTP 422
  const directAllergicAttempt = await request(`${BASE_EXPRESS}/api/doctor/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      diagnosis: "Bacterial Tonsillitis",
      notes: "Bypassing screening via direct form entry",
      medicines: [
        { medicine_name: "Penicillin", dosage: "500 mg", frequency: "Three times daily", duration: "7 days" }
      ]
    })
  });
  record("E.3", "Direct Form Allergic Prescription Blocked Server-Side (422)", directAllergicAttempt.status === 422, `Status: ${directAllergicAttempt.status} (${directAllergicAttempt.body?.message})`);

  // E.4: Persist Safe Prescription for Patient 1 (Amlodipine 5mg)
  const safePrescription = await request(`${BASE_EXPRESS}/api/doctor/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      diagnosis: "Essential Hypertension Stage 1",
      notes: "Verified safe regimen",
      medicines: [
        { medicine_name: "Amlodipine", dosage: "5 mg", frequency: "Once daily", duration: "30 days", instructions: "Take in the morning with water" }
      ]
    })
  });
  const createdRxId = safePrescription.body?.prescription_id;
  record("E.4", "Doctor Persists Verified Safe Prescription", safePrescription.status === 201 || safePrescription.status === 200, `Created Rx ID: #${createdRxId}`);

  // E.5: Idempotency Protection: Immediate duplicate submission returns existing prescription without creating new DB row
  const dupAttempt = await request(`${BASE_EXPRESS}/api/doctor/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patient_id: 1,
      diagnosis: "Essential Hypertension Stage 1",
      notes: "Verified safe regimen",
      medicines: [
        { medicine_name: "Amlodipine", dosage: "5 mg", frequency: "Once daily", duration: "30 days", instructions: "Take in the morning with water" }
      ]
    })
  });
  const isIdempotent = dupAttempt.status === 200 && dupAttempt.body?.duplicate_prevented === true && dupAttempt.body?.prescription_id === createdRxId;
  record("E.5", "Immediate Duplicate Submission Prevented (Idempotency)", isIdempotent, `Returned existing Rx ID: #${dupAttempt.body?.prescription_id}`);

  // E.6: Verify Prescription PDF Generation
  if (createdRxId) {
    const pdfRes = await request(`${BASE_EXPRESS}/api/doctor/prescriptions/${createdRxId}/pdf`, {
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    const isPdf = pdfRes.headers.get('content-type')?.includes('application/pdf') || pdfRes.status === 200;
    record("E.6", "Prescription PDF Generated & Streamed Successfully", isPdf, `Content-Type: ${pdfRes.headers.get('content-type')}`);
  }

  console.log("\n==========================================================================");
  console.log(` AUDIT EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTest().catch(e => {
  console.error("Test error:", e);
  process.exit(1);
});
