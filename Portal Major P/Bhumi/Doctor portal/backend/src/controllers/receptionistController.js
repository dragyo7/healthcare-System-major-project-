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

/**
 * GET /api/receptionist/doctors
 * Retrieves all registered physicians for appointment scheduling.
 */
const getDoctors = async (req, res) => {
    try {
        const [doctors] = await db.execute(
            `SELECT d.doctor_id, d.user_id, u.full_name, u.email, u.phone,
                    d.specialization, d.qualification, d.license_number, d.experience_years, d.bio
             FROM doctors d
             JOIN users u ON d.user_id = u.user_id
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

        // Secure patient provisioning:
        // No universal/default password fallback. Accounts require individual activation.
        let hashedPassword;
        let rawActivationToken = null;
        let isActivationPending = false;

        if (password && typeof password === "string" && password.trim().length >= 8) {
            // Explicit password provided
            hashedPassword = await bcrypt.hash(password.trim(), 10);
        } else {
            // Unactivated account: set random sentinel hash impossible to match via bcrypt
            isActivationPending = true;
            hashedPassword = `!ACTIVATION_PENDING$${crypto.randomUUID()}`;
            rawActivationToken = crypto.randomBytes(32).toString("hex");
        }

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
                allergies || "No known allergies"
            ]
        );

        const newPatientId = patientResult.insertId;

        // 3. If activation pending, store hashed token (single-use, 72h expiry)
        if (isActivationPending && rawActivationToken) {
            const tokenHash = crypto.createHash("sha256").update(rawActivationToken).digest("hex");
            await connection.execute(
                `INSERT INTO account_activations (user_id, token_hash, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 72 HOUR))`,
                [newUserId, tokenHash]
            );
        }

        await connection.commit();

        const responsePayload = {
            message: isActivationPending
                ? "Patient registered successfully. Account activation is pending password setup."
                : "Patient registered successfully",
            patient: {
                patient_id: newPatientId,
                user_id: newUserId,
                full_name: full_name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                account_status: isActivationPending ? "activation_pending" : "active",
                date_of_birth: normalizedDob,
                gender: gender || null,
                blood_group: blood_group || null,
                address: address || null,
                emergency_contact: emergency_contact || null,
                allergies: allergies || "No known allergies"
            },
            patient_id: newPatientId,
            user_id: newUserId,
            full_name: full_name.trim(),
            email: email.toLowerCase().trim()
        };

        if (isActivationPending && rawActivationToken) {
            const baseUrl = process.env.CLIENT_URL || process.env.PATIENT_PORTAL_URL || "http://localhost:5173";
            responsePayload.activation_url = `${baseUrl}/activate?token=${rawActivationToken}`;
            responsePayload.activation_token = rawActivationToken;
        }

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
 * Books an appointment for an authorized patient and doctor.
 */
const createAppointment = async (req, res) => {
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

        // Validate patient existence
        const [patientCheck] = await db.execute(
            "SELECT patient_id FROM patients WHERE patient_id = ?",
            [patient_id]
        );
        if (patientCheck.length === 0) {
            return res.status(404).json({ message: "Patient not found" });
        }

        // Validate doctor existence
        const [doctorCheck] = await db.execute(
            "SELECT doctor_id FROM doctors WHERE doctor_id = ?",
            [doctor_id]
        );
        if (doctorCheck.length === 0) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        // Calculate default end_time if missing (+30 mins)
        let resolvedEndTime = end_time;
        if (!resolvedEndTime) {
            const [hours, minutes] = start_time.split(":");
            const startMins = parseInt(hours, 10) * 60 + parseInt(minutes || "0", 10);
            const endMins = startMins + 30;
            const endH = String(Math.floor(endMins / 60) % 24).padStart(2, "0");
            const endM = String(endMins % 60).padStart(2, "0");
            resolvedEndTime = `${endH}:${endM}:00`;
        }

        const [result] = await db.execute(
            `INSERT INTO appointments (doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
            [
                doctor_id,
                patient_id,
                appointment_date,
                start_time,
                resolvedEndTime,
                reason || "General appointment"
            ]
        );

        return res.status(201).json({
            message: "Appointment scheduled successfully",
            appointment_id: result.insertId,
            doctor_id,
            patient_id,
            appointment_date,
            start_time,
            end_time: resolvedEndTime,
            status: "scheduled"
        });

    } catch (error) {
        console.error("Receptionist createAppointment error:", error);
        return res.status(500).json({ message: "Failed to schedule appointment" });
    }
};

/**
 * PATCH /api/receptionist/appointments/:id/status
 * Updates appointment status (scheduled, completed, cancelled).
 */
const updateAppointmentStatus = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const { status } = req.body;

        const validStatuses = ["scheduled", "completed", "cancelled"];
        if (!status || !validStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(", ")}`
            });
        }

        const [check] = await db.execute(
            "SELECT appointment_id FROM appointments WHERE appointment_id = ?",
            [appointmentId]
        );

        if (check.length === 0) {
            return res.status(404).json({ message: "Appointment not found" });
        }

        await db.execute(
            "UPDATE appointments SET status = ? WHERE appointment_id = ?",
            [status.toLowerCase(), appointmentId]
        );

        return res.status(200).json({
            message: `Appointment status updated to ${status.toLowerCase()}`,
            appointment_id: appointmentId,
            status: status.toLowerCase()
        });

    } catch (error) {
        console.error("Receptionist updateAppointmentStatus error:", error);
        return res.status(500).json({ message: "Failed to update appointment status" });
    }
};

module.exports = {
    getDoctors,
    getPatients,
    registerPatient,
    getAppointments,
    createAppointment,
    updateAppointmentStatus
};
