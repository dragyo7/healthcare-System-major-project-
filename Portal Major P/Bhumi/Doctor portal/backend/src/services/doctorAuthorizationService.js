const db = require("../config/db");

/**
 * Resolves a doctor record from an authenticated user_id.
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
const getDoctorByUserId = async (userId) => {
    const [doctors] = await db.execute(
        `SELECT doctor_id, user_id, specialization, qualification, license_number
         FROM doctors
         WHERE user_id = ?`,
        [userId]
    );

    if (doctors.length === 0) {
        return null;
    }

    return doctors[0];
};

/**
 * Verifies whether the authenticated doctor has a clinical relationship with the requested patient.
 * A relationship is established if:
 * 1. An existing appointment exists between this doctor and patient, OR
 * 2. An existing prescription was issued by this doctor to this patient.
 *
 * @param {number} doctorId
 * @param {number} patientId
 * @returns {Promise<boolean>}
 */
const isDoctorAuthorizedForPatient = async (doctorId, patientId) => {
    if (!doctorId || !patientId) {
        return false;
    }

    const [rows] = await db.execute(
        `SELECT 1
         FROM appointments
         WHERE doctor_id = ? AND patient_id = ?
         UNION
         SELECT 1
         FROM prescriptions
         WHERE doctor_id = ? AND patient_id = ?
         LIMIT 1`,
        [doctorId, patientId, doctorId, patientId]
    );

    return rows.length > 0;
};

/**
 * Verifies whether the authenticated doctor is authorized to access / modify an appointment.
 * Returns status:
 * - "AUTHORIZED": Appointment exists and belongs to this doctor.
 * - "FORBIDDEN": Appointment exists but belongs to another doctor.
 * - "NOT_FOUND": Appointment does not exist.
 *
 * @param {number} doctorId
 * @param {number} appointmentId
 * @returns {Promise<{status: string, appointment?: object}>}
 */
const verifyAppointmentAccess = async (doctorId, appointmentId) => {
    if (!doctorId || !appointmentId) {
        return { status: "NOT_FOUND" };
    }

    const [appointments] = await db.execute(
        `SELECT appointment_id, doctor_id, patient_id, appointment_date, start_time, end_time, status
         FROM appointments
         WHERE appointment_id = ?`,
        [appointmentId]
    );

    if (appointments.length === 0) {
        return { status: "NOT_FOUND" };
    }

    const appointment = appointments[0];

    if (appointment.doctor_id !== doctorId) {
        return { status: "FORBIDDEN" };
    }

    return { status: "AUTHORIZED", appointment };
};

/**
 * Verifies whether the authenticated doctor is authorized to access / view a prescription.
 * Returns status:
 * - "AUTHORIZED": Prescription exists and belongs to this doctor.
 * - "FORBIDDEN": Prescription exists but belongs to another doctor.
 * - "NOT_FOUND": Prescription does not exist.
 *
 * @param {number} doctorId
 * @param {number} prescriptionId
 * @returns {Promise<{status: string, prescription?: object}>}
 */
const verifyPrescriptionAccess = async (doctorId, prescriptionId) => {
    if (!doctorId || !prescriptionId) {
        return { status: "NOT_FOUND" };
    }

    const [prescriptions] = await db.execute(
        `SELECT prescription_id, doctor_id, patient_id, diagnosis, notes, prescription_date
         FROM prescriptions
         WHERE prescription_id = ?`,
        [prescriptionId]
    );

    if (prescriptions.length === 0) {
        return { status: "NOT_FOUND" };
    }

    const prescription = prescriptions[0];

    if (prescription.doctor_id !== doctorId) {
        return { status: "FORBIDDEN" };
    }

    return { status: "AUTHORIZED", prescription };
};

/**
 * Verifies whether the authenticated doctor is authorized to access a medical report.
 * Checks that the report exists and the doctor is authorized for the report's patient.
 *
 * @param {number} doctorId
 * @param {number} reportId
 * @returns {Promise<{status: string, report?: object}>}
 */
const verifyReportAccess = async (doctorId, reportId) => {
    if (!doctorId || !reportId) {
        return { status: "NOT_FOUND" };
    }

    const [reports] = await db.execute(
        `SELECT report_id, patient_id, report_type, report_name, report_date, report_summary, file_path
         FROM medical_reports
         WHERE report_id = ?`,
        [reportId]
    );

    if (reports.length === 0) {
        return { status: "NOT_FOUND" };
    }

    const report = reports[0];

    const hasAccess = await isDoctorAuthorizedForPatient(doctorId, report.patient_id);
    if (!hasAccess) {
        return { status: "FORBIDDEN" };
    }

    return { status: "AUTHORIZED", report };
};

module.exports = {
    getDoctorByUserId,
    isDoctorAuthorizedForPatient,
    verifyAppointmentAccess,
    verifyPrescriptionAccess,
    verifyReportAccess
};
