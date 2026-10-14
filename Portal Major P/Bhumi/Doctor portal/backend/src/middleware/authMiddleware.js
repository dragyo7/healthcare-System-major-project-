const jwt = require("jsonwebtoken");

const authenticateDoctor = (req, res, next) => {
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

        req.user = decoded;

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

const authenticateReceptionist = (req, res, next) => {
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

        req.user = decoded;

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