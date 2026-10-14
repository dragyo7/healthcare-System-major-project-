const express = require("express");

const { doctorLogin, patientLogin, receptionistLogin, patientActivate, patientSignup } = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(authRateLimiter);

router.post("/doctor/login", doctorLogin);
router.post("/patient/login", patientLogin);
router.post("/receptionist/login", receptionistLogin);
router.post("/patient/activate", patientActivate);
router.post("/patient/signup", patientSignup);

module.exports = router;