/**
 * test_appointment_concurrency_and_conflicts.js
 * 
 * Exhaustive Verification Suite for CDSS Appointment Persistence,
 * Half-Open Interval Conflict Detection, Clinic Hours Enforcement,
 * Transactional Concurrency Control, and Rescheduling.
 * 
 * Coverage (Section 6.D):
 *  1. Same doctor, identical time (Rejected HTTP 409)
 *  2. Same doctor, partially overlapping time (Rejected HTTP 409)
 *  3. Same doctor, non-overlapping time (Accepted HTTP 201)
 *  4. Same patient, overlapping doctors (Rejected HTTP 409)
 *  5. Same patient, non-overlapping appointments (Accepted HTTP 201)
 *  6. Adjacent slots [start, end) boundary: 10:00-10:30 & 10:30-11:00 (Both Accepted)
 *  7. Canceled appointment followed by replacement booking (Slot Released & Re-booked)
 *  8. Rescheduling into occupied slot (Rejected HTTP 409) vs free slot (Accepted HTTP 200)
 *  9. Concurrency Race: Two simultaneous bookings for same doctor & slot (Exactly 1 succeeds, 1 rejected)
 * 10. Concurrency Race: Two simultaneous bookings for same patient & overlapping slot (Exactly 1 succeeds, 1 rejected)
 * 11. Clinic Operating Hours & Boundary Validation (Sundays, < 09:00, > 17:00, reversed intervals)
 * 12. Cross-Portal Consistency: Patient & Receptionist views reflect persisted state
 */

const axios = require("axios");
const path = require("path");
const mysql = require(path.resolve(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));
const assert = require("assert");

const BASE_URL = process.env.API_URL || "http://127.0.0.1:5000/api";
const DB_CONFIG = {
    host: "127.0.0.1",
    user: "root",
    password: "bhumi",
    database: "rag_healthcare_test",
    port: 3306
};

// Target test calendar dates (Monday - Wednesday next month to avoid past date clashes)
const TEST_DATE_1 = "2026-11-09"; // Monday
const TEST_DATE_2 = "2026-11-10"; // Tuesday
const TEST_SUNDAY = "2026-11-15"; // Sunday

let receptionToken = "";
let patient1Token = "";
let patient2Token = "";
let patient1Id = 1;
let patient2Id = 2;
let doctor1Id = 1; // Dr. Rahul Sharma
let doctor2Id = 2; // Dr. Priya Nair

let createdAppointmentIds = [];
let passedAssertions = 0;

