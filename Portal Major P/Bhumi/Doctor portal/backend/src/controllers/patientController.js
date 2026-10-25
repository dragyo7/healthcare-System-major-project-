/**
 * patientController.js
 *
 * Controller for Patient Portal operations.
 * Implements My Dashboard, Medical History, Prescriptions, Medications,
 * Discharge Care & Follow-up, and Restricted Patient Mode Clinical Decision Support / Health Assistant.
 *
 * Strict BOLA & Safety Guarantees:
 * - Requires authenticated patient session (JWT with role === 'patient')
 * - Resolves patient identity from req.user.user_id, NEVER trusting client-supplied IDs
 * - Cross-patient ID tampering strictly rejected with 403 Forbidden
 * - Transmits Zero PII to the FastAPI CDS Gateway
 * - Operates under mode: "patient" with stricter fail-closed patient guidance
 */

const db = require("../config/db");
const PDFDocument = require("pdfkit");
const { sanitizePatientContext, forwardToFastAPICDS } = require("../services/cdsBridgeService");
const { generatePrescriptionPdfStream } = require("../services/prescriptionPdfService");

/**
 * Helper: Resolve the authenticated user's actual patient record
 */
const getAuthenticatedPatient = async (userId) => {
    const [patientRows] = await db.execute(
        `SELECT p.patient_id, p.user_id, p.date_of_birth, p.gender, p.blood_group,
                p.allergies, p.emergency_contact, p.address,
                u.full_name, u.email, u.phone
         FROM patients p
         JOIN users u ON p.user_id = u.user_id
         WHERE p.user_id = ?`,
        [userId]
    );

    if (patientRows.length === 0) {
        return null;
    }
    return patientRows[0];
};

/**
 * GET /api/patient/profile
 * Returns authenticated patient's demographic profile.
 */
const getPatientProfile = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient profile not found" });
        }

        return res.status(200).json({
            patient: {
                patient_id: patient.patient_id,
                full_name: patient.full_name,
                email: patient.email,
                phone: patient.phone,
                date_of_birth: patient.date_of_birth,
                gender: patient.gender,
                blood_group: patient.blood_group,
                allergies: patient.allergies,
                emergency_contact: patient.emergency_contact,
                address: patient.address
            }
        });
    } catch (error) {
        console.error("Get patient profile error:", error);
        return res.status(500).json({ message: "Server error retrieving profile" });
    }
};

/**
 * GET /api/patient/dashboard
 * Aggregated overview of appointments, active discharge alerts, and recent prescriptions.
 */
const getPatientDashboard = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const patientId = patient.patient_id;

        // 1. Upcoming Appointments
        const [appointments] = await db.execute(
            `SELECT a.appointment_id, a.appointment_date, a.start_time, a.status, a.reason,
                    u.full_name AS doctor_name, d.specialization
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_date DESC, a.start_time ASC
             LIMIT 5`,
            [patientId]
        );

        // 2. Recent Prescriptions
        const [prescriptions] = await db.execute(
            `SELECT p.prescription_id, p.prescription_date, p.diagnosis,
                    u.full_name AS doctor_name, d.specialization
             FROM prescriptions p
             JOIN doctors d ON p.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             WHERE p.patient_id = ?
             ORDER BY p.prescription_date DESC
             LIMIT 3`,
            [patientId]
        );

        // 3. Active Discharge Record
        const [discharges] = await db.execute(
            `SELECT d.discharge_id, d.admission_date, d.discharge_date, d.diagnosis,
                    d.discharge_instructions, d.follow_up_instructions, d.follow_up_date,
                    d.warning_signs, d.status,
                    u.full_name AS doctor_name, doc.specialization
             FROM discharges d
             JOIN doctors doc ON d.doctor_id = doc.doctor_id
             JOIN users u ON doc.user_id = u.user_id
             WHERE d.patient_id = ?
             ORDER BY d.discharge_date DESC, d.discharge_id DESC
             LIMIT 1`,
            [patientId]
        );

        return res.status(200).json({
            patient_id: patientId,
            patient_name: patient.full_name,
            upcoming_appointments: appointments,
            recent_prescriptions: prescriptions,
            active_discharge: discharges.length > 0 ? discharges[0] : null
        });
    } catch (error) {
        console.error("Patient dashboard error:", error);
        return res.status(500).json({ message: "Server error retrieving dashboard" });
    }
};

