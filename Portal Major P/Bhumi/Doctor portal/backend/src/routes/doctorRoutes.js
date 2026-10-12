const express = require("express");

const {
    getDoctorProfile,
    getDoctorDashboard,
    getPatients,
    getPatientDetails,
    getDoctorSchedule,
    getDoctorAppointments,
    createPrescription,
    getPatientPrescriptions,
    createAppointment,
    updateAppointmentStatus,
    updateDoctorProfile,
    createDoctorSchedule,
    deleteDoctorSchedule,
    generatePrescriptionPDF,
    getDoctorReport,
    createFollowup,
    getDoctorFollowups,
    evaluateDoctorCDS,
    createOrUpdateDischarge,
    getDoctorPatientDischarge,
    uploadAndProcessPrescriptionOcr,
    getPrescriptionOcrJob,
    confirmPrescriptionOcrJob,
} = require("../controllers/doctorController");

const authenticateDoctor = require("../middleware/authMiddleware");
const upload = require("../middleware/ocrUploadMiddleware");

const router = express.Router();

router.get(
    "/profile",
    authenticateDoctor,
    getDoctorProfile
);
router.put(
    "/profile",
    authenticateDoctor,
    updateDoctorProfile
);
router.get(
    "/dashboard",
    authenticateDoctor,
    getDoctorDashboard
);
router.get(
    "/patients",
    authenticateDoctor,
    getPatients
);
router.get(
    "/patients/:patientId",
    authenticateDoctor,
    getPatientDetails
);
router.get(
    "/schedule",
    authenticateDoctor,
    getDoctorSchedule
);
router.post(
    "/schedule",
    authenticateDoctor,
    createDoctorSchedule
);
router.get(
    "/appointments",
    authenticateDoctor,
    getDoctorAppointments
);
router.post(
    "/prescriptions",
    authenticateDoctor,
    createPrescription
);
router.get(
    "/patients/:patientId/prescriptions",
    authenticateDoctor,
    getPatientPrescriptions
);
router.post(
    "/appointments",
    authenticateDoctor,
    createAppointment
);
router.put(
    "/appointments/:appointmentId/status",
    authenticateDoctor,
    updateAppointmentStatus
);
router.delete(
    "/schedule/:scheduleId",
    authenticateDoctor,
    deleteDoctorSchedule
);
router.get(
    "/prescriptions/:prescriptionId/pdf",
    authenticateDoctor,
    generatePrescriptionPDF
);
router.get(
    "/reports/:reportId",
    authenticateDoctor,
    getDoctorReport
);
router.post(
    "/followups",
    authenticateDoctor,
    createFollowup
);

router.get(
    "/followups",
    authenticateDoctor,
    getDoctorFollowups
);

// Phase 3 — CDS Gateway Evaluation Bridge
router.post(
    "/cds",
    authenticateDoctor,
    evaluateDoctorCDS
);

// Post-Discharge Clinical Care
router.post(
    "/discharge",
    authenticateDoctor,
    createOrUpdateDischarge
);

router.get(
    "/patients/:patientId/discharge",
    authenticateDoctor,
    getDoctorPatientDischarge
);

// Prescription Image Upload, Local OCR & Explicit Human Review
router.post(
    "/prescriptions/upload-ocr",
    authenticateDoctor,
    upload.single("prescription_image"),
    uploadAndProcessPrescriptionOcr
);

router.get(
    "/prescriptions/ocr-jobs/:jobId",
    authenticateDoctor,
    getPrescriptionOcrJob
);

router.post(
    "/prescriptions/confirm-ocr",
    authenticateDoctor,
    confirmPrescriptionOcrJob
);

module.exports = router;