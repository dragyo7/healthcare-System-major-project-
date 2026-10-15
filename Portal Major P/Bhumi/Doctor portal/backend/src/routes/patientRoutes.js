const express = require("express");
const { authenticatePatient } = require("../middleware/authMiddleware");
const {
    getPatientProfile,
    getPatientDashboard,
    getPatientMedicalHistory,
    getPatientPrescriptions,
    getPatientMedications,
    getPatientDischarge,
    getPatientAppointments,
    evaluatePatientCDS,
    generatePatientPrescriptionPDF
} = require("../controllers/patientController");

const router = express.Router();

/**
 * All routes require JWT authentication with role 'patient'.
 */
router.get("/profile", authenticatePatient, getPatientProfile);
router.get("/dashboard", authenticatePatient, getPatientDashboard);
router.get("/medical-history", authenticatePatient, getPatientMedicalHistory);
router.get("/prescriptions", authenticatePatient, getPatientPrescriptions);
router.get("/prescriptions/:prescriptionId/pdf", authenticatePatient, generatePatientPrescriptionPDF);
router.get("/medications", authenticatePatient, getPatientMedications);
router.get("/discharge", authenticatePatient, getPatientDischarge);
router.get("/appointments", authenticatePatient, getPatientAppointments);

/**
 * POST /api/patient/cds
 * Restricted Patient Mode Clinical Decision Support / Health Assistant.
 */
router.post("/cds", authenticatePatient, evaluatePatientCDS);

module.exports = router;
