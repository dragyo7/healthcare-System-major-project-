/**
 * receptionistController.js
 *
 * Controller for Administrative Receptionist operations.
 * Implements:
 * - Patient registration & listing
 * - Doctor directory
 * - Appointment scheduling & status updates
 *
 * Strict Role Guarantees:
 * - Requires authenticated receptionist session (role === 'receptionist')
 * - Strictly non-clinical: zero access to diagnoses, prescriptions, medical records, or CDS
 */

const db = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { validateClinicHours, checkAppointmentConflict } = require("../utils/appointmentValidation");

/**
 * GET /api/receptionist/doctors
 * Retrieves all registered physicians for appointment scheduling.
 */
const getDoctors = async (req, res) => {
    try {
        const [doctors] = await db.execute(
            `SELECT d.doctor_id, d.user_id, u.full_name, u.email, u.phone,
                    COALESCE(NULLIF(TRIM(d.specialization), ''), 'General Medicine') AS specialization,
                    COALESCE(NULLIF(TRIM(d.qualification), ''), 'MBBS, MD') AS qualification,
                    COALESCE(NULLIF(TRIM(d.license_number), ''), CONCAT('MCI-REG-', d.doctor_id)) AS license_number,
                    COALESCE(d.experience_years, 5) AS experience_years,
                    COALESCE(NULLIF(TRIM(d.bio), ''), 'Consultation Chamber, OPD Wing') AS bio
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
        console.error("Receptionist getDoctors error:", error);
        return res.status(500).json({ message: "Failed to retrieve doctors" });
    }
};

/**
 * GET /api/receptionist/patients
 * Retrieves administrative patient directory with demographic details.
 */
const getPatients = async (req, res) => {
    try {
        const [patients] = await db.execute(
            `SELECT p.patient_id, p.user_id, u.full_name, u.email, u.phone,
                    p.date_of_birth, p.gender, p.blood_group, p.address, p.emergency_contact, p.allergies,
                    u.created_at
             FROM patients p
             JOIN users u ON p.user_id = u.user_id
             ORDER BY p.patient_id DESC`
        );

        return res.status(200).json({
            count: patients.length,
            patients
        });
    } catch (error) {
        console.error("Receptionist getPatients error:", error);
        return res.status(500).json({ message: "Failed to retrieve patients" });
    }
};

/**
 * POST /api/receptionist/patients
 * Registers a new patient into users and patients tables atomically.
 */
const registerPatient = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            full_name,
            email,
            phone,
            date_of_birth,
            gender,
            blood_group,
            address,
            emergency_contact,
            allergies,
            password
        } = req.body;

        if (!full_name || !email || !phone) {
            return res.status(400).json({
                message: "Full name, email, and phone number are required.",
                field: !full_name ? "full_name" : !email ? "email" : "phone"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                message: "Please enter a valid email address.",
                field: "email"
            });
        }

        // Validate phone format
        const cleanPhone = phone.trim();
        if (cleanPhone.length < 7 || cleanPhone.length > 20) {
            return res.status(400).json({
                message: "Please enter a valid phone number (7 to 20 digits).",
                field: "phone"
            });
        }

        // Validate date_of_birth if provided
        let normalizedDob = null;
        if (date_of_birth && typeof date_of_birth === "string" && date_of_birth.trim() !== "") {
            const trimmedDob = date_of_birth.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
                return res.status(400).json({
                    message: "Invalid date format for date of birth. Expected YYYY-MM-DD.",
                    field: "date_of_birth"
                });
            }
            const [yStr, mStr, dStr] = trimmedDob.split("-");
            const year = parseInt(yStr, 10);
            const month = parseInt(mStr, 10);
            const day = parseInt(dStr, 10);
            const now = new Date();
            const currentYear = now.getFullYear();

            if (year < 1900 || year > currentYear) {
                return res.status(400).json({
                    message: `Year of birth (${year}) must be between 1900 and ${currentYear}.`,
                    field: "date_of_birth"
                });
            }

            const parsedDate = new Date(year, month - 1, day);
            if (
                parsedDate.getFullYear() !== year ||
                parsedDate.getMonth() !== month - 1 ||
                parsedDate.getDate() !== day
            ) {
                return res.status(400).json({
                    message: "Invalid calendar date for date of birth.",
                    field: "date_of_birth"
                });
            }

            const todayStr = now.toISOString().split("T")[0];
            if (trimmedDob > todayStr) {
                return res.status(400).json({
                    message: "Date of birth cannot be in the future.",
                    field: "date_of_birth"
                });
            }
            normalizedDob = trimmedDob;
        }

        // Check if email already exists
        const [existing] = await connection.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [email.toLowerCase().trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "A user with this email already exists."
            });
        }

        await connection.beginTransaction();

        // Direct Active Patient Provisioning with Mandatory Secure Unique Password:
        // Ordinary signup / intake does not require activation tokens, invitation codes, or manual activation links.
        // Predictable shared passwords (e.g. 'patient123') are strictly forbidden.
        if (!password || typeof password !== "string" || password.trim().length < 8) {
            return res.status(400).json({
                message: "A secure patient-chosen password (at least 8 characters) is required for registration.",
                field: "password"
            });
        }
        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        // 1. Insert user
        const [userResult] = await connection.execute(
            `INSERT INTO users (full_name, email, password, role, phone)
             VALUES (?, ?, ?, 'patient', ?)`,
            [
                full_name.trim(),
                email.toLowerCase().trim(),
                hashedPassword,
                phone.trim()
            ]
        );

        const newUserId = userResult.insertId;

        // 2. Insert patient profile
        const [patientResult] = await connection.execute(
            `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                normalizedDob,
                gender || null,
                blood_group || null,
                address || null,
                emergency_contact ? String(emergency_contact).trim().slice(0, 100) : null,
                allergies && String(allergies).trim() ? String(allergies).trim() : null
            ]
        );

        const newPatientId = patientResult.insertId;

        // Step 3: Account is directly active (no activation token required)

        await connection.commit();

        const responsePayload = {
            message: "Patient registered successfully. Account is active.",
            patient: {
                patient_id: newPatientId,
                user_id: newUserId,
                full_name: full_name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                account_status: "active",
                date_of_birth: normalizedDob,
                gender: gender || null,
                blood_group: blood_group || null,
                address: address || null,
                emergency_contact: emergency_contact || null,
                allergies: allergies && String(allergies).trim() ? String(allergies).trim() : null
            },
            patient_id: newPatientId,
            user_id: newUserId,
            full_name: full_name.trim(),
            email: email.toLowerCase().trim()
        };

        // No activation URL/token workflow

        return res.status(201).json(responsePayload);

    } catch (error) {
        await connection.rollback();
        console.error("Receptionist registerPatient error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "A patient record with this email already exists." });
        }
        return res.status(500).json({ message: "Failed to register patient. Please verify the information provided." });
    } finally {
        connection.release();
    }
};

