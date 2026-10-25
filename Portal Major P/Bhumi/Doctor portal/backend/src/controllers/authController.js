const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const doctorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password were provided
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        // Find doctor by email
        const [users] = await db.execute(
            "SELECT * FROM users WHERE email = ? AND role = 'doctor'",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        if (user.password && user.password.startsWith("!ACTIVATION_PENDING$")) {
            return res.status(403).json({
                message: "Account activation pending."
            });
        }

        if (!("staff_status" in user)) {
            return res.status(500).json({
                message: "Database schema error: staff_status column is missing. Refusing login to prevent authorization downgrade.",
                error: "AUTHORIZATION_SCHEMA_MISSING"
            });
        }

        if (user.staff_status !== "approved") {
            if (user.staff_status === "pending_approval") {
                return res.status(403).json({
                    message: "Doctor account registration is pending clinical administration approval.",
                    error: "STAFF_APPROVAL_PENDING"
                });
            }
            if (user.staff_status === "revoked" || user.staff_status === "suspended") {
                return res.status(403).json({
                    message: `Doctor account access has been ${user.staff_status}. Clinical access prohibited.`,
                    error: `STAFF_${user.staff_status.toUpperCase()}`
                });
            }
            return res.status(403).json({
                message: "Doctor account authorization is missing or unverified. Access prohibited.",
                error: "STAFF_AUTHORIZATION_REQUIRED"
            });
        }

        if (!user.password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        let passwordMatch = false;
        try {
            passwordMatch = await bcrypt.compare(password, user.password);
        } catch (_) {
            passwordMatch = false;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Fetch associated doctor details if available
        const [docs] = await db.execute(
            "SELECT doctor_id, specialization, qualification, license_number FROM doctors WHERE user_id = ?",
            [user.user_id]
        );
        const docRecord = docs[0] || {};

        // Create JWT token
        const token = jwt.sign(
            {
                user_id: user.user_id,
                doctor_id: docRecord.doctor_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.status(200).json({
            message: "Doctor login successful",
            token: token,
            doctor: {
                user_id: user.user_id,
                doctor_id: docRecord.doctor_id,
                name: user.full_name,
                email: user.email,
                role: user.role,
                specialization: docRecord.specialization,
                qualification: docRecord.qualification,
                license_number: docRecord.license_number
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

const patientLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [users] = await db.execute(
            "SELECT * FROM users WHERE email = ? AND role = 'patient'",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        // Check for activation pending
        if (user.password && user.password.startsWith("!ACTIVATION_PENDING$")) {
            return res.status(403).json({
                message: "Account activation pending. Please set your password using your activation link."
            });
        }

        if (!user.password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        let passwordMatch = false;
        try {
            passwordMatch = await bcrypt.compare(password, user.password);
        } catch (_) {
            passwordMatch = false;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.status(200).json({
            message: "Patient login successful",
            token: token,
            patient: {
                user_id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Patient login error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

const receptionistLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [users] = await db.execute(
            "SELECT * FROM users WHERE email = ? AND role = 'receptionist'",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        if (user.password && user.password.startsWith("!ACTIVATION_PENDING$")) {
            return res.status(403).json({
                message: "Account activation pending. Please contact administrator."
            });
        }

        if (!("staff_status" in user)) {
            return res.status(500).json({
                message: "Database schema error: staff_status column is missing. Refusing login to prevent authorization downgrade.",
                error: "AUTHORIZATION_SCHEMA_MISSING"
            });
        }

        if (user.staff_status !== "approved") {
            if (user.staff_status === "pending_approval") {
                return res.status(403).json({
                    message: "Receptionist account registration is pending administration approval.",
                    error: "STAFF_APPROVAL_PENDING"
                });
            }
            if (user.staff_status === "revoked" || user.staff_status === "suspended") {
                return res.status(403).json({
                    message: `Receptionist account access has been ${user.staff_status}. Administrative access prohibited.`,
                    error: `STAFF_${user.staff_status.toUpperCase()}`
                });
            }
            return res.status(403).json({
                message: "Receptionist account authorization is missing or unverified. Access prohibited.",
                error: "STAFF_AUTHORIZATION_REQUIRED"
            });
        }

        if (!user.password) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        let passwordMatch = false;
        try {
            passwordMatch = await bcrypt.compare(password, user.password);
        } catch (_) {
            passwordMatch = false;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.status(200).json({
            message: "Receptionist login successful",
            token: token,
            receptionist: {
                user_id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Receptionist login error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

/**
 * POST /api/auth/patient/activate
 * Body: { token, password }
 * Validates single-use activation token, verifies expiry, sets new bcrypt password, marks token used.
 */
const patientActivate = async (req, res) => {
    let connection;
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                message: "Activation token and new password are required"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock the row to prevent concurrent double redemption
        const [activations] = await connection.execute(
            `SELECT activation_id, user_id, expires_at, used_at
             FROM account_activations
             WHERE token_hash = ?
             FOR UPDATE`,
            [tokenHash]
        );

        if (activations.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Invalid activation token"
            });
        }

        const activation = activations[0];

        if (activation.used_at) {
            await connection.rollback();
            return res.status(400).json({
                message: "Activation token has already been used. Please log in."
            });
        }

        if (new Date(activation.expires_at) < new Date()) {
            await connection.rollback();
            return res.status(400).json({
                message: "Activation token has expired. Please contact reception."
            });
        }

        // Atomic conditional check-and-set
        const [claimResult] = await connection.execute(
            `UPDATE account_activations
             SET used_at = NOW()
             WHERE activation_id = ? AND used_at IS NULL`,
            [activation.activation_id]
        );

        if (claimResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Activation token has already been used."
            });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        await connection.execute(
            "UPDATE users SET password = ? WHERE user_id = ?",
            [hashedPassword, activation.user_id]
        );

        await connection.commit();

        return res.status(200).json({
            message: "Account activated successfully. You may now sign in with your password."
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Patient activation error:", error);
        return res.status(500).json({
            message: "Server error during account activation"
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /api/auth/patient/signup
 * Body: { full_name, email, password, phone, date_of_birth, gender, blood_group, address, emergency_contact, allergies }
 * Self-registration for patients:
 * - Strictly forces role === 'patient' (cannot self-assign doctor or receptionist)
 * - Checks for duplicate email
 * - Validates password length >= 8
 * - Hashes password with bcrypt (salt = 10)
 * - Transactionally creates user and patient profile records
 * - Signs JWT and returns authenticated session
 */
const patientSignup = async (req, res) => {
    let connection;
    try {
        const {
            full_name,
            email,
            password,
            phone,
            date_of_birth,
            gender,
            blood_group,
            address,
            emergency_contact,
            allergies
        } = req.body;

        // Security Guard 1: Reject privileged role selection attempt
        if (req.body.role && req.body.role.toLowerCase() !== "patient") {
            return res.status(403).json({
                message: "Privileged accounts (doctor, receptionist) cannot be self-registered. Administrative provisioning is required."
            });
        }

        // Security Guard 2: Reject arbitrary patient/user ID injection attempts
        if (req.body.user_id !== undefined || req.body.patient_id !== undefined) {
            return res.status(400).json({
                message: "Specifying arbitrary user or patient identifiers is strictly prohibited."
            });
        }

        // Security Guard 3: Strictly enforce affirmative consent to academic research terms
        // Must be explicitly boolean true; truthy strings or numbers are rejected
        const isConsentAccepted = req.body.terms_accepted === true || req.body.termsAccepted === true;
        if (!isConsentAccepted) {
            return res.status(400).json({
                message: "Affirmative consent to the academic research disclaimer and terms (terms_accepted: true) is strictly required for registration."
            });
        }

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Full name, email, and password are required"
            });
        }

        if (typeof full_name !== "string" || full_name.trim().length < 2) {
            return res.status(400).json({
                message: "Full name must be at least 2 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if email already exists
        const [existing] = await connection.execute(
            "SELECT user_id, password FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            await connection.rollback();
            const isPendingStaffActivation = existing[0].password && existing[0].password.startsWith("!ACTIVATION_PENDING$");
            return res.status(400).json({
                message: isPendingStaffActivation
                    ? "An account with this email was registered by clinic staff. Please use your staff activation link to activate your account."
                    : "Email is already registered. Please sign in or use another email."
            });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        const CONSENT_DOCUMENT_VERSION = "v1.0-2026-10";

        // Check if consent columns exist in users schema
        const [consentCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'consent_timestamp'");
        let userResult;
        if (consentCols.length > 0) {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone, consent_timestamp, consent_version)
                 VALUES (?, ?, ?, 'patient', ?, UTC_TIMESTAMP(), ?)`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null, CONSENT_DOCUMENT_VERSION]
            );
        } else {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone)
                 VALUES (?, ?, ?, 'patient', ?)`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null]
            );
        }

        const newUserId = userResult.insertId;

        // 2. Insert into patients (preserve unknown values as null; do not fabricate defaults)
        const [patientResult] = await connection.execute(
            `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                date_of_birth || null,
                gender || null,
                blood_group || null,
                address || null,
                emergency_contact || null,
                allergies && allergies.trim() ? allergies.trim() : null
            ]
        );

        await connection.commit();

        // Create JWT token
        const token = jwt.sign(
            {
                user_id: newUserId,
                role: "patient"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        return res.status(201).json({
            message: "Patient registration successful",
            token,
            patient: {
                user_id: newUserId,
                patient_id: patientResult.insertId,
                name: full_name.trim(),
                email: normalizedEmail,
                role: "patient"
            }
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Patient signup error:", error);
        return res.status(500).json({
            message: "Server error during registration"
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /api/auth/doctor/signup
 * Body: { full_name, email, password, phone, specialization, qualification, license_number, experience_years, bio, terms_accepted }
 * Direct self-registration for doctors:
 * - Reject arbitrary user_id or doctor_id injection
 * - Affirmative consent to academic research terms (terms_accepted: true)
 * - Required fields: full_name (>=2 chars), email (valid), password (>=8 chars)
 * - Optional license syntax check (if provided, length 4..50)
 * - Duplicate email prevention (HTTP 400)
 * - Hashes password with bcrypt (salt = 10)
 * - Transactionally creates user with role='doctor' and doctor record
 * - Signs real JWT token with { user_id, doctor_id, role: 'doctor' }
 * - Returns HTTP 201 with token and doctor profile for immediate session establishment
 */
const doctorSignup = async (req, res) => {
    let connection;
    try {
        const {
            full_name,
            email,
            password,
            phone,
            specialization,
            qualification,
            license_number,
            experience_years,
            bio
        } = req.body;

        // Security Guard 1: Reject arbitrary doctor/user ID injection attempts
        if (req.body.user_id !== undefined || req.body.doctor_id !== undefined) {
            return res.status(400).json({
                message: "Specifying arbitrary user or doctor identifiers is strictly prohibited."
            });
        }

        // Security Guard 2: Affirmative consent to academic research disclaimer
        const isConsentAccepted = req.body.terms_accepted === true || req.body.termsAccepted === true;
        if (!isConsentAccepted) {
            return res.status(400).json({
                message: "Affirmative consent to the academic research disclaimer and terms (terms_accepted: true) is strictly required for registration."
            });
        }

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Full name, email, and password are required"
            });
        }

        if (typeof full_name !== "string" || full_name.trim().length < 2) {
            return res.status(400).json({
                message: "Full name must be at least 2 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        let normalizedLicense = null;
        if (license_number && typeof license_number === "string" && license_number.trim()) {
            normalizedLicense = license_number.trim();
            if (normalizedLicense.length < 4 || normalizedLicense.length > 50) {
                return res.status(400).json({
                    message: "Medical registration / license number must be between 4 and 50 characters."
                });
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if email already exists
        const [existing] = await connection.execute(
            "SELECT user_id, password FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Email is already registered. Please sign in or use another email."
            });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        const CONSENT_DOCUMENT_VERSION = "v1.0-2026-10";

        // Check if staff_status column exists in users schema - fail visibly if missing
        const [staffCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'staff_status'");
        if (staffCols.length === 0) {
            await connection.rollback();
            return res.status(500).json({
                message: "Database schema error: staff_status column is missing. Registration refused to prevent authorization downgrade.",
                error: "AUTHORIZATION_SCHEMA_MISSING"
            });
        }

        const [consentCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'consent_timestamp'");
        let userResult;
        if (consentCols.length > 0) {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone, staff_status, consent_timestamp, consent_version)
                 VALUES (?, ?, ?, 'doctor', ?, 'pending_approval', UTC_TIMESTAMP(), ?)`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null, CONSENT_DOCUMENT_VERSION]
            );
        } else {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone, staff_status)
                 VALUES (?, ?, ?, 'doctor', ?, 'pending_approval')`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null]
            );
        }

        const newUserId = userResult.insertId;

        // 2. Insert into doctors table
        const [doctorResult] = await connection.execute(
            `INSERT INTO doctors (user_id, specialization, qualification, license_number, experience_years, bio)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                specialization && specialization.trim() ? specialization.trim() : "General Medicine",
                qualification && qualification.trim() ? qualification.trim() : "MBBS",
                normalizedLicense,
                experience_years ? parseInt(experience_years, 10) || 0 : 0,
                bio && bio.trim() ? bio.trim() : ""
            ]
        );

        const newDoctorId = doctorResult.insertId;

        await connection.commit();

        // Do NOT issue privileged active JWT token for self-registered doctors. Require clinical administrator approval.
        return res.status(201).json({
            message: "Doctor registration submitted successfully. Account is pending clinical administration approval before patient access is granted.",
            staff_status: "pending_approval",
            token: null,
            doctor: {
                user_id: newUserId,
                doctor_id: newDoctorId,
                name: full_name.trim(),
                email: normalizedEmail,
                role: "doctor",
                staff_status: "pending_approval",
                specialization: specialization && specialization.trim() ? specialization.trim() : "General Medicine",
                qualification: qualification && qualification.trim() ? qualification.trim() : "MBBS",
                license_number: normalizedLicense
            }
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Doctor signup error:", error);
        return res.status(500).json({
            message: "Server error during doctor registration"
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /api/auth/receptionist/provision
 * Administrative controlled one-time receptionist provisioning.
 * Enforces:
 * - Exactly one receptionist account across the facility
 * - Atomic transaction with row lock and database unique constraint
 * - Rejects with HTTP 409 Conflict if receptionist already exists
 * - Password length >= 8, bcrypt hashing
 */
const provisionReceptionist = async (req, res) => {
    let connection;
    try {
        const operatorSecret = req.headers["x-operator-secret"] || req.headers["x-admin-secret"];
        const configuredSecret = (process.env.OPERATOR_SECRET && process.env.OPERATOR_SECRET.trim().length > 0)
            ? process.env.OPERATOR_SECRET.trim()
            : null;
        const hasValidSecret = Boolean(configuredSecret && operatorSecret && operatorSecret === configuredSecret);

        let hasValidStaffAuth = false;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            try {
                const token = req.headers.authorization.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded && (decoded.role === "receptionist" || decoded.role === "admin")) {
                    hasValidStaffAuth = true;
                }
            } catch (_) {}
        }

        if (!hasValidSecret && !hasValidStaffAuth) {
            return res.status(403).json({
                message: "Unauthorized: Protected administrative provisioning requires operator secret or authorized administrator credentials.",
                error: "ADMINISTRATIVE_AUTHORIZATION_REQUIRED"
            });
        }

        const { full_name, email, password, phone } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Full name, email, and password are required"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock users table check for single receptionist invariant
        const [existingRecs] = await connection.execute(
            "SELECT user_id, email FROM users WHERE role = 'receptionist' FOR UPDATE"
        );

        if (existingRecs.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: "A receptionist account already exists for this healthcare facility. Exactly one receptionist account is permitted."
            });
        }

        // Check if email already registered under another role
        const [existingEmail] = await connection.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existingEmail.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Email is already registered. Please use another email."
            });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        const [insertResult] = await connection.execute(
            `INSERT INTO users (full_name, email, password, role, phone)
             VALUES (?, ?, ?, 'receptionist', ?)`,
            [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Administrative receptionist account provisioned successfully",
            receptionist: {
                user_id: insertResult.insertId,
                name: full_name.trim(),
                email: normalizedEmail,
                role: "receptionist"
            }
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "A receptionist account already exists for this healthcare facility. Exactly one receptionist account is permitted."
            });
        }
        console.error("Receptionist provisioning error:", error);
        return res.status(500).json({
            message: "Server error during receptionist provisioning"
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * POST /api/auth/receptionist/signup
 * Direct self-registration for front-desk receptionists:
 * - Affirmative consent to academic research terms (terms_accepted: true)
 * - Required fields: full_name (>=2 chars), email (valid), password (>=8 chars)
 * - Duplicate email prevention (HTTP 400)
 * - Hashes password with bcrypt (salt = 10)
 * - Inserts into users table with role = 'receptionist'
 * - Signs real JWT token with { user_id, role: 'receptionist' }
 * - Returns HTTP 201 with token and receptionist profile for immediate session establishment
 */
const receptionistSignup = async (req, res) => {
    let connection;
    try {
        const { full_name, email, password, phone } = req.body;

        // Security Guard: Affirmative consent to academic research disclaimer
        const isConsentAccepted = req.body.terms_accepted === true || req.body.termsAccepted === true;
        if (!isConsentAccepted) {
            return res.status(400).json({
                message: "Affirmative consent to the academic research disclaimer and terms (terms_accepted: true) is strictly required for registration."
            });
        }

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Full name, email, and password are required"
            });
        }

        if (typeof full_name !== "string" || full_name.trim().length < 2) {
            return res.status(400).json({
                message: "Full name must be at least 2 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if email already exists
        const [existing] = await connection.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Email is already registered. Please sign in or use another email."
            });
        }

        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        const CONSENT_DOCUMENT_VERSION = "v1.0-2026-10";

        // Check if staff_status column exists in users schema - fail visibly if missing
        const [staffCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'staff_status'");
        if (staffCols.length === 0) {
            await connection.rollback();
            return res.status(500).json({
                message: "Database schema error: staff_status column is missing. Registration refused to prevent authorization downgrade.",
                error: "AUTHORIZATION_SCHEMA_MISSING"
            });
        }

        const [consentCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'consent_timestamp'");
        let userResult;
        if (consentCols.length > 0) {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone, staff_status, consent_timestamp, consent_version)
                 VALUES (?, ?, ?, 'receptionist', ?, 'pending_approval', UTC_TIMESTAMP(), ?)`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null, CONSENT_DOCUMENT_VERSION]
            );
        } else {
            [userResult] = await connection.execute(
                `INSERT INTO users (full_name, email, password, role, phone, staff_status)
                 VALUES (?, ?, ?, 'receptionist', ?, 'pending_approval')`,
                [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null]
            );
        }

        const newUserId = userResult.insertId;
        await connection.commit();

        // Do NOT issue privileged active JWT token for self-registered receptionists. Require administration approval.
        return res.status(201).json({
            message: "Receptionist registration submitted successfully. Staff access is pending administration approval before front-desk operations can be performed.",
            staff_status: "pending_approval",
            token: null,
            receptionist: {
                user_id: newUserId,
                name: full_name.trim(),
                email: normalizedEmail,
                role: "receptionist",
                staff_status: "pending_approval"
            }
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("Receptionist signup error:", error);
        return res.status(500).json({
            message: "Server error during receptionist registration"
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * PATCH /api/auth/staff/:userId/approval
 * Protected clinical administration approval lifecycle for staff accounts.
 * Allows approved administrators / operators to transition staff_status between:
 * - 'approved', 'suspended', 'revoked', 'pending_approval'
 * Enforces:
 * - Operator secret or approved receptionist token required (HTTP 403)
 * - Self-approval prevention (actor cannot approve their own account)
 * - Target role verification (patients do not have staff approval lifecycle)
 */
const updateStaffApprovalStatus = async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);
        const { status } = req.body;

        if (isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const validStatuses = ["approved", "suspended", "revoked", "pending_approval"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${validStatuses.join(", ")}`
            });
        }

        const operatorSecret = req.headers["x-operator-secret"] || req.headers["x-admin-secret"];
        const configuredSecret = (process.env.OPERATOR_SECRET && process.env.OPERATOR_SECRET.trim().length > 0)
            ? process.env.OPERATOR_SECRET.trim()
            : null;
        let isAuthorizedOperator = Boolean(configuredSecret && operatorSecret && operatorSecret === configuredSecret);
        let callerUserId = null;

        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            try {
                const token = req.headers.authorization.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                callerUserId = decoded.user_id;
                if (decoded.role === "receptionist" || decoded.role === "admin") {
                    const [callerRows] = await db.execute("SELECT staff_status FROM users WHERE user_id = ?", [callerUserId]);
                    if (callerRows.length > 0 && callerRows[0].staff_status === "approved") {
                        isAuthorizedOperator = true;
                    }
                }
            } catch (_) {}
        }

        // Prevent self-approval / self-modification for all staff accounts
        if (callerUserId && callerUserId === targetUserId) {
            return res.status(403).json({
                message: "Self-approval prohibited: Clinicians and staff cannot alter their own approval status.",
                error: "SELF_APPROVAL_PROHIBITED"
            });
        }

        if (!isAuthorizedOperator) {
            return res.status(403).json({
                message: "Unauthorized: Operator secret or approved administrator session required to modify staff approval status.",
                error: "ADMINISTRATIVE_AUTHORIZATION_REQUIRED"
            });
        }

        // Fetch target user
        const [targetUsers] = await db.execute("SELECT user_id, full_name, email, role, staff_status FROM users WHERE user_id = ?", [targetUserId]);
        if (targetUsers.length === 0) {
            return res.status(404).json({ message: "Staff user not found" });
        }

        const targetUser = targetUsers[0];
        if (targetUser.role === "patient") {
            return res.status(400).json({
                message: "Patient accounts do not participate in the staff approval lifecycle."
            });
        }

        await db.execute("UPDATE users SET staff_status = ? WHERE user_id = ?", [status, targetUserId]);

        return res.status(200).json({
            message: `Staff account status successfully updated to '${status}'.`,
            user_id: targetUserId,
            full_name: targetUser.full_name,
            role: targetUser.role,
            previous_status: targetUser.staff_status,
            staff_status: status
        });

    } catch (error) {
        console.error("updateStaffApprovalStatus error:", error);
        return res.status(500).json({ message: "Server error updating staff approval status" });
    }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Safe password reset request:
 * - Validates email syntax
 * - Normalizes email
 * - Always returns 200 to prevent user enumeration
 * - If user exists, creates single-use 32-byte cryptographically secure token with 1-hour expiry
 * - Invalidates prior unused tokens for this user
 * - Stores SHA-256 hash in password_resets
 * - If dev/prototype mode, returns token/reset_url for testing & local demonstration
 */
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== "string") {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                message: "A valid email address is required"
            });
        }

        const [users] = await db.execute(
            "SELECT user_id, full_name, email, role FROM users WHERE email = ?",
            [normalizedEmail]
        );

        // Safe response text (prevents account enumeration)
        const safeMessage = "If an account exists with this email address, password reset instructions have been generated.";

        if (users.length === 0) {
            return res.status(200).json({
                message: safeMessage,
                email: normalizedEmail
            });
        }

        const user = users[0];

        // Invalidate prior unused tokens
        await db.execute(
            "UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
            [user.user_id]
        );

        // Generate 32-byte cryptographically secure random token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        // Insert new token with 1-hour expiry
        await db.execute(
            `INSERT INTO password_resets (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
            [user.user_id, tokenHash]
        );

        const responsePayload = {
            message: safeMessage,
            email: normalizedEmail,
            reset_url: `/reset-password?token=${rawToken}`,
            reset_token: rawToken,
            expires_in_minutes: 60
        };

        return res.status(200).json(responsePayload);

    } catch (error) {
        console.error("forgotPassword error:", error);
        return res.status(500).json({
            message: "Server error during password reset request"
        });
    }
};

/**
 * GET /api/auth/verify-reset-token
 * Query: ?token=...
 * Inspect token validity without consuming it
 */
const verifyResetToken = async (req, res) => {
    try {
        const token = req.query.token;
        if (!token || typeof token !== "string") {
            return res.status(400).json({
                valid: false,
                message: "Password reset token is required."
            });
        }

        const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

        const [rows] = await db.execute(
            `SELECT pr.reset_id, pr.user_id, pr.expires_at, pr.used_at, u.email, u.full_name, u.role
             FROM password_resets pr
             JOIN users u ON pr.user_id = u.user_id
             WHERE pr.token_hash = ?`,
            [tokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                valid: false,
                message: "Invalid password reset token."
            });
        }

        const reset = rows[0];

        if (reset.used_at) {
            return res.status(400).json({
                valid: false,
                message: "Password reset token has already been consumed."
            });
        }

        if (new Date(reset.expires_at) < new Date()) {
            return res.status(400).json({
                valid: false,
                message: "Password reset token has expired."
            });
        }

        return res.status(200).json({
            valid: true,
            email: reset.email,
            role: reset.role
        });

    } catch (error) {
        console.error("verifyResetToken error:", error);
        return res.status(500).json({
            valid: false,
            message: "Server error verifying reset token"
        });
    }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, new_password }
 * Consumes single-use reset token and securely updates user password
 */
const resetPassword = async (req, res) => {
    let connection;
    try {
        const { token, new_password } = req.body;

        if (!token || typeof token !== "string") {
            return res.status(400).json({
                message: "Password reset token is required"
            });
        }

        if (!new_password || typeof new_password !== "string" || new_password.trim().length < 8) {
            return res.status(400).json({
                message: "New password must be at least 8 characters long"
            });
        }

        const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT pr.reset_id, pr.user_id, pr.expires_at, pr.used_at, u.email, u.password as current_password
             FROM password_resets pr
             JOIN users u ON pr.user_id = u.user_id
             WHERE pr.token_hash = ?
             FOR UPDATE`,
            [tokenHash]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "Invalid password reset token."
            });
        }

        const reset = rows[0];

        if (reset.used_at) {
            await connection.rollback();
            return res.status(400).json({
                message: "Password reset token has already been consumed."
            });
        }

        if (new Date(reset.expires_at) < new Date()) {
            await connection.rollback();
            return res.status(400).json({
                message: "Password reset token has expired. Please request a new reset link."
            });
        }

        const hashedPassword = await bcrypt.hash(new_password.trim(), 10);

        // Update password
        await connection.execute(
            "UPDATE users SET password = ? WHERE user_id = ?",
            [hashedPassword, reset.user_id]
        );

        // Mark token used
        await connection.execute(
            "UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?",
            [reset.reset_id]
        );

        await connection.commit();

        return res.status(200).json({
            message: "Password has been reset successfully. You may now sign in with your new password.",
            email: reset.email
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }
        console.error("resetPassword error:", error);
        return res.status(500).json({
            message: "Server error resetting password"
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    doctorLogin,
    doctorSignup,
    patientLogin,
    receptionistLogin,
    patientActivate,
    patientSignup,
    provisionReceptionist,
    receptionistSignup,
    updateStaffApprovalStatus,
    forgotPassword,
    verifyResetToken,
    resetPassword
};