function report(condition, message) {
    if (condition) {
        passedAssertions++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function loginUser(email, password, role) {
    const res = await axios.post(`${BASE_URL}/auth/${role}/login`, { email, password });
    return res.data.token;
}

async function cleanupTestAppointments() {
    if (createdAppointmentIds.length === 0) return;
    const conn = await mysql.createConnection(DB_CONFIG);
    const placeholders = createdAppointmentIds.map(() => "?").join(",");
    await conn.execute(`DELETE FROM appointments WHERE appointment_id IN (${placeholders})`, createdAppointmentIds);
    await conn.end();
}

async function runAppointmentTestSuite() {
    console.log("==========================================================================");
    console.log(" CDSS APPOINTMENT PERSISTENCE, CONFLICT & CONCURRENCY VERIFICATION SUITE  ");
    console.log("==========================================================================");

    // Clean up any test appointments on test dates from previous aborted runs
    const initConn = await mysql.createConnection(DB_CONFIG);
    await initConn.execute(
        "DELETE FROM appointments WHERE appointment_date IN (?, ?) AND (reason LIKE '%consultation%' OR reason LIKE '%checkup%' OR reason LIKE '%test%' OR reason LIKE '%Simultaneous%' OR reason LIKE '%Rescheduled%' OR reason LIKE '%Baseline%' OR reason LIKE '%Adjacent%')",
        [TEST_DATE_1, TEST_DATE_2]
    );
    await initConn.end();

    doctor2Id = 3; // Dr. Elena Vance

    // 0. Setup authentication tokens
    console.log("\n[Setup] Authenticating receptionist and patient roles...");
    receptionToken = await loginUser("receptionist@gmail.com", "receptionist123", "receptionist");
    patient1Token = await loginUser("aarav@gmail.com", "patient123", "patient");
    patient2Token = await loginUser("ananya@gmail.com", "patient123", "patient");
    report(Boolean(receptionToken && patient1Token && patient2Token), "Authenticated all required roles");

    const receptionHeaders = { headers: { Authorization: `Bearer ${receptionToken}` } };
    const patient1Headers = { headers: { Authorization: `Bearer ${patient1Token}` } };

    try {
        // -------------------------------------------------------------------------
        // 1. Same doctor, identical time (Rejected HTTP 409)
        // -------------------------------------------------------------------------
        console.log("\n[Test 1] Same Doctor, Identical Time Overlap Conflict");
        const appt1Res = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor1Id,
            appointment_date: TEST_DATE_1,
            start_time: "10:00:00",
            end_time: "10:30:00",
            reason: "Baseline checkup"
        }, receptionHeaders);

        report(appt1Res.status === 201, "Created baseline appointment #1 (10:00 - 10:30)");
        const appt1Id = appt1Res.data.appointment_id;
        createdAppointmentIds.push(appt1Id);

        let conflictCaught1 = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient2Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_DATE_1,
                start_time: "10:00:00",
                end_time: "10:30:00",
                reason: "Conflicting consultation"
            }, receptionHeaders);
        } catch (err) {
            conflictCaught1 = err.response && err.response.status === 409;
        }
        report(conflictCaught1, "Rejected duplicate booking for same doctor & identical time with HTTP 409 Conflict");

        // -------------------------------------------------------------------------
        // 2. Same doctor, partially overlapping time (Rejected HTTP 409)
        // -------------------------------------------------------------------------
        console.log("\n[Test 2] Same Doctor, Partial Interval Overlap");
        let partialConflictCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient2Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_DATE_1,
                start_time: "10:15:00", // overlaps 10:00 - 10:30
                end_time: "10:45:00",
                reason: "Partial overlap attempt"
            }, receptionHeaders);
        } catch (err) {
            partialConflictCaught = err.response && err.response.status === 409;
        }
        report(partialConflictCaught, "Rejected partial interval overlap (10:15 - 10:45) with HTTP 409 Conflict");

        // -------------------------------------------------------------------------
        // 3. Same doctor, non-overlapping time (Accepted HTTP 201)
        // -------------------------------------------------------------------------
        console.log("\n[Test 3] Same Doctor, Non-Overlapping Slot");
        const appt3Res = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient2Id,
            doctor_id: doctor1Id,
            appointment_date: TEST_DATE_1,
            start_time: "11:00:00",
            end_time: "11:30:00",
            reason: "Non-overlapping consultation"
        }, receptionHeaders);
        report(appt3Res.status === 201, "Allowed non-overlapping appointment for same doctor (11:00 - 11:30)");
        createdAppointmentIds.push(appt3Res.data.appointment_id);

        // -------------------------------------------------------------------------
        // 4. Same patient, overlapping doctors (Rejected HTTP 409)
        // -------------------------------------------------------------------------
        console.log("\n[Test 4] Same Patient Double-Booking Across Different Doctors");
        let patOverlapCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient1Id, // Patient 1 already booked 10:00 - 10:30 with Doctor 1
                doctor_id: doctor2Id, // Attempt booking with Doctor 2
                appointment_date: TEST_DATE_1,
                start_time: "10:00:00",
                end_time: "10:30:00",
                reason: "Cross-doctor patient double-booking"
            }, receptionHeaders);
        } catch (err) {
            patOverlapCaught = err.response && err.response.status === 409;
        }
        report(patOverlapCaught, "Rejected patient double-booking across different physicians with HTTP 409 Conflict");

        // -------------------------------------------------------------------------
        // 5. Same patient, non-overlapping appointments (Accepted HTTP 201)
        // -------------------------------------------------------------------------
        console.log("\n[Test 5] Same Patient, Non-Overlapping Separate Consultations");
        const appt5Res = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor2Id,
            appointment_date: TEST_DATE_1,
            start_time: "14:00:00",
            end_time: "14:30:00",
            reason: "Afternoon checkup"
        }, receptionHeaders);
        report(appt5Res.status === 201, "Allowed same patient second appointment at non-overlapping time (14:00 - 14:30)");
        createdAppointmentIds.push(appt5Res.data.appointment_id);

        // -------------------------------------------------------------------------
        // 6. Adjacent slots [start, end) boundary (Both Accepted)
        // -------------------------------------------------------------------------
        console.log("\n[Test 6] Half-Open Interval Boundary [start, end) Adjacency");
        // Appt 1 is 10:00 - 10:30. A slot from 10:30 to 11:00 is adjacent and must NOT conflict.
        const apptAdjacentRes = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient2Id,
            doctor_id: doctor1Id,
            appointment_date: TEST_DATE_1,
            start_time: "10:30:00",
            end_time: "11:00:00",
            reason: "Adjacent consultation slot"
        }, receptionHeaders);
        report(apptAdjacentRes.status === 201, "Accepted adjacent slot (10:30 - 11:00) with half-open interval rule [A, B)");
        createdAppointmentIds.push(apptAdjacentRes.data.appointment_id);

        // -------------------------------------------------------------------------
        // 7. Canceled appointment frees slot for replacement booking
        // -------------------------------------------------------------------------
        console.log("\n[Test 7] Slot Release on Cancellation");
        // Create an appointment at 15:00 - 15:30
        const apptCancelTestRes = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor1Id,
            appointment_date: TEST_DATE_1,
            start_time: "15:00:00",
            end_time: "15:30:00",
            reason: "Appointment to be cancelled"
        }, receptionHeaders);
        const toCancelId = apptCancelTestRes.data.appointment_id;
        createdAppointmentIds.push(toCancelId);

        // Cancel it
        const cancelRes = await axios.patch(
            `${BASE_URL}/receptionist/appointments/${toCancelId}/status`,
            { status: "cancelled" },
            receptionHeaders
        );
        report(cancelRes.status === 200, "Successfully cancelled appointment #toCancelId");

        // Re-book exact same slot with different patient
        const rebookRes = await axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient2Id,
            doctor_id: doctor1Id,
            appointment_date: TEST_DATE_1,
            start_time: "15:00:00",
            end_time: "15:30:00",
            reason: "Replacement booking into cancelled slot"
        }, receptionHeaders);
        report(rebookRes.status === 201, "Successfully booked new consultation into cancelled slot (freed reservation)");
        createdAppointmentIds.push(rebookRes.data.appointment_id);

        // -------------------------------------------------------------------------
        // 8. Rescheduling into occupied slot (Rejected) vs free slot (Accepted)
        // -------------------------------------------------------------------------
        console.log("\n[Test 8] Rescheduling Slot Validation & Conflict Prevention");
        // Try rescheduling adjacent appointment into occupied slot (10:00 - 10:30)
        let rescheduleOccupiedCaught = false;
        try {
            await axios.patch(
                `${BASE_URL}/receptionist/appointments/${apptAdjacentRes.data.appointment_id}/reschedule`,
                {
                    appointment_date: TEST_DATE_1,
                    start_time: "10:00:00", // occupied by appt1
                    end_time: "10:30:00"
                },
                receptionHeaders
            );
        } catch (err) {
            rescheduleOccupiedCaught = err.response && err.response.status === 409;
        }
        report(rescheduleOccupiedCaught, "Rejected rescheduling into already occupied slot with HTTP 409");

        // Reschedule into free slot (16:00 - 16:30)
        const rescheduleValidRes = await axios.patch(
            `${BASE_URL}/receptionist/appointments/${apptAdjacentRes.data.appointment_id}/reschedule`,
            {
                appointment_date: TEST_DATE_1,
                start_time: "16:00:00",
                end_time: "16:30:00",
                reason: "Rescheduled to afternoon"
            },
            receptionHeaders
        );
        report(rescheduleValidRes.status === 200, "Successfully rescheduled appointment to free afternoon slot (16:00 - 16:30)");

        // -------------------------------------------------------------------------
        // 9. Concurrency Race: Two simultaneous bookings for same doctor & slot
        // -------------------------------------------------------------------------
        console.log("\n[Test 9] Concurrency Race: Simultaneous Booking for Same Doctor Slot");
        const raceDate = TEST_DATE_2;
        const raceTime = "09:30:00";
        const raceEndTime = "10:00:00";

        const req1 = axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor1Id,
            appointment_date: raceDate,
            start_time: raceTime,
            end_time: raceEndTime,
            reason: "Simultaneous request Alpha"
        }, receptionHeaders).catch(err => err.response);

        const req2 = axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient2Id,
            doctor_id: doctor1Id,
            appointment_date: raceDate,
            start_time: raceTime,
            end_time: raceEndTime,
            reason: "Simultaneous request Beta"
        }, receptionHeaders).catch(err => err.response);

        const [raceRes1, raceRes2] = await Promise.all([req1, req2]);
        const statuses = [raceRes1.status, raceRes2.status];
        const successCount = statuses.filter(s => s === 201).length;
        const conflictCount = statuses.filter(s => s === 409).length;

        report(
            successCount === 1 && conflictCount === 1,
            `Advisory lock serialized concurrent booking: exactly 1 succeeded (201) and 1 rejected (409) [observed: ${statuses.join(", ")}]`
        );
        if (raceRes1.status === 201) createdAppointmentIds.push(raceRes1.data.appointment_id);
        if (raceRes2.status === 201) createdAppointmentIds.push(raceRes2.data.appointment_id);

        // -------------------------------------------------------------------------
        // 10. Concurrency Race: Two simultaneous bookings for same patient & slot
        // -------------------------------------------------------------------------
        console.log("\n[Test 10] Concurrency Race: Simultaneous Booking for Same Patient");
        const patRaceReq1 = axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor1Id,
            appointment_date: raceDate,
            start_time: "11:00:00",
            end_time: "11:30:00",
            reason: "Patient simultaneous Alpha"
        }, receptionHeaders).catch(err => err.response);

        const patRaceReq2 = axios.post(`${BASE_URL}/receptionist/appointments`, {
            patient_id: patient1Id,
            doctor_id: doctor2Id, // different doctor, same patient, overlapping time
            appointment_date: raceDate,
            start_time: "11:00:00",
            end_time: "11:30:00",
            reason: "Patient simultaneous Beta"
        }, receptionHeaders).catch(err => err.response);

        const [patRaceRes1, patRaceRes2] = await Promise.all([patRaceReq1, patRaceReq2]);
        const patStatuses = [patRaceRes1.status, patRaceRes2.status];
        const patSuccessCount = patStatuses.filter(s => s === 201).length;
        const patConflictCount = patStatuses.filter(s => s === 409).length;

        report(
            patSuccessCount === 1 && patConflictCount === 1,
            `Serialized patient booking race: exactly 1 succeeded (201) and 1 rejected (409) [observed: ${patStatuses.join(", ")}]`
        );
        if (patRaceRes1.status === 201) createdAppointmentIds.push(patRaceRes1.data.appointment_id);
        if (patRaceRes2.status === 201) createdAppointmentIds.push(patRaceRes2.data.appointment_id);

        // -------------------------------------------------------------------------
        // 11. Clinic Operating Hours & Boundary Validation
        // -------------------------------------------------------------------------
        console.log("\n[Test 11] Clinic Operating Hours Validation (09:00 - 17:00, Mon-Sat, Sunday Closed)");

        // 11a: Sunday booking
        let sundayCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient1Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_SUNDAY,
                start_time: "10:00:00",
                end_time: "10:30:00"
            }, receptionHeaders);
        } catch (err) {
            sundayCaught = err.response && err.response.status === 400 && err.response.data.message.includes("closed on Sundays");
        }
        report(sundayCaught, "Rejected Sunday appointment: Clinic is closed on Sundays");

        // 11b: Start time before 09:00
        let earlyCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient1Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_DATE_1,
                start_time: "08:30:00",
                end_time: "09:00:00"
            }, receptionHeaders);
        } catch (err) {
            earlyCaught = err.response && err.response.status === 400 && err.response.data.message.includes("operating hours");
        }
        report(earlyCaught, "Rejected early appointment before 09:00 AM");

        // 11c: End time after 17:00
        let lateCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient1Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_DATE_1,
                start_time: "16:45:00",
                end_time: "17:15:00"
            }, receptionHeaders);
        } catch (err) {
            lateCaught = err.response && err.response.status === 400 && err.response.data.message.includes("operating hours");
        }
        report(lateCaught, "Rejected late appointment ending after 05:00 PM");

        // 11d: Reversed interval (start >= end)
        let reversedCaught = false;
        try {
            await axios.post(`${BASE_URL}/receptionist/appointments`, {
                patient_id: patient1Id,
                doctor_id: doctor1Id,
                appointment_date: TEST_DATE_1,
                start_time: "14:00:00",
                end_time: "13:30:00"
            }, receptionHeaders);
        } catch (err) {
            reversedCaught = err.response && err.response.status === 400 && err.response.data.message.includes("earlier than end time");
        }
        report(reversedCaught, "Rejected invalid reversed interval (start >= end)");

        // -------------------------------------------------------------------------
        // 12. Cross-Portal Consistency: Patient & Receptionist Views
        // -------------------------------------------------------------------------
        console.log("\n[Test 12] Cross-Portal State Consistency");
        // Receptionist fetches appointments
        const recApptsRes = await axios.get(`${BASE_URL}/receptionist/appointments`, receptionHeaders);
        report(recApptsRes.status === 200, "Receptionist successfully retrieved consultation schedule");
        const foundInReception = recApptsRes.data.appointments.some(a => a.appointment_id === appt1Id);
        report(foundInReception, `Appointment #${appt1Id} is visible in Receptionist portal`);

        // Patient 1 fetches appointments
        const patApptsRes = await axios.get(`${BASE_URL}/patient/appointments`, patient1Headers);
        report(patApptsRes.status === 200, "Patient 1 successfully retrieved their personal appointments");
        const foundInPatient = patApptsRes.data.appointments.some(a => a.appointment_id === appt1Id);
        report(foundInPatient, `Appointment #${appt1Id} is visible in Patient 1 dossier with matching metadata`);

        // Verify patient cannot see patient 2's appointments
        const leakedPat2 = patApptsRes.data.appointments.some(a => a.patient_id === patient2Id);
        report(!leakedPat2, "BOLA Invariant: Patient 1 cannot view Patient 2's consultations");

        console.log("\n==========================================================================");
        console.log(` ALL ${passedAssertions} APPOINTMENT & CONCURRENCY ASSERTIONS PASSED (100%)`);
        console.log("==========================================================================");

    } finally {
        await cleanupTestAppointments();
    }
}

runAppointmentTestSuite().catch(err => {
    console.error("Test execution aborted:", err.message);
    process.exit(1);
});