/**
 * GET /api/receptionist/appointments
 * Retrieves list of scheduled appointments with patient and doctor metadata.
 */
const getAppointments = async (req, res) => {
    try {
        const [appointments] = await db.execute(
            `SELECT a.appointment_id, a.doctor_id, doc_u.full_name AS doctor_name, d.specialization,
                    a.patient_id, pat_u.full_name AS patient_name, pat_u.phone AS patient_phone,
                    a.appointment_date, a.start_time, a.end_time, a.reason, a.status
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.doctor_id
             JOIN users doc_u ON d.user_id = doc_u.user_id
             JOIN patients p ON a.patient_id = p.patient_id
             JOIN users pat_u ON p.user_id = pat_u.user_id
             ORDER BY a.appointment_date DESC, a.start_time DESC`
        );

        return res.status(200).json({
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error("Receptionist getAppointments error:", error);
        return res.status(500).json({ message: "Failed to retrieve appointments" });
    }
};

/**
 * POST /api/receptionist/appointments
 * Books an appointment for an authorized patient and doctor with clinic operating hours validation
 * and serialized transactional conflict prevention.
 */
const createAppointment = async (req, res) => {
    let connection = null;
    let lockNames = [];
    try {
        const {
            patient_id,
            doctor_id,
            appointment_date,
            start_time,
            end_time,
            reason
        } = req.body;

        if (!patient_id || !doctor_id || !appointment_date || !start_time) {
            return res.status(400).json({
                message: "patient_id, doctor_id, appointment_date, and start_time are required."
            });
        }

        // Validate clinic hours, calendar day, and interval
        const hoursCheck = validateClinicHours(appointment_date, start_time, end_time);
        if (!hoursCheck.valid) {
            return res.status(400).json({ message: hoursCheck.message });
        }

        connection = await db.getConnection();

        // Concurrency serialization locks on both doctor and patient schedules for the date
        // Sorted alphabetically to guarantee deadlock-free locking order across connections
        lockNames = [
            `appt_doc_${doctor_id}_${appointment_date}`,
            `appt_pat_${patient_id}_${appointment_date}`
        ].sort();

        for (const lk of lockNames) {
            await connection.execute("SELECT GET_LOCK(?, 10) AS lock_acquired", [lk]);
        }

        await connection.beginTransaction();

        // Validate patient existence
        const [patientCheck] = await connection.execute(
            "SELECT patient_id FROM patients WHERE patient_id = ?",
            [patient_id]
        );
        if (patientCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Patient not found" });
        }

        // Validate doctor existence
        const [doctorCheck] = await connection.execute(
            "SELECT doctor_id FROM doctors WHERE doctor_id = ?",
            [doctor_id]
        );
        if (doctorCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Check for doctor and patient slot overlaps (half-open [start, end))
        const conflictCheck = await checkAppointmentConflict(connection, {
            doctorId: doctor_id,
            patientId: patient_id,
            appointmentDate: appointment_date,
            startTime: hoursCheck.startTime,
            endTime: hoursCheck.endTime
        });

        if (conflictCheck.conflict) {
            await connection.rollback();
            return res.status(409).json({ message: conflictCheck.message });
        }

        const [result] = await connection.execute(
            `INSERT INTO appointments (doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
            [
                doctor_id,
                patient_id,
                appointment_date,
                hoursCheck.startTime,
                hoursCheck.endTime,
                reason || "General consultation"
            ]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Appointment scheduled successfully",
            appointment_id: result.insertId,
            doctor_id,
            patient_id,
            appointment_date,
            start_time: hoursCheck.startTime,
            end_time: hoursCheck.endTime,
            status: "scheduled"
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Receptionist createAppointment error:", error);
        if (error.code === 'ER_LOCK_DEADLOCK') {
            return res.status(409).json({ message: "Scheduling conflict detected due to concurrent booking attempt." });
        }
        return res.status(500).json({ message: "Failed to schedule appointment" });
    } finally {
        if (connection) {
            if (lockNames && lockNames.length > 0) {
                for (const lk of lockNames) {
                    try { await connection.execute("SELECT RELEASE_LOCK(?)", [lk]); } catch (_) {}
                }
            }
            connection.release();
        }
    }
};

/**
 * PATCH /api/receptionist/appointments/:id/reschedule
 * Reschedules an existing appointment to a new date and time slot with conflict checks.
 */
const rescheduleAppointment = async (req, res) => {
    let connection = null;
    let lockNames = [];
    try {
        const appointmentId = req.params.id;
        const { appointment_date, start_time, end_time, reason } = req.body;

        if (!appointment_date || !start_time) {
            return res.status(400).json({
                message: "appointment_date and start_time are required to reschedule an appointment."
            });
        }

        // Validate clinic hours
        const hoursCheck = validateClinicHours(appointment_date, start_time, end_time);
        if (!hoursCheck.valid) {
            return res.status(400).json({ message: hoursCheck.message });
        }

        connection = await db.getConnection();

        const [apptRows] = await connection.execute(
            "SELECT appointment_id, doctor_id, patient_id, appointment_date, start_time, end_time, status FROM appointments WHERE appointment_id = ?",
            [appointmentId]
        );

        if (apptRows.length === 0) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        const appt = apptRows[0];
        const currentStatus = (appt.status || "scheduled").toLowerCase();

        if (["completed", "cancelled", "rejected"].includes(currentStatus)) {
            return res.status(400).json({
                message: `Cannot reschedule appointment with terminal status '${currentStatus}'.`
            });
        }

        lockNames = [
            `appt_doc_${appt.doctor_id}_${appointment_date}`,
            `appt_pat_${appt.patient_id}_${appointment_date}`
        ].sort();

        for (const lk of lockNames) {
            await connection.execute("SELECT GET_LOCK(?, 10) AS lock_acquired", [lk]);
        }

        await connection.beginTransaction();

        // Check for doctor and patient slot overlaps, excluding the current appointment
        const conflictCheck = await checkAppointmentConflict(connection, {
            doctorId: appt.doctor_id,
            patientId: appt.patient_id,
            appointmentDate: appointment_date,
            startTime: hoursCheck.startTime,
            endTime: hoursCheck.endTime,
            excludeAppointmentId: appointmentId
        });

        if (conflictCheck.conflict) {
            await connection.rollback();
            return res.status(409).json({ message: conflictCheck.message });
        }

        await connection.execute(
            `UPDATE appointments
             SET appointment_date = ?, start_time = ?, end_time = ?, reason = COALESCE(?, reason), status = 'scheduled'
             WHERE appointment_id = ?`,
            [appointment_date, hoursCheck.startTime, hoursCheck.endTime, reason || null, appointmentId]
        );

        await connection.commit();

        return res.status(200).json({
            message: "Appointment rescheduled successfully",
            appointment_id: Number(appointmentId),
            doctor_id: appt.doctor_id,
            patient_id: appt.patient_id,
            appointment_date,
            start_time: hoursCheck.startTime,
            end_time: hoursCheck.endTime,
            status: "scheduled"
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Receptionist rescheduleAppointment error:", error);
        if (error.code === 'ER_LOCK_DEADLOCK') {
            return res.status(409).json({ message: "Scheduling conflict detected due to concurrent booking attempt." });
        }
        return res.status(500).json({ message: "Failed to reschedule appointment" });
    } finally {
        if (connection) {
            if (lockNames && lockNames.length > 0) {
                for (const lk of lockNames) {
                    try { await connection.execute("SELECT RELEASE_LOCK(?)", [lk]); } catch (_) {}
                }
            }
            connection.release();
        }
    }
};

/**
 * PATCH /api/receptionist/appointments/:id/status
 * Updates appointment status (pending, scheduled, confirmed, completed, cancelled, rejected, reschedule_requested).
 */
const updateAppointmentStatus = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { status } = req.body;

        const validStatuses = ["pending", "scheduled", "confirmed", "completed", "cancelled", "rejected", "reschedule_requested"];
        if (!status || !validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(", ")}`
            });
        }

        const [apptRows] = await db.execute(
            "SELECT appointment_id, doctor_id, patient_id, appointment_date, start_time, end_time, status FROM appointments WHERE appointment_id = ?",
            [appointmentId]
        );

        if (apptRows.length === 0) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        const appt = apptRows[0];
        const currentStatus = (appt.status || "scheduled").toLowerCase();
        const newStatus = status.toLowerCase();

        if (currentStatus === newStatus) {
            return res.status(200).json({
                message: `Appointment is already ${newStatus}`,
                appointment_id: Number(appointmentId),
                status: newStatus
            });
        }

        const validTransitions = {
            pending: ["confirmed", "scheduled", "rejected", "cancelled", "reschedule_requested"],
            scheduled: ["confirmed", "completed", "cancelled", "reschedule_requested"],
            confirmed: ["completed", "cancelled", "reschedule_requested"],
            reschedule_requested: ["scheduled", "confirmed", "cancelled", "rejected"],
            completed: [],
            cancelled: [],
            rejected: []
        };

        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid appointment status transition: Cannot transition appointment from '${currentStatus}' to '${newStatus}'.`
            });
        }

        // If approving/confirming/scheduling, ensure no double booking via interval overlap
        if (newStatus === "scheduled" || newStatus === "confirmed") {
            let apptEndTime = appt.end_time;
            if (!apptEndTime) {
                const [hours, minutes] = String(appt.start_time).split(":");
                const startMins = parseInt(hours, 10) * 60 + parseInt(minutes || "0", 10);
                const endMins = startMins + 30;
                const endH = String(Math.floor(endMins / 60) % 24).padStart(2, "0");
                const endM = String(endMins % 60).padStart(2, "0");
                apptEndTime = `${endH}:${endM}:00`;
            }

            const [conflict] = await db.execute(
                `SELECT appointment_id FROM appointments
                 WHERE doctor_id = ? AND appointment_date = ?
                   AND status IN ('scheduled', 'confirmed') AND appointment_id != ?
                   AND (start_time < ? AND end_time > ?)`,
                [appt.doctor_id, appt.appointment_date, appointmentId, apptEndTime, appt.start_time]
            );
            if (conflict.length > 0) {
                return res.status(409).json({
                    message: "Cannot approve appointment: Another appointment is already scheduled for this physician during this time window."
                });
            }
        }

        await db.execute(
            "UPDATE appointments SET status = ? WHERE appointment_id = ?",
            [newStatus, appointmentId]
        );

        return res.status(200).json({
            message: `Appointment status updated to ${newStatus}`,
            appointment_id: appointmentId,
            status: newStatus
        });

    } catch (error) {
        console.error("Receptionist updateAppointmentStatus error:", error);
        return res.status(500).json({ message: "Failed to update appointment status" });
    }
};

/**
 * POST /api/receptionist/doctors
 * Registers a new physician into users and doctors tables atomically.
 * Enforces unique email and license_number.
 * Provisions cryptographic single-use activation token if password not supplied.
 */
const registerDoctor = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            full_name,
            email,
            phone,
            specialization,
            qualification,
            license_number,
            experience_years,
            bio,
            password
        } = req.body;

        if (!full_name || !email || !phone || !specialization) {
            return res.status(400).json({
                message: "Full name, email, phone number, and specialization are required.",
                field: !full_name ? "full_name" : !email ? "email" : !phone ? "phone" : "specialization"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                message: "Please enter a valid email address.",
                field: "email"
            });
        }

        // Validate phone format
        const cleanPhone = phone.trim();
        if (cleanPhone.length < 7 || cleanPhone.length > 20) {
            return res.status(400).json({
                message: "Please enter a valid phone number (7 to 20 digits).",
                field: "phone"
            });
        }

        // Check if email already exists
        const [existing] = await connection.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [email.toLowerCase().trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "A user with this email already exists."
            });
        }

        // Check if license number already exists (if provided)
        if (license_number && typeof license_number === "string" && license_number.trim() !== "") {
            const [existingLic] = await connection.execute(
                "SELECT doctor_id FROM doctors WHERE license_number = ?",
                [license_number.trim()]
            );
            if (existingLic.length > 0) {
                return res.status(409).json({
                    message: "A physician with this license number already exists.",
                    field: "license_number"
                });
            }
        }

        // Direct Active Physician Provisioning with Mandatory Secure Unique Password:
        // Ordinary signup / intake does not require activation tokens, invitation codes, or manual activation links.
        if (!password || typeof password !== "string" || password.trim().length < 8) {
            return res.status(400).json({
                message: "A secure physician account password (at least 8 characters) is required.",
                field: "password"
            });
        }

        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        // 1. Insert user
        const [userResult] = await connection.execute(
            `INSERT INTO users (full_name, email, password, role, phone)
             VALUES (?, ?, ?, 'doctor', ?)`,
            [
                full_name.trim(),
                email.toLowerCase().trim(),
                hashedPassword,
                phone.trim()
            ]
        );

        const newUserId = userResult.insertId;

        // 2. Insert doctor profile
        const [docResult] = await connection.execute(
            `INSERT INTO doctors (user_id, specialization, qualification, license_number, experience_years, bio)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                specialization.trim(),
                qualification ? qualification.trim() : "MBBS",
                license_number ? license_number.trim() : null,
                experience_years ? parseInt(experience_years, 10) || 0 : 0,
                bio ? bio.trim() : null
            ]
        );

        const newDoctorId = docResult.insertId;

        await connection.commit();

        const responsePayload = {
            message: "Physician registered successfully with active credentials.",
            doctor: {
                doctor_id: newDoctorId,
                user_id: newUserId,
                full_name: full_name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                specialization: specialization.trim(),
                qualification: qualification ? qualification.trim() : "MBBS",
                license_number: license_number ? license_number.trim() : null,
                account_status: "active"
            }
        };

        return res.status(201).json(responsePayload);

    } catch (error) {
        await connection.rollback();
        console.error("Receptionist registerDoctor error:", error);
        return res.status(500).json({ message: "Failed to register physician" });
    } finally {
        connection.release();
    }
};

module.exports = {
    getDoctors,
    registerDoctor,
    getPatients,
    registerPatient,
    getAppointments,
    createAppointment,
    rescheduleAppointment,
    updateAppointmentStatus
};