/**
 * GET /api/patient/medical-history
 * Authorized medical records, symptoms, and lab reports.
 */
const getPatientMedicalHistory = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const patientId = patient.patient_id;

        const [medicalHistory] = await db.execute(
            `SELECT history_id, condition_name, diagnosis, diagnosed_date, notes
             FROM medical_history
             WHERE patient_id = ?
             ORDER BY diagnosed_date DESC`,
            [patientId]
        );

        const [symptoms] = await db.execute(
            `SELECT symptom_id, symptoms, severity, description, reported_date
             FROM symptoms
             WHERE patient_id = ?
             ORDER BY reported_date DESC`,
            [patientId]
        );

        const [reports] = await db.execute(
            `SELECT report_id, report_type, report_name, report_date, report_summary, file_path
             FROM medical_reports
             WHERE patient_id = ?
             ORDER BY report_date DESC`,
            [patientId]
        );

        return res.status(200).json({
            medical_history: medicalHistory,
            symptoms: symptoms,
            reports: reports
        });
    } catch (error) {
        console.error("Patient medical history error:", error);
        return res.status(500).json({ message: "Server error retrieving medical history" });
    }
};

/**
 * GET /api/patient/prescriptions
 * Prescriptions with detailed medicine regimens.
 */
const getPatientPrescriptions = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const patientId = patient.patient_id;

        const [prescriptionRows] = await db.execute(
            `SELECT p.prescription_id, p.prescription_date, p.diagnosis, p.notes,
                    u.full_name AS doctor_name, d.specialization,
                    pm.medicine_id, pm.medicine_name, pm.dosage, pm.frequency, pm.duration, pm.instructions
             FROM prescriptions p
             JOIN doctors d ON p.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             LEFT JOIN prescription_medicines pm ON p.prescription_id = pm.prescription_id
             WHERE p.patient_id = ?
             ORDER BY p.prescription_date DESC, p.prescription_id DESC`,
            [patientId]
        );

        // Group medicines by prescription
        const prescriptionsMap = new Map();
        for (const row of prescriptionRows) {
            if (!prescriptionsMap.has(row.prescription_id)) {
                prescriptionsMap.set(row.prescription_id, {
                    prescription_id: row.prescription_id,
                    prescription_date: row.prescription_date,
                    diagnosis: row.diagnosis,
                    notes: row.notes,
                    doctor_name: row.doctor_name,
                    specialization: row.specialization,
                    medicines: []
                });
            }

            if (row.medicine_id) {
                prescriptionsMap.get(row.prescription_id).medicines.push({
                    medicine_id: row.medicine_id,
                    medicine_name: row.medicine_name,
                    dosage: row.dosage,
                    frequency: row.frequency,
                    duration: row.duration,
                    instructions: row.instructions
                });
            }
        }

        return res.status(200).json({
            prescriptions: Array.from(prescriptionsMap.values())
        });
    } catch (error) {
        console.error("Patient prescriptions error:", error);
        return res.status(500).json({ message: "Server error retrieving prescriptions" });
    }
};

/**
 * GET /api/patient/medications
 * Distinct recorded medications from prescription history.
 */
