/**
 * test_concurrent_prescription_idempotency.js
 * 
 * Verifies that concurrent prescription submissions for the same patient and doctor
 * are atomically serialized and deduplicated via MySQL advisory locks and 15-second
 * database-backed idempotency checks.
 */

const { httpRequest, generateToken } = require("./testHelper");

async function runConcurrentPrescriptionTest() {
  console.log("==========================================================================");
  console.log("   CONCURRENT PRESCRIPTION IDEMPOTENCY & ATOMIC LOCK REGRESSION TEST     ");
  console.log("==========================================================================\n");

  const doctorToken = generateToken({ user_id: 1, role: "doctor", email: "doctor@gmail.com" });

  const payload = {
    patient_id: 1,
    diagnosis: "Concurrent Idempotency Regression Check",
    medicines: [
      {
        medicine_name: "Amlodipine 5mg",
        dosage: "5mg",
        frequency: "Once daily in the morning",
        duration: "30 days"
      }
    ]
  };

  const headers = {
    "Authorization": `Bearer ${doctorToken}`,
    "Content-Type": "application/json"
  };

  console.log("► Submitting 5 concurrent prescription creation requests simultaneously...");
  const promises = Array.from({ length: 5 }, () =>
    httpRequest({ method: "POST", path: "/api/doctor/prescriptions", headers }, payload)
  );

  const results = await Promise.all(promises);

  let createdCount = 0;
  let deduplicatedCount = 0;
  let primaryPrescriptionId = null;

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const data = res.data;
    if (res.status === 201) {
      createdCount++;
      primaryPrescriptionId = data.prescription_id;
      console.log(`  [Response ${i + 1}] Status 201 Created -> Rx ID: #${data.prescription_id}`);
    } else if (res.status === 200 && data.duplicate_prevented) {
      deduplicatedCount++;
      console.log(`  [Response ${i + 1}] Status 200 Deduplicated -> Existing Rx ID: #${data.prescription_id}`);
    } else {
      console.error(`  [Response ${i + 1}] Unexpected Status ${res.status}:`, data);
    }
  }

  console.log(`\nSummary: ${createdCount} Created, ${deduplicatedCount} Deduplicated`);

  if (createdCount !== 1) {
    console.error(`[FAIL] Expected exactly 1 created prescription, got ${createdCount}`);
    process.exit(1);
  }

  if (deduplicatedCount !== 4) {
    console.error(`[FAIL] Expected exactly 4 deduplicated responses, got ${deduplicatedCount}`);
    process.exit(1);
  }

  for (const res of results) {
    if (res.data.prescription_id !== primaryPrescriptionId) {
      console.error(`[FAIL] Prescription ID mismatch: ${res.data.prescription_id} !== ${primaryPrescriptionId}`);
      process.exit(1);
    }
  }

  console.log("\n[PASS] Atomic advisory lock verified: Exactly 1 prescription persisted; all 4 concurrent duplicates safely intercepted with HTTP 200.");
  console.log("==========================================================================");
  process.exit(0);
}

runConcurrentPrescriptionTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
