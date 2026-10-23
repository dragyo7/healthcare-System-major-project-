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

        // Create JWT token
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
            message: "Doctor login successful",
            token: token,
            doctor: {
                user_id: user.user_id,
                name: user.full_name,
                email: user.email,
                role: user.role
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

        // 1. Insert into users (role is strictly 'patient' with auditable UTC consent evidence)
        const [userResult] = await connection.execute(
            `INSERT INTO users (full_name, email, password, role, phone, consent_timestamp, consent_version)
             VALUES (?, ?, ?, 'patient', ?, UTC_TIMESTAMP(), ?)`,
            [full_name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null, CONSENT_DOCUMENT_VERSION]
        );

        const newUserId = userResult.insertId;

        // 2. Insert into patients
        const [patientResult] = await connection.execute(
            `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                date_of_birth || "1990-01-01",
                gender || "Other",
                blood_group || "O+",
                address || null,
                emergency_contact || null,
                allergies || "None"
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

module.exports = {
    doctorLogin,
    patientLogin,
    receptionistLogin,
    patientActivate,
    patientSignup,
    provisionReceptionist
};