const getPatientMedications = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const patientId = patient.patient_id;

        const [medRows] = await db.execute(
            `SELECT pm.medicine_name, pm.dosage, pm.frequency, pm.duration, pm.instructions,
                    p.prescription_date, p.diagnosis,
                    u.full_name AS doctor_name
             FROM prescription_medicines pm
             JOIN prescriptions p ON pm.prescription_id = p.prescription_id
             JOIN doctors d ON p.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             WHERE p.patient_id = ?
             ORDER BY p.prescription_date DESC`,
            [patientId]
        );

        // Deduplicate distinct medications, keeping latest regimen
        const medsMap = new Map();
        for (const row of medRows) {
            const key = row.medicine_name.trim().toLowerCase();
            if (!medsMap.has(key)) {
                medsMap.set(key, {
                    medicine_name: row.medicine_name,
                    latest_dosage: row.dosage,
                    latest_frequency: row.frequency,
                    latest_duration: row.duration,
                    instructions: row.instructions,
                    last_prescribed_date: row.prescription_date,
                    diagnosis: row.diagnosis,
                    prescribed_by: row.doctor_name,
                    category: "Recorded Medication Regimen"
                });
            }
        }

        return res.status(200).json({
            patient_id: patientId,
            medications: Array.from(medsMap.values())
        });
    } catch (error) {
        console.error("Patient medications error:", error);
        return res.status(500).json({ message: "Server error retrieving medications" });
    }
};

/**
 * GET /api/patient/discharge
 * Discharge episode and follow-up care instructions.
 */
const getPatientDischarge = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const [discharges] = await db.execute(
            `SELECT d.discharge_id, d.patient_id, d.doctor_id, d.admission_date, d.discharge_date,
                    d.diagnosis, d.discharge_summary, d.discharge_instructions,
                    d.follow_up_instructions, d.follow_up_date, d.warning_signs, d.status,
                    d.created_at, d.updated_at,
                    u.full_name AS doctor_name, doc.specialization
             FROM discharges d
             JOIN doctors doc ON d.doctor_id = doc.doctor_id
             JOIN users u ON doc.user_id = u.user_id
             WHERE d.patient_id = ?
             ORDER BY d.discharge_date DESC, d.discharge_id DESC
             LIMIT 1`,
            [patient.patient_id]
        );

        if (discharges.length === 0) {
            return res.status(200).json({
                discharge: null,
                message: "No active discharge record found for this patient"
            });
        }

        return res.status(200).json({
            discharge: discharges[0]
        });
    } catch (error) {
        console.error("Patient discharge error:", error);
        return res.status(500).json({ message: "Server error retrieving discharge records" });
    }
};

/**
 * GET /api/patient/appointments
 * Patient appointment schedule.
 */
