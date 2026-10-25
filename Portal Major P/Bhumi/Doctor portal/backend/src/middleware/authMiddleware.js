const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authenticateDoctor = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role === "receptionist" || decoded.role === "administrative") {
            return res.status(403).json({
                message: "Administrative roles are not permitted to access Doctor Clinical Decision Support"
            });
        }

        if (decoded.role !== "doctor") {
            return res.status(403).json({
                message: "Doctor access required"
            });
        }

        // Real-time persisted authorization check:
        // Ensures revoked, suspended, deleted, or pending accounts cannot bypass with an active JWT
        const [users] = await db.execute(
            "SELECT user_id, role, staff_status FROM users WHERE user_id = ?",
            [decoded.user_id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "User account no longer exists",
                error: "USER_NOT_FOUND"
            });
        }

        const currentUser = users[0];
        const status = currentUser.staff_status;

        if (status !== "approved") {
            if (status === "pending_approval") {
                return res.status(403).json({
                    message: "Staff account is pending clinical administration approval. Unrestricted access to patient dossiers and prescription operations is prohibited.",
                    error: "STAFF_APPROVAL_PENDING"
                });
            }
            if (status === "revoked" || status === "suspended") {
                return res.status(403).json({
                    message: `Staff account access has been ${status}. Access prohibited.`,
                    error: `STAFF_${status.toUpperCase()}`
                });
            }
            return res.status(403).json({
                message: "Staff account authorization is missing or unverified. Access prohibited.",
                error: "STAFF_AUTHORIZATION_REQUIRED"
            });
        }

        req.user = {
            ...decoded,
            staff_status: currentUser.staff_status
        };

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

const authenticatePatient = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role === "receptionist" || decoded.role === "administrative") {
            return res.status(403).json({
                message: "Administrative roles are not permitted to access Clinical Decision Support"
            });
        }

        if (decoded.role !== "patient") {
            return res.status(403).json({
                message: "Patient access required"
            });
        }

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

const authenticateReceptionist = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication token required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role !== "receptionist") {
            return res.status(403).json({
                message: "Receptionist access required"
            });
        }

        // Real-time persisted authorization check:
        // Ensures revoked, suspended, deleted, or pending accounts cannot bypass with an active JWT
        const [users] = await db.execute(
            "SELECT user_id, role, staff_status FROM users WHERE user_id = ?",
            [decoded.user_id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "User account no longer exists",
                error: "USER_NOT_FOUND"
            });
        }

        const currentUser = users[0];
        const status = currentUser.staff_status;

        if (status !== "approved") {
            if (status === "pending_approval") {
                return res.status(403).json({
                    message: "Staff account is pending administration approval. Front-desk operations are prohibited.",
                    error: "STAFF_APPROVAL_PENDING"
                });
            }
            if (status === "revoked" || status === "suspended") {
                return res.status(403).json({
                    message: `Staff account access has been ${status}. Access prohibited.`,
                    error: `STAFF_${status.toUpperCase()}`
                });
            }
            return res.status(403).json({
                message: "Staff account authorization is missing or unverified. Access prohibited.",
                error: "STAFF_AUTHORIZATION_REQUIRED"
            });
        }

        req.user = {
            ...decoded,
            staff_status: currentUser.staff_status
        };

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};

authenticateDoctor.authenticateDoctor = authenticateDoctor;
authenticateDoctor.authenticatePatient = authenticatePatient;
authenticateDoctor.authenticateReceptionist = authenticateReceptionist;

module.exports = authenticateDoctor;
module.exports.authenticateDoctor = authenticateDoctor;
module.exports.authenticatePatient = authenticatePatient;
module.exports.authenticateReceptionist = authenticateReceptionist;