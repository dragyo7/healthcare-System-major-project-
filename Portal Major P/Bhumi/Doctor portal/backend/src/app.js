const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const receptionistRoutes = require("./routes/receptionistRoutes");
const { getHub, getHealth } = require("./controllers/hubController");

const app = express();

// Fail-Closed Production Security Checks
const validateSecurityConfig = (env = process.env) => {
    const isProduction = env.NODE_ENV === "production";
    const jwtSecret = env.JWT_SECRET;

    if (isProduction) {
        const prohibitedPatterns = ["rag_healthcare_secret", "secret", "123456", "password", "default", "changeme", "change_me"];
        const isProhibited = !jwtSecret || jwtSecret.length < 32 || prohibitedPatterns.some((p) => jwtSecret.toLowerCase().includes(p));
        if (isProhibited) {
            throw new Error(
                "CRITICAL SECURITY CONFIGURATION ERROR: In production mode (NODE_ENV=production), a strong JWT_SECRET (minimum 32 characters, non-default) MUST be provided via environment configuration."
            );
        }
    } else {
        if (!jwtSecret) {
            console.warn(
                "⚠️ [SECURITY WARNING] JWT_SECRET is not set in environment. Falling back to development secret. DO NOT USE IN PRODUCTION."
            );
            env.JWT_SECRET = "dev_rag_healthcare_insecure_local_secret_only";
        }
    }
    return true;
};
validateSecurityConfig();
app.validateSecurityConfig = validateSecurityConfig;

// Secure Headers Middleware
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

// Production & Local CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5000"
    ];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
            return callback(null, true);
        }
        return callback(new Error("CORS policy violation: origin not allowed"));
    },
    credentials: true
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Unified Portal Hub and Health endpoints
app.get("/", getHub);
app.get("/hub", getHub);
app.get("/health", getHealth);
app.get("/api/health", getHealth);

// Standalone CDS Chat & RAG Gateway Bridge
app.post("/chat", async (req, res) => {
    try {
        const query = req.body?.query || req.body?.clinical_query;
        if (!query) {
            return res.status(400).json({ message: "query is required" });
        }
        const response = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(502).json({ message: "CDS Gateway unavailable", error: err.message });
    }
});

app.get("/ready", async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/ready");
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(502).json({ message: "CDS Gateway unavailable", error: err.message });
    }
});

app.post("/rag/query", async (req, res) => {
    try {
        const response = await fetch("http://127.0.0.1:8000/rag/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        return res.status(502).json({ message: "CDS Gateway unavailable", error: err.message });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/receptionist", receptionistRoutes);

// Centralized Error Handling Middleware (including Multer file limits)
app.use((err, req, res, next) => {
    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                message: "Prescription image exceeds maximum allowable limit of 5MB.",
                error: "LIMIT_FILE_SIZE"
            });
        }
        return res.status(400).json({
            message: `File upload error: ${err.message}`,
            error: err.code || "MULTER_ERROR"
        });
    }
    if (err) {
        console.error("Unhandled Application Error:", err);
        return res.status(err.status || 500).json({
            message: err.message || "Internal server error",
            error: err.name || "SERVER_ERROR"
        });
    }
    next();
});

module.exports = app;
module.exports.validateSecurityConfig = validateSecurityConfig;