const express = require("express");
const { authenticateReceptionist } = require("../middleware/authMiddleware");
const {
    getDoctors,
    getPatients,
    registerPatient,
    getAppointments,
    createAppointment,
    updateAppointmentStatus
} = require("../controllers/receptionistController");

const router = express.Router();

// Enforce receptionist authentication across all administrative endpoints
router.use(authenticateReceptionist);

router.get("/doctors", getDoctors);
router.get("/patients", getPatients);
router.post("/patients", registerPatient);
router.get("/appointments", getAppointments);
router.post("/appointments", createAppointment);
router.patch("/appointments/:id/status", updateAppointmentStatus);

module.exports = router;
