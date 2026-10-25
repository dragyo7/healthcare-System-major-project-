const express = require("express");

const {
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
} = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(authRateLimiter);

router.post("/doctor/login", doctorLogin);
router.post("/doctor/signup", doctorSignup);
router.post("/patient/login", patientLogin);
router.post("/patient/activate", patientActivate);
router.post("/patient/signup", patientSignup);
router.post("/receptionist/login", receptionistLogin);
router.post("/receptionist/signup", receptionistSignup);
router.post("/receptionist/provision", provisionReceptionist);
router.patch("/staff/:userId/approval", updateStaffApprovalStatus);
router.post("/forgot-password", forgotPassword);
router.get("/verify-reset-token", verifyResetToken);
router.post("/reset-password", resetPassword);

module.exports = router;
