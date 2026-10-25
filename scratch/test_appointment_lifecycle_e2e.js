/**
 * scratch/test_appointment_lifecycle_e2e.js
 *
 * Verifies Priority 4: Complete Appointment Lifecycle
 * 1. Patient requests consultation -> status 'pending'
 * 2. Receptionist views pending request & approves -> status 'confirmed'
 * 3. Doctor views authorized schedule -> sees 'confirmed' appointment
 * 4. Patient reloads -> sees updated 'confirmed' status
 * 5. Double booking prevention verified
 */

const assert = require("assert");

const API_BASE = "http://127.0.0.1:5001/api";

const run = async () => {
  console.log("=== PRIORITY 4: APPOINTMENT LIFECYCLE END-TO-END VERIFICATION ===");

  // 1. Patient Login
  const patLoginRes = await fetch(`${API_BASE}/auth/patient/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "aarav@gmail.com", password: "patient123" }),
  });
  assert.strictEqual(patLoginRes.status, 200, "Patient login must succeed");
  const patToken = (await patLoginRes.json()).token;
  console.log("[PASS] Step 1: Patient Aarav Patil authenticated.");

  // 2. Patient Requests Appointment with Doctor 1
  const targetDate = new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0]; // 5 days in future
  const targetTime = "14:30:00";
  const reason = "Post-discharge hypertensive follow-up";

  const reqRes = await fetch(`${API_BASE}/patient/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patToken}`,
    },
    body: JSON.stringify({
      doctor_id: 1,
      appointment_date: targetDate,
      appointment_time: targetTime,
      reason,
    }),
  });
  console.log("Appointment Request HTTP Status:", reqRes.status);
  const reqData = await reqRes.json();
  assert.strictEqual(reqRes.status, 201, "Appointment request must be created (201)");
  assert.strictEqual(reqData.appointment.status, "pending", "Initial status must be 'pending'");
  const apptId = reqData.appointment.appointment_id;
  console.log(`[PASS] Step 2: Patient appointment #${apptId} created with status 'pending'.`);

  // 3. Receptionist Login
  const recLoginRes = await fetch(`${API_BASE}/auth/receptionist/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "receptionist@gmail.com", password: "receptionist123" }),
  });
  assert.strictEqual(recLoginRes.status, 200, "Receptionist login must succeed");
  const recToken = (await recLoginRes.json()).token;
  console.log("[PASS] Step 3: Receptionist authenticated.");

  // 4. Receptionist Views & Approves Appointment
  const recApptsRes = await fetch(`${API_BASE}/receptionist/appointments`, {
    headers: { Authorization: `Bearer ${recToken}` },
  });
  const recApptsData = await recApptsRes.json();
  const targetInRec = recApptsData.appointments.find((a) => a.appointment_id === apptId);
  assert(Boolean(targetInRec), "Pending appointment must be visible in receptionist portal");
  assert.strictEqual(targetInRec.status, "pending");
  console.log(`[PASS] Step 4a: Receptionist views pending appointment #${apptId}.`);

  const approveRes = await fetch(`${API_BASE}/receptionist/appointments/${apptId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${recToken}`,
    },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.strictEqual(approveRes.status, 200, "Approval must return 200");
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.status, "confirmed");
  console.log(`[PASS] Step 4b: Receptionist approved appointment #${apptId} -> status: 'confirmed'.`);

  // 5. Doctor Login & Schedule Inspection
  const docLoginRes = await fetch(`${API_BASE}/auth/doctor/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "doctor@gmail.com", password: "doctor123" }),
  });
  assert.strictEqual(docLoginRes.status, 200, "Doctor login must succeed");
  const docToken = (await docLoginRes.json()).token;
  console.log("[PASS] Step 5a: Doctor Bhumi Sharma authenticated.");

  const docApptsRes = await fetch(`${API_BASE}/doctor/appointments`, {
    headers: { Authorization: `Bearer ${docToken}` },
  });
  const docApptsData = await docApptsRes.json();
  const targetInDoc = docApptsData.appointments.find((a) => a.appointment_id === apptId);
  assert(Boolean(targetInDoc), "Confirmed appointment must be visible in doctor's appointment schedule");
  assert.strictEqual(targetInDoc.status, "confirmed", "Doctor must see confirmed status");
  console.log(`[PASS] Step 5b: Doctor sees confirmed consultation #${apptId} for ${targetDate} at ${targetTime}.`);

  // 6. Patient Reloads Appointments
  const patReloadRes = await fetch(`${API_BASE}/patient/appointments`, {
    headers: { Authorization: `Bearer ${patToken}` },
  });
  const patReloadData = await patReloadRes.json();
  const targetInPat = patReloadData.appointments.find((a) => a.appointment_id === apptId);
  assert(Boolean(targetInPat), "Confirmed appointment must be present in patient's list");
  assert.strictEqual(targetInPat.status, "confirmed", "Patient sees updated status 'confirmed'");
  console.log(`[PASS] Step 6: Patient confirms updated status: 'confirmed'.`);

  // 7. Verify Double-Booking Rejection
  const conflictRes = await fetch(`${API_BASE}/patient/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patToken}`,
    },
    body: JSON.stringify({
      doctor_id: 1,
      appointment_date: targetDate,
      appointment_time: targetTime,
      reason: "Conflicting attempt",
    }),
  });
  assert.strictEqual(conflictRes.status, 409, "Double booking same slot must return 409 Conflict");
  console.log("[PASS] Step 7: Double-booking protection strictly enforced (409 Conflict).");

  // 8. Clean up: Patient cancels test appointment
  const cancelRes = await fetch(`${API_BASE}/patient/appointments/${apptId}/cancel`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${patToken}`,
    },
    body: JSON.stringify({ reason: "Verification test completed" }),
  });
  assert.strictEqual(cancelRes.status, 200, "Cancellation must succeed");
  console.log(`[PASS] Step 8: Cleaned up test appointment #${apptId} (status: cancelled).`);

  console.log("\n>>> PRIORITY 4 ALL APPOINTMENT WORKFLOW TESTS PASSED (8/8) <<<\n");
};

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