const getPatientAppointments = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const [appointments] = await db.execute(
            `SELECT a.appointment_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time,
                    a.status, a.reason,
                    u.full_name AS doctor_name, d.specialization
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [patient.patient_id]
        );

        return res.status(200).json({
            appointments: appointments
        });
    } catch (error) {
        console.error("Patient appointments error:", error);
        return res.status(500).json({ message: "Server error retrieving appointments" });
    }
};

/**
 * GET /api/patient/doctors
 * Directory of available doctors for patient consultation discovery.
 * Returns: doctor_id, full_name, email, specialization, qualification, experience_years, bio
 */
const getAvailableDoctors = async (req, res) => {
    try {
        const [doctors] = await db.execute(
            `SELECT d.doctor_id, u.full_name, u.email,
                    COALESCE(NULLIF(TRIM(d.specialization), ''), 'General Medicine') AS specialization,
                    COALESCE(NULLIF(TRIM(d.qualification), ''), 'MBBS, MD') AS qualification,
                    COALESCE(d.experience_years, 5) AS experience_years,
                    COALESCE(NULLIF(TRIM(d.bio), ''), 'Consultation Chamber, Main OPD Wing') AS bio
             FROM doctors d
             JOIN users u ON d.user_id = u.user_id
             WHERE u.staff_status = 'approved'
             ORDER BY u.full_name ASC`
        );


        return res.status(200).json({
            count: doctors.length,
            doctors
        });
    } catch (error) {
        console.error("Patient getAvailableDoctors error:", error);
        return res.status(500).json({ message: "Failed to retrieve doctor directory" });
    }
};

/**
 * POST /api/patient/appointments
 * Patient requests a consultation appointment with a selected physician.
 * Body: { doctor_id, appointment_date, start_time, end_time, reason }
 */
const requestAppointment = async (req, res) => {
    let connection;
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const { doctor_id, appointment_date, start_time, appointment_time, end_time, reason } = req.body || {};
        const effectiveStartTime = start_time || appointment_time;

        if (!doctor_id || !appointment_date || !effectiveStartTime) {
            return res.status(400).json({
                message: "doctor_id, appointment_date, and start_time are required"
            });
        }

        const apptDate = new Date(appointment_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(apptDate.getTime()) || apptDate < today) {
            return res.status(400).json({
                message: "Appointment date must be today or a future date"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Verify doctor exists
        const [doctorRows] = await connection.execute(
            `SELECT d.doctor_id, u.full_name
             FROM doctors d
             JOIN users u ON d.user_id = u.user_id
             WHERE d.doctor_id = ?`,
            [doctor_id]
        );

        if (doctorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Selected physician does not exist" });
        }

        // Resolve end_time: default to +30 mins if not provided
        let calcEndTime = end_time;
        if (!calcEndTime) {
            const [hours, minutes] = effectiveStartTime.split(":");
            const startMins = parseInt(hours, 10) * 60 + parseInt(minutes || "0", 10);
            const endMins = startMins + 30;
            const endH = String(Math.floor(endMins / 60) % 24).padStart(2, "0");
            const endM = String(endMins % 60).padStart(2, "0");
            calcEndTime = `${endH}:${endM}:00`;
        }

        // 2. Prevent doctor double-booking (interval overlap check)
        const [existingDoctorSlots] = await connection.execute(
            `SELECT appointment_id FROM appointments
             WHERE doctor_id = ? AND appointment_date = ?
               AND status IN ('pending', 'scheduled', 'confirmed')
               AND (start_time < ? AND end_time > ?)
             FOR UPDATE`,
            [doctor_id, appointment_date, calcEndTime, effectiveStartTime]
        );

        if (existingDoctorSlots.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: "The requested time slot is already reserved for this physician. Please choose another time or date."
            });
        }

        // 3. Prevent patient double-booking (interval overlap check)
        const [existingPatientSlots] = await connection.execute(
            `SELECT appointment_id FROM appointments
             WHERE patient_id = ? AND appointment_date = ?
               AND status IN ('pending', 'scheduled', 'confirmed')
               AND (start_time < ? AND end_time > ?)
             FOR UPDATE`,
            [patient.patient_id, appointment_date, calcEndTime, effectiveStartTime]
        );

        if (existingPatientSlots.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: "You already have a consultation booked or pending at this date and time."
            });
        }

        // 4. Create appointment with status 'pending'
        const [insertResult] = await connection.execute(
            `INSERT INTO appointments (doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [doctor_id, patient.patient_id, appointment_date, effectiveStartTime, calcEndTime, reason || null]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Appointment request submitted successfully. Pending review by clinic reception.",
            appointment: {
                appointment_id: insertResult.insertId,
                doctor_id,
                doctor_name: doctorRows[0].full_name,
                patient_id: patient.patient_id,
                appointment_date,
                start_time: effectiveStartTime,
                end_time: calcEndTime,
                reason: reason || null,
                status: "pending"
            }
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Patient requestAppointment error:", error);
        return res.status(500).json({ message: "Server error scheduling appointment request" });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * PATCH /api/patient/appointments/:id/cancel
 * Patient cancels their own pending or scheduled appointment.
 */
const cancelPatientAppointment = async (req, res) => {
    try {
        const patient = await getAuthenticatedPatient(req.user.user_id);
        if (!patient) {
            return res.status(404).json({ message: "Patient record not found" });
        }

        const appointmentId = parseInt(req.params.id, 10);
        if (isNaN(appointmentId)) {
            return res.status(400).json({ message: "Invalid appointment ID" });
        }

        const [rows] = await db.execute(
            "SELECT appointment_id, patient_id, status FROM appointments WHERE appointment_id = ?",
            [appointmentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        const appt = rows[0];

        // BOLA protection: Patient can only cancel their own appointment
        if (appt.patient_id !== patient.patient_id) {
            return res.status(403).json({
                message: "Access denied: You are not authorized to cancel this appointment"
            });
        }

        if (appt.status === "completed") {
            return res.status(400).json({
                message: "Completed appointments cannot be cancelled"
            });
        }

        if (appt.status === "cancelled") {
            return res.status(400).json({
                message: "Appointment is already cancelled"
            });
        }

        await db.execute(
            "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = ?",
            [appointmentId]
        );

        return res.status(200).json({
            message: "Appointment cancelled successfully",
            appointment_id: appointmentId,
            status: "cancelled"
        });

    } catch (error) {
        console.error("Patient cancelPatientAppointment error:", error);
        return res.status(500).json({ message: "Server error cancelling appointment" });
    }
};

/**
 * POST /api/patient/cds
 * Evaluates personal health question using authorized patient clinical context & discharge care instructions.
 */
const evaluatePatientCDS = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { patient_id, clinical_query, query, candidate_medications, language } = req.body || {};

        const actualQuery = (clinical_query || query || "").trim();
        if (!actualQuery) {
            return res.status(400).json({
                message: "clinical_query is required"
            });
        }

        // 1. Resolve the authenticated user's actual patient record
        const ownPatient = await getAuthenticatedPatient(userId);
        if (!ownPatient) {
            return res.status(404).json({
                message: "Patient record not found for authenticated user"
            });
        }

        const ownPatientId = ownPatient.patient_id;

        // 2. Strict BOLA check: Patient cannot request another patient's context
        if (patient_id !== undefined && patient_id !== null && Number(patient_id) !== ownPatientId) {
            return res.status(403).json({
                message: "Access denied: Patients are strictly prohibited from accessing another patient's health context"
            });
        }

        // 3. Retrieve only own clinical EHR records
        const [medicalHistory] = await db.execute(
            `SELECT condition_name, diagnosis, diagnosed_date, notes
             FROM medical_history
             WHERE patient_id = ?
             ORDER BY diagnosed_date DESC`,
            [ownPatientId]
        );

        const [symptoms] = await db.execute(
            `SELECT symptoms, severity, description, reported_date
             FROM symptoms
             WHERE patient_id = ?
             ORDER BY reported_date DESC`,
            [ownPatientId]
        );

        const [reports] = await db.execute(
            `SELECT report_type, report_name, report_date, report_summary
             FROM medical_reports
             WHERE patient_id = ?
             ORDER BY report_date DESC`,
            [ownPatientId]
        );

        const [prescriptions] = await db.execute(
            `SELECT pr.diagnosis, pr.prescription_date, pm.medicine_name, pm.dosage, pm.frequency, pm.duration, pm.instructions
             FROM prescriptions pr
             LEFT JOIN prescription_medicines pm ON pr.prescription_id = pm.prescription_id
             WHERE pr.patient_id = ?
             ORDER BY pr.prescription_date DESC`,
            [ownPatientId]
        );

        // 4. Retrieve own discharge instructions (if any)
        const [discharges] = await db.execute(
            `SELECT discharge_id, discharge_date, diagnosis, discharge_summary,
                    discharge_instructions, follow_up_instructions, follow_up_date, warning_signs, status
             FROM discharges
             WHERE patient_id = ?
             ORDER BY discharge_date DESC, discharge_id DESC
             LIMIT 1`,
            [ownPatientId]
        );

        const rawData = {
            patient: ownPatient,
            medical_history: medicalHistory,
            symptoms: symptoms,
            medical_reports: reports,
            prescriptions: prescriptions,
            discharge: discharges.length > 0 ? discharges[0] : null
        };

        // 5. Sanitize patient context (Zero PII transmitted)
        const sanitizedContext = sanitizePatientContext(rawData);

        // 6. Forward to FastAPI CDS Gateway in Restricted Patient Mode
        const cdsResponse = await forwardToFastAPICDS({
            clinical_query: actualQuery,
            mode: "patient",
            patient_context: sanitizedContext,
            candidate_medications: Array.isArray(candidate_medications) ? candidate_medications : [],
            language: language || "auto",
            conversation_history: Array.isArray(req.body.conversation_history) ? req.body.conversation_history.slice(-6) : []
        });

        return res.status(200).json(cdsResponse);
    } catch (error) {
        console.error("Patient CDS Evaluation error:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            message: error.message || "Failed to evaluate patient health assistant"
        });
    }
};

/**
 * GET /api/patient/prescriptions/:prescriptionId/pdf
 * Generates and streams PDF for an authorized prescription belonging to the authenticated patient.
 * Rejects with 403 Forbidden (streaming zero bytes) if the prescription belongs to another patient.
 */
const generatePatientPrescriptionPDF = async (req, res) => {
    try {
        const { prescriptionId } = req.params;
        const ownPatient = await getAuthenticatedPatient(req.user.user_id);
        if (!ownPatient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        // Check if prescription exists and verify ownership
        const [prescriptions] = await db.execute(
            `SELECT
                p.prescription_id,
                p.patient_id,
                p.doctor_id,
                p.diagnosis,
                p.notes,
                p.prescription_date,
                u.full_name AS patient_name,
                doc_u.full_name AS doctor_name,
                d.specialization,
                d.qualification,
                d.license_number
             FROM prescriptions p
             JOIN patients pt ON p.patient_id = pt.patient_id
             JOIN users u ON pt.user_id = u.user_id
             JOIN doctors d ON p.doctor_id = d.doctor_id
             JOIN users doc_u ON d.user_id = doc_u.user_id
             WHERE p.prescription_id = ?`,
            [prescriptionId]
        );

        if (prescriptions.length === 0) {
            // Check if prescription exists at all without join to give exact status
            const [check] = await db.execute(
                `SELECT prescription_id, patient_id FROM prescriptions WHERE prescription_id = ?`,
                [prescriptionId]
            );
            if (check.length === 0) {
                return res.status(404).json({ message: "Prescription not found" });
            }
            if (check[0].patient_id !== ownPatient.patient_id) {
                return res.status(403).json({ message: "You do not have access to this prescription" });
            }
            return res.status(404).json({ message: "Prescription details incomplete" });
        }

        const prescription = prescriptions[0];
        if (prescription.patient_id !== ownPatient.patient_id) {
            return res.status(403).json({ message: "You do not have access to this prescription" });
        }

        // Get medicines
        const [medicines] = await db.execute(
            `SELECT medicine_name, dosage, frequency, duration, instructions
             FROM prescription_medicines
             WHERE prescription_id = ?`,
            [prescriptionId]
        );

        // Stream PDF
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=prescription-${prescriptionId}.pdf`);

        generatePrescriptionPdfStream({
            prescription,
            doctor: {
                full_name: prescription.doctor_name,
                specialization: prescription.specialization,
                qualification: prescription.qualification,
                license_number: prescription.license_number
            },
            patient: ownPatient,
            medicines,
            outputStream: res
        });
    } catch (error) {
        console.error("Patient PDF generation error:", error);
        return res.status(500).json({ message: "Failed to generate prescription PDF" });
    }
};

module.exports = {
    getPatientProfile,
    getPatientDashboard,
    getPatientMedicalHistory,
    getPatientPrescriptions,
    getPatientMedications,
    getPatientDischarge,
    getPatientAppointments,
    getAvailableDoctors,
    requestAppointment,
    cancelPatientAppointment,
    evaluatePatientCDS,
    generatePatientPrescriptionPDF
};
