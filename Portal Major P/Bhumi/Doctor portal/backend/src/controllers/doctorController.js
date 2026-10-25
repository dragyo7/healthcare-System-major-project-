const db = require("../config/db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const {
    getDoctorByUserId,
    isDoctorAuthorizedForPatient,
    verifyAppointmentAccess,
    verifyPrescriptionAccess,
    verifyReportAccess
} = require("../services/doctorAuthorizationService");
const {
    sanitizePatientContext,
    forwardToFastAPICDS,
    forwardToFastAPIPrescriptionScreen
} = require("../services/cdsBridgeService");
const {
    validateMagicBytes,
    performOcr,
    extractCandidateFields
} = require("../services/prescriptionOcrService");
const { generatePrescriptionPdfStream } = require("../services/prescriptionPdfService");
const crypto = require("crypto");

// Allergy class and brand mapping for clinical safety boundary
const ALLERGY_CLASS_MAP = {
    penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin", "amoxicillin-clavulanate", "piperacillin", "cloxacillin", "methicillin"],
    sulfa: ["sulfa", "sulfamethoxazole", "bactrim", "septra", "sulfasalazine", "sulfadiazine"],
    sulfonamide: ["sulfa", "sulfamethoxazole", "bactrim", "septra", "sulfasalazine", "sulfadiazine"],
    aspirin: ["aspirin", "acetylsalicylic acid", "ecosprin", "disprin", "ibuprofen", "naproxen", "nsaid"],
    nsaid: ["aspirin", "ibuprofen", "naproxen", "diclofenac", "meloxicam", "indomethacin", "celecoxib", "ketorolac"],
    statin: ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lovastatin", "fluvastatin"],
    macrolide: ["erythromycin", "clarithromycin", "azithromycin"]
};

const CANONICAL_BRAND_MAP = {
    lipitor: "atorvastatin",
    zocor: "simvastatin",
    crestor: "rosuvastatin",
    biaxin: "clarithromycin",
    zithromax: "azithromycin",
    keflex: "cephalexin",
    augmentin: "amoxicillin",
    amoxil: "amoxicillin",
    tylenol: "acetaminophen",
    panadol: "acetaminophen",
    paracetamol: "acetaminophen",
    advil: "ibuprofen",
    motrin: "ibuprofen",
    aleve: "naproxen",
    plavix: "clopidogrel",
    coumadin: "warfarin",
    glucophage: "metformin",
    lasix: "furosemide"
};

function getCanonicalDrugAliases(name) {
    if (!name) return [];
    const raw = String(name).toLowerCase().trim();
    const cleaned = raw.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|tab|tablet|cap|capsule)?\b/gi, "").trim();
    const tokens = cleaned.split(/[\s,\-_/]+/).filter(t => t.length > 2);
    const aliases = new Set([raw, cleaned, ...tokens]);
    for (const token of Array.from(aliases)) {
        if (CANONICAL_BRAND_MAP[token]) {
            aliases.add(CANONICAL_BRAND_MAP[token]);
        }
    }
    return Array.from(aliases);
}

function checkAllergyContraindication(candidateDrugName, documentedAllergy) {
    if (!candidateDrugName || !documentedAllergy) return false;
    const drug = candidateDrugName.toLowerCase().trim();
    const allergy = documentedAllergy.toLowerCase().trim();
    if (!allergy || allergy === "none" || allergy === "nil" || allergy === "no") return false;

    // 1. Direct equality
    if (drug === allergy) return true;

    // 2. Class-based cross sensitivity matching
    for (const [classKey, members] of Object.entries(ALLERGY_CLASS_MAP)) {
        const allergyMatchesClass = allergy === classKey || members.includes(allergy);
        const drugMatchesClass = drug === classKey || members.some(m => drug.includes(m) || m.includes(drug));
        if (allergyMatchesClass && drugMatchesClass) {
            return true;
        }
    }

    // 3. Normalized token / word boundary match (prevent short substring false positives like "ice" in "clarithromycin")
    if (allergy.length >= 4) {
        const drugTokens = drug.split(/[\s,\-_/]+/);
        const allergyTokens = allergy.split(/[\s,\-_/]+/);
        for (const aTok of allergyTokens) {
            if (aTok.length >= 4) {
                for (const dTok of drugTokens) {
                    if (dTok === aTok || (dTok.length >= 4 && (dTok.startsWith(aTok) || aTok.startsWith(dTok)))) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

function computePrescriptionPayloadHash(patient_id, diagnosis, notes, medicines) {
    const normalizedMedicines = (medicines || []).map(m => ({
        medicine_name: (m.medicine_name || "").trim().toLowerCase(),
        dosage: (m.dosage || "").trim().toLowerCase(),
        frequency: (m.frequency || "").trim().toLowerCase(),
        duration: (m.duration || "").trim().toLowerCase(),
        instructions: (m.instructions || "").trim().toLowerCase()
    })).sort((a, b) => a.medicine_name.localeCompare(b.medicine_name));

    let cleanNotes = (notes || "").trim();
    cleanNotes = cleanNotes.replace(/^\[(EMERGENCY )?CLINICIAN OVERRIDE[^\]]*\]\s*/i, "").trim().toLowerCase();

    const canonical = {
        patient_id: Number(patient_id),
        diagnosis: (diagnosis || "").trim().toLowerCase(),
        notes: cleanNotes,
        medicines: normalizedMedicines
    };

    return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const getDoctorProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [doctors] = await db.execute(
            `SELECT
                u.user_id,
                u.full_name,
                u.email,
                u.phone,
                d.doctor_id,
                d.specialization,
                d.qualification,
                d.license_number,
                d.experience_years,
                d.bio
             FROM users u
             JOIN doctors d ON u.user_id = d.user_id
             WHERE u.user_id = ?`,
            [userId]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                message: "Doctor profile not found"
            });
        }

        res.status(200).json({
            doctor: doctors[0]
        });

    } catch (error) {
        console.error("Profile error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};

const getDoctorDashboard = async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Find doctor
        const [doctors] = await db.execute(
            `SELECT doctor_id
             FROM doctors
             WHERE user_id = ?`,
            [userId]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctors[0].doctor_id;

        // Total authorized patients (across confirmed/completed appointments, prescriptions, or discharges)
        const [patientCount] = await db.execute(
            `SELECT COUNT(DISTINCT patient_id) AS total_patients
             FROM (
                 SELECT patient_id FROM appointments WHERE doctor_id = ? AND status IN ('scheduled', 'confirmed', 'completed')
                 UNION
                 SELECT patient_id FROM prescriptions WHERE doctor_id = ?
                 UNION
                 SELECT patient_id FROM discharges WHERE doctor_id = ?
             ) AS auth_patients`,
            [doctorId, doctorId, doctorId]
        );

        // Today's completed consultations
        const [todayCompleted] = await db.execute(
            `SELECT COUNT(*) AS today_completed
             FROM appointments
             WHERE doctor_id = ?
             AND appointment_date = CURDATE()
             AND status = 'completed'`,
            [doctorId]
        );

        // Upcoming scheduled / confirmed appointments
        const [upcoming] = await db.execute(
            `SELECT COUNT(*) AS upcoming_appointments
             FROM appointments
             WHERE doctor_id = ?
             AND status IN ('scheduled', 'confirmed')
             AND (
                 appointment_date > CURDATE()
                 OR (
                     appointment_date = CURDATE()
                     AND start_time >= CURTIME()
                 )
             )`,
            [doctorId]
        );

        // Active medications prescribed by this doctor (within 30 days)
        const [activeMeds] = await db.execute(
            `SELECT COUNT(DISTINCT pm.medicine_id) AS active_prescriptions
             FROM prescription_medicines pm
             JOIN prescriptions p ON pm.prescription_id = p.prescription_id
             WHERE p.doctor_id = ?
             AND p.prescription_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
            [doctorId]
        );

        // Genuinely pending post-discharge follow-up reviews authored by this doctor
        const [followups] = await db.execute(
            `SELECT COUNT(*) AS pending_followups
             FROM discharges
             WHERE doctor_id = ?
             AND follow_up_date >= CURDATE()`,
            [doctorId]
        );

        // Today's appointments list
        const [todayAppts] = await db.execute(
            `SELECT a.appointment_id, a.patient_id, a.appointment_date, a.start_time, a.end_time,
                    a.status, a.reason, u.full_name AS patient_name, pt.gender, pt.date_of_birth
             FROM appointments a
             JOIN patients pt ON a.patient_id = pt.patient_id
             JOIN users u ON pt.user_id = u.user_id
             WHERE a.doctor_id = ?
             AND a.appointment_date = CURDATE()
             ORDER BY a.start_time ASC`,
            [doctorId]
        );

        // Recent authorized patients
        const [recentPatients] = await db.execute(
            `SELECT pt.patient_id, u.full_name, u.email, u.phone,
                    pt.gender, pt.date_of_birth, pt.allergies,
                    MAX(CASE WHEN a.status = 'completed' AND a.appointment_date <= CURDATE() THEN a.appointment_date ELSE NULL END) AS last_visit
             FROM patients pt
             JOIN users u ON pt.user_id = u.user_id
             LEFT JOIN appointments a ON pt.patient_id = a.patient_id AND a.doctor_id = ?
             WHERE EXISTS (
                 SELECT 1 FROM appointments ap WHERE ap.patient_id = pt.patient_id AND ap.doctor_id = ? AND ap.status IN ('scheduled', 'confirmed', 'completed')
             ) OR EXISTS (
                 SELECT 1 FROM prescriptions pr WHERE pr.patient_id = pt.patient_id AND pr.doctor_id = ?
             ) OR EXISTS (
                 SELECT 1 FROM discharges ds WHERE ds.patient_id = pt.patient_id AND ds.doctor_id = ?
             )
             GROUP BY pt.patient_id, u.full_name, u.email, u.phone, pt.gender, pt.date_of_birth, pt.allergies
             ORDER BY last_visit DESC
             LIMIT 5`,
            [doctorId, doctorId, doctorId, doctorId]
        );

        const totalPatientsNum = Number(patientCount[0].total_patients || 0);
        const upcomingNum = Number(upcoming[0].upcoming_appointments || 0);
        const completedNum = Number(todayCompleted[0].today_completed || 0);
        const activeMedsNum = Number(activeMeds[0].active_prescriptions || 0);
        const followupsNum = Number(followups[0].pending_followups || 0);

        res.status(200).json({
            stats: {
                total_patients: totalPatientsNum,
                upcoming_appointments: upcomingNum,
                today_completed: completedNum,
                today_appointments: todayAppts.length,
                active_prescriptions: activeMedsNum,
                pending_followups: followupsNum
            },
            total_patients: totalPatientsNum,
            upcoming_appointments: upcomingNum,
            today_completed: completedNum,
            today_appointments: todayAppts,
            recent_patients: recentPatients
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const getPatients = async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        let sql = `SELECT DISTINCT
                p.patient_id,
                u.full_name,
                u.email,
                u.phone,
                p.date_of_birth,
                p.gender,
                p.blood_group,
                p.address,
                p.emergency_contact,
                p.allergies
             FROM patients p
             JOIN users u ON p.user_id = u.user_id
             JOIN doctors d ON d.user_id = ?
             WHERE (
                 EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.patient_id AND a.doctor_id = d.doctor_id AND a.status IN ('scheduled', 'confirmed', 'completed'))
                 OR EXISTS (SELECT 1 FROM prescriptions pr WHERE pr.patient_id = p.patient_id AND pr.doctor_id = d.doctor_id)
                 OR EXISTS (SELECT 1 FROM discharges ds WHERE ds.patient_id = p.patient_id AND ds.doctor_id = d.doctor_id)
             )`;
        const params = [req.user.user_id];

        if (search) {
            const numId = parseInt(search, 10);
            if (!isNaN(numId) && String(numId) === search) {
                sql += ` AND (u.full_name LIKE ? OR p.patient_id = ? OR u.phone LIKE ?)`;
                params.push(`%${search}%`, numId, `%${search}%`);
            } else {
                sql += ` AND (u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
        }

        sql += ` ORDER BY u.full_name`;
        const [patients] = await db.execute(sql, params);

        res.status(200).json({
            patients: patients
        });

    } catch (error) {
        console.error("Get patients error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const getPatientDetails = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const userId = req.user.user_id;

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const authorized = await isDoctorAuthorizedForPatient(doctor.doctor_id, patientId);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have access to this patient"
            });
        }

        // Patient personal details
        const [patient] = await db.execute(
            `SELECT
                p.patient_id,
                u.full_name,
                u.email,
                u.phone,
                p.date_of_birth,
                p.gender,
                p.blood_group,
                p.address,
                p.emergency_contact,
                p.allergies
             FROM patients p
             JOIN users u ON p.user_id = u.user_id
             WHERE p.patient_id = ?`,
            [patientId]
        );

        // Medical history
        const [medicalHistory] = await db.execute(
            `SELECT
                history_id,
                condition_name,
                diagnosis,
                diagnosed_date,
                notes
             FROM medical_history
             WHERE patient_id = ?
             ORDER BY diagnosed_date DESC`,
            [patientId]
        );

        // Symptoms
        const [symptoms] = await db.execute(
            `SELECT
                symptom_id,
                symptoms,
                severity,
                description,
                reported_date
             FROM symptoms
             WHERE patient_id = ?
             ORDER BY reported_date DESC`,
            [patientId]
        );

        // Medical reports
        const [reports] = await db.execute(
            `SELECT
                report_id,
                report_type,
                report_name,
                report_date,
                report_summary,
                file_path
             FROM medical_reports
             WHERE patient_id = ?
             ORDER BY report_date DESC`,
            [patientId]
        );

        // Previous prescriptions
        const [prescriptions] = await db.execute(
            `SELECT
                pr.prescription_id,
                pr.diagnosis,
                pr.prescription_date,
                pr.notes,
                pm.medicine_name,
                pm.dosage,
                pm.frequency,
                pm.duration,
                pm.instructions
             FROM prescriptions pr
             LEFT JOIN prescription_medicines pm
                ON pr.prescription_id = pm.prescription_id
             WHERE pr.patient_id = ?
             ORDER BY pr.prescription_date DESC`,
            [patientId]
        );

        // Group prescriptions and medicines
        const rxMap = new Map();
        for (const row of prescriptions) {
            if (!rxMap.has(row.prescription_id)) {
                rxMap.set(row.prescription_id, {
                    prescription_id: row.prescription_id,
                    diagnosis: row.diagnosis,
                    prescription_date: row.prescription_date,
                    created_at: row.prescription_date,
                    notes: row.notes,
                    medicines: []
                });
            }
            if (row.medicine_name) {
                rxMap.get(row.prescription_id).medicines.push({
                    medicine_name: row.medicine_name,
                    dosage: row.dosage,
                    frequency: row.frequency,
                    duration: row.duration,
                    instructions: row.instructions
                });
            }
        }
        const groupedPrescriptions = Array.from(rxMap.values());

        // Appointment history
        const [appointments] = await db.execute(
            `SELECT
                appointment_id,
                appointment_date,
                start_time,
                end_time,
                reason,
                status
             FROM appointments
             WHERE patient_id = ?
             ORDER BY appointment_date DESC, start_time DESC`,
            [patientId]
        );

        // Query latest discharge record
        const [dischargeRows] = await db.execute(
            `SELECT d.*, u.full_name AS doctor_name
             FROM discharges d
             JOIN doctors doc ON d.doctor_id = doc.doctor_id
             JOIN users u ON doc.user_id = u.user_id
             WHERE d.patient_id = ?
             ORDER BY d.discharge_date DESC LIMIT 1`,
            [patientId]
        );

        const patientData = patient[0] ? {
            ...patient[0],
            dob: patient[0].date_of_birth
        } : null;

        const mappedSymptoms = symptoms.map(s => ({
            ...s,
            symptom_name: s.symptoms || s.description || "Unspecified symptom",
            onset_date: s.reported_date
        }));

        res.status(200).json({
            patient: patientData,
            medical_history: medicalHistory,
            symptoms: mappedSymptoms,
            medical_reports: reports,
            prescriptions: groupedPrescriptions,
            appointments: appointments,
            discharge: dischargeRows[0] || null
        });

    } catch (error) {
        console.error("Patient details error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const getDoctorSchedule = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [schedule] = await db.execute(
            `SELECT
                ds.schedule_id,
                ds.day_of_week,
                ds.start_time,
                ds.end_time,
                ds.activity_type,
                ds.location,
                ds.notes,
                ds.available
             FROM doctor_schedule ds
             JOIN doctors d
                ON ds.doctor_id = d.doctor_id
             WHERE d.user_id = ?
             ORDER BY
                FIELD(
                    ds.day_of_week,
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday'
                ),
                ds.start_time`,
            [userId]
        );

        res.status(200).json({
            schedule: schedule
        });

    } catch (error) {
        console.error("Schedule error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const getDoctorAppointments = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [appointments] = await db.execute(
            `SELECT
                a.appointment_id,
                p.patient_id,
                u.full_name AS patient_name,
                u.email AS patient_email,
                u.phone AS patient_phone,
                a.appointment_date,
                a.start_time,
                a.end_time,
                a.reason,
                a.status
             FROM appointments a
             JOIN doctors d
                ON a.doctor_id = d.doctor_id
             JOIN patients p
                ON a.patient_id = p.patient_id
             JOIN users u
                ON p.user_id = u.user_id
             WHERE d.user_id = ?
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [userId]
        );

        res.status(200).json({
            appointments: appointments
        });

    } catch (error) {
        console.error("Appointments error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
/**
 * Shared, authoritative server-side prescription safety gate and atomic persistence engine.
 * Used identically by both direct prescription creation and OCR confirmation routes.
 */
async function executePrescriptionSafetyGateAndPersist({
    doctorId,
    patientId,
    diagnosis,
    notes,
    medicines,
    safetyOverride = false,
    safetyOverrideReason = null,
    idempotencyKey = "",
    source = "direct",
    ocrJobId = null
}) {
    const connection = await db.getConnection();
    let lockName = null;
    let lockAcquired = false;

    try {
        // Compute canonical SHA-256 request hash for idempotency evaluation
        const requestHash = computePrescriptionPayloadHash(patientId, diagnosis, notes, medicines);

        // Concurrency lock scoped to OCR job, idempotency key, or (doctor, patient)
        if (source === "ocr_confirmation" && ocrJobId) {
            lockName = `rx_ocr_job_${ocrJobId}`;
        } else if (idempotencyKey) {
            lockName = `rx_idemp_${doctorId}_${idempotencyKey}`;
        } else {
            lockName = `rx_lock_${doctorId}_${patientId}`;
        }

        try {
            const [lockRes] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
            lockAcquired = lockRes[0]?.acquired === 1;
        } catch (lockErr) {
            console.error("Prescription concurrency lock error:", lockErr.message);
            return {
                status: 503,
                data: {
                    message: "Service temporarily unavailable due to concurrency lock error. Please retry.",
                    error: "CONCURRENCY_LOCK_ERROR"
                }
            };
        }

        if (!lockAcquired) {
            return {
                status: 503,
                data: {
                    message: "Unable to obtain prescription lock within timeout. Please retry.",
                    error: "CONCURRENCY_TIMEOUT"
                }
            };
        }

        // If this is an OCR confirmation, ensure it has not already been confirmed under this lock
        if (source === "ocr_confirmation" && ocrJobId) {
            const [existingJobRows] = await connection.execute(
                `SELECT review_status, confirmed_prescription_id FROM prescription_ocr_jobs WHERE job_id = ?`,
                [ocrJobId]
            );
            if (existingJobRows.length > 0 && existingJobRows[0].review_status === "confirmed") {
                return {
                    status: 200,
                    data: {
                        message: "Duplicate confirmation prevented: OCR prescription already confirmed.",
                        prescription_id: existingJobRows[0].confirmed_prescription_id,
                        duplicate_prevented: true,
                        ocr_already_confirmed: true
                    }
                };
            }
        }

        // 1. If Idempotency-Key is provided, check existing idempotency records for this doctor
        if (idempotencyKey) {
            const [existingKeys] = await connection.execute(
                `SELECT idempotency_key, doctor_id, patient_id, request_hash, prescription_id, response_body
                 FROM prescription_idempotency_keys
                 WHERE idempotency_key = ? AND doctor_id = ?`,
                [idempotencyKey, doctorId]
            );

            if (existingKeys.length > 0) {
                const existing = existingKeys[0];
                if (existing.request_hash === requestHash && Number(existing.patient_id) === Number(patientId)) {
                    // Exact replay: return cached response
                    let parsedResponse = {};
                    try {
                        parsedResponse = typeof existing.response_body === "string"
                            ? JSON.parse(existing.response_body)
                            : existing.response_body;
                    } catch (e) {
                        parsedResponse = { prescription_id: existing.prescription_id };
                    }
                    return {
                        status: 200,
                        data: {
                            ...parsedResponse,
                            prescription_id: existing.prescription_id,
                            duplicate_prevented: true,
                            idempotent_replay: true
                        }
                    };
                } else {
                    // Reused key with different payload or patient: 409 Conflict
                    return {
                        status: 409,
                        data: {
                            message: "Idempotency key reused with different request payload or patient",
                            error: "IDEMPOTENCY_CONFLICT"
                        }
                    };
                }
            }
        } else {
            // 2. Fallback deduplication: Check for identical prescription submitted within 15 seconds
            const [recent] = await connection.execute(
                `SELECT prescription_id, diagnosis, notes FROM prescriptions
                 WHERE doctor_id = ? AND patient_id = ?
                 AND prescription_date >= NOW() - INTERVAL 15 SECOND
                 ORDER BY prescription_id DESC LIMIT 1`,
                [doctorId, patientId]
            );

            if (recent.length > 0) {
                const [recentMeds] = await connection.execute(
                    `SELECT medicine_name, dosage, frequency, duration, instructions FROM prescription_medicines WHERE prescription_id = ?`,
                    [recent[0].prescription_id]
                );
                const recentHash = computePrescriptionPayloadHash(
                    patientId,
                    recent[0].diagnosis,
                    recent[0].notes,
                    recentMeds
                );

                if (recentHash === requestHash) {
                    return {
                        status: 200,
                        data: {
                            message: "Duplicate submission prevented: prescription already recorded.",
                            prescription_id: recent[0].prescription_id,
                            duplicate_prevented: true
                        }
                    };
                }
            }
        }

        // Safety Boundary: screen candidate medicines against documented patient allergies
        const [patientAllergyRows] = await connection.execute(
            `SELECT allergies FROM patients WHERE patient_id = ?`,
            [patientId]
        );
        const allergiesStr = patientAllergyRows[0]?.allergies || "";
        const patientAllergies = allergiesStr
            ? allergiesStr.split(",").map(a => a.trim().toLowerCase()).filter(a => a && a !== "none" && a !== "nil")
            : [];

        const contraindications = [];
        for (const med of medicines) {
            const medName = (med.medicine_name || "").toLowerCase().trim();
            for (const allergy of patientAllergies) {
                if (checkAllergyContraindication(medName, allergy)) {
                    contraindications.push(
                        `ALLERGY CONTRAINDICATION: Patient has documented allergy to '${allergy}', matching candidate drug '${med.medicine_name}'.`
                    );
                }
            }
        }

        // Server-Side Safety Revalidation: Screen candidate medicines against patient's active prescriptions for severe DDIs
        let severeInteractions = [];
        let safetyScreenFailed = false;
        try {
            const [activeRxRows] = await connection.execute(
                `SELECT pm.medicine_name, MAX(pr.prescription_date) AS max_date
                 FROM prescriptions pr
                 JOIN prescription_medicines pm ON pr.prescription_id = pm.prescription_id
                 WHERE pr.patient_id = ?
                 GROUP BY pm.medicine_name
                 ORDER BY max_date DESC LIMIT 20`,
                [patientId]
            );
            const activeMeds = activeRxRows.map(r => r.medicine_name).filter(Boolean);
            const candidateMedNames = medicines.map(m => m.medicine_name).filter(Boolean);

            if (candidateMedNames.length > 0) {
                const screenRes = await forwardToFastAPIPrescriptionScreen({
                    allergies: patientAllergies,
                    active_conditions: [],
                    candidate_medications: candidateMedNames,
                    active_medications: activeMeds
                });

                if (Array.isArray(screenRes.contraindications)) {
                    for (const c of screenRes.contraindications) {
                        if (!contraindications.includes(c)) contraindications.push(c);
                    }
                }

                // Filter for major/critical interactions that involve at least one candidate medication being prescribed (with canonical alias expansion)
                const candidateAliases = candidateMedNames.flatMap(n => getCanonicalDrugAliases(n));
                const major = (screenRes.interactions || []).filter(i => {
                    if (!["major", "critical", "high"].includes(String(i.severity).toLowerCase())) {
                        return false;
                    }
                    const pair = (i.drug_pair || []).map(p => String(p).toLowerCase().trim());
                    return pair.some(d => candidateAliases.some(c => c === d || c.includes(d) || d.includes(c)));
                });
                if (major.length > 0) {
                    severeInteractions = major;
                }
            }
        } catch (screenErr) {
            console.warn("Server-side prescription safety revalidation warning:", screenErr.message);
            safetyScreenFailed = true;
        }

        // STRICT SAFETY INVARIANT 1: Documented patient allergy contraindications CANNOT be bypassed under any circumstances
        if (contraindications.length > 0) {
            return {
                status: 422,
                data: {
                    message: "Prescription strictly blocked by clinical safety boundary: Documented patient allergy contraindications cannot be overridden.",
                    rule_id: "ALLERGY_RULE",
                    contraindications,
                    cannot_override: true
                }
            };
        }

        // STRICT SAFETY INVARIANT 2: Fail-closed if safety service is unreachable (cannot bypass via text override)
        if (safetyScreenFailed) {
            return {
                status: 503,
                data: {
                    message: "Clinical safety verification service unavailable. Cannot verify safety of proposed prescription.",
                    error: "SAFETY_SERVICE_UNAVAILABLE"
                }
            };
        }

        // STRICT SAFETY INVARIANT 3: Severe DDIs require documented clinician override reason
        if (severeInteractions.length > 0) {
            const hasValidDdiOverride = safetyOverride === true &&
                typeof safetyOverrideReason === "string" &&
                safetyOverrideReason.trim().length >= 5;

            if (!hasValidDdiOverride) {
                return {
                    status: 422,
                    data: {
                        message: "Prescription rejected by clinical safety boundary due to severe drug interaction.",
                        rule_id: severeInteractions[0]?.rule_id || "SEVERE_DDI_RULE",
                        severe_interactions: severeInteractions,
                        safety_override_required: true,
                        requires_clinician_reason: true
                    }
                };
            }
        }

        // Clinician override audit trail in notes
        let finalNotes = notes || null;
        if (safetyOverride && safetyOverrideReason) {
            const overridePrefix = safetyScreenFailed
                ? `[EMERGENCY CLINICIAN OVERRIDE - SAFETY SERVICE OUTAGE: ${safetyOverrideReason.trim()}]`
                : `[CLINICIAN OVERRIDE: ${safetyOverrideReason.trim()}]`;
            finalNotes = finalNotes ? `${overridePrefix} ${finalNotes}` : overridePrefix;
        }

        // Start transaction
        await connection.beginTransaction();

        // Create prescription
        const [prescriptionResult] = await connection.execute(
            `INSERT INTO prescriptions
             (doctor_id, patient_id, diagnosis, notes)
             VALUES (?, ?, ?, ?)`,
            [doctorId, patientId, diagnosis || (source === "ocr_confirmation" ? "Prescription via Verified Clinical OCR" : null), finalNotes]
        );

        const prescriptionId = prescriptionResult.insertId;

        // Add medicines
        for (const medicine of medicines) {
            await connection.execute(
                `INSERT INTO prescription_medicines
                 (prescription_id, medicine_name, dosage, frequency, duration, instructions)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    prescriptionId,
                    medicine.medicine_name,
                    medicine.dosage || null,
                    medicine.frequency || null,
                    medicine.duration || null,
                    medicine.instructions || (source === "ocr_confirmation" ? "As instructed" : null)
                ]
            );
        }

        // If from OCR confirmation, update OCR job record atomically
        if (source === "ocr_confirmation" && ocrJobId) {
            const [updateJobRes] = await connection.execute(
                `UPDATE prescription_ocr_jobs
                 SET review_status = 'confirmed', confirmed_prescription_id = ?, confirmed_by_doctor_id = ?
                 WHERE job_id = ? AND review_status != 'confirmed'`,
                [prescriptionId, doctorId, ocrJobId]
            );
            if (updateJobRes.affectedRows === 0) {
                await connection.rollback();
                return {
                    status: 409,
                    data: {
                        message: "OCR job has already been confirmed by another clinician",
                        error: "OCR_ALREADY_CONFIRMED"
                    }
                };
            }
        }

        const successResponse = {
            message: source === "ocr_confirmation"
                ? "Prescription successfully reviewed and created"
                : "Prescription created successfully",
            prescription_id: prescriptionId,
            ...(ocrJobId ? { job_id: ocrJobId, medicines_count: medicines.length } : {}),
            ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {})
        };

        // Persist idempotency record if key was provided (pure INSERT without overwrite)
        if (idempotencyKey) {
            await connection.execute(
                `INSERT INTO prescription_idempotency_keys
                 (idempotency_key, doctor_id, patient_id, request_hash, prescription_id, response_body)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idempotencyKey,
                    doctorId,
                    patientId,
                    requestHash,
                    prescriptionId,
                    JSON.stringify(successResponse)
                ]
            );
        }

        await connection.commit();

        return {
            status: 201,
            data: successResponse
        };

    } catch (error) {
        try { await connection.rollback(); } catch (_) {}
        console.error("Prescription safety gate persistence error:", error);
        return {
            status: 500,
            data: {
                message: "Server error creating prescription: " + error.message
            }
        };
    } finally {
        if (lockAcquired) {
            try {
                await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
            } catch (relErr) {
                console.warn("Could not release advisory lock for prescription:", relErr.message);
            }
        }
        connection.release();
    }
}

const createPrescription = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const {
            patient_id,
            diagnosis,
            notes,
            medicines,
            safety_override,
            safety_override_reason
        } = req.body;

        // Validate required fields
        if (!patient_id || !medicines || !Array.isArray(medicines) || medicines.length === 0) {
            return res.status(400).json({
                message: "Patient ID and at least one medicine are required"
            });
        }

        // Get doctor ID
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctor.doctor_id;

        // Check whether doctor has access to this patient
        const authorized = await isDoctorAuthorizedForPatient(doctorId, patient_id);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have access to this patient"
            });
        }

        // Client-supplied idempotency key (header or body)
        const idempotencyKey = (req.headers["idempotency-key"] || req.body.idempotency_key || "").toString().trim();

        const result = await executePrescriptionSafetyGateAndPersist({
            doctorId,
            patientId: patient_id,
            diagnosis,
            notes,
            medicines,
            safetyOverride: safety_override,
            safetyOverrideReason: safety_override_reason,
            idempotencyKey,
            source: "direct"
        });

        return res.status(result.status).json(result.data);

    } catch (error) {
        console.error("Create prescription error:", error);
        return res.status(500).json({
            message: "Server error"
        });
    }
};
const getPatientPrescriptions = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const userId = req.user.user_id;

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const authorized = await isDoctorAuthorizedForPatient(doctor.doctor_id, patientId);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have access to this patient"
            });
        }

        const [prescriptions] = await db.execute(
            `SELECT
                pr.prescription_id,
                pr.diagnosis,
                pr.prescription_date,
                pr.notes,
                pm.medicine_name,
                pm.dosage,
                pm.frequency,
                pm.duration,
                pm.instructions
             FROM prescriptions pr
             LEFT JOIN prescription_medicines pm
                ON pr.prescription_id = pm.prescription_id
             WHERE pr.patient_id = ?
             ORDER BY pr.prescription_date DESC`,
            [patientId]
        );

        res.status(200).json({
            prescriptions: prescriptions
        });

    } catch (error) {
        console.error("Get patient prescriptions error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const createAppointment = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const {
            patient_id,
            appointment_date,
            start_time,
            end_time,
            reason
        } = req.body;

        if (!patient_id || !appointment_date || !start_time) {
            return res.status(400).json({
                message: "Patient ID, appointment date and start time are required"
            });
        }

        // Find doctor
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctor.doctor_id;

        // Check that the patient exists
        const [patients] = await db.execute(
            `SELECT patient_id
             FROM patients
             WHERE patient_id = ?`,
            [patient_id]
        );

        if (patients.length === 0) {
            return res.status(404).json({
                message: "Patient not found"
            });
        }

        // Check whether doctor has authorization for this patient
        const authorized = await isDoctorAuthorizedForPatient(doctorId, patient_id);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have authorization to schedule appointments for this patient"
            });
        }

        // Compute effective end time
        let effectiveEndTime = end_time;
        if (!effectiveEndTime) {
            const [sh, sm] = start_time.split(":").map(Number);
            const totalMins = (sh || 0) * 60 + (sm || 0) + 30;
            const eh = Math.floor(totalMins / 60) % 24;
            const em = totalMins % 60;
            effectiveEndTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
        }

        // Interval overlap check for doctor and patient
        const [conflictAppointments] = await db.execute(
            `SELECT appointment_id, doctor_id, patient_id
             FROM appointments
             WHERE appointment_date = ?
               AND status IN ('pending', 'scheduled', 'confirmed')
               AND (doctor_id = ? OR patient_id = ?)
               AND (start_time < ? AND COALESCE(end_time, ADDTIME(start_time, '00:30:00')) > ?)`,
            [appointment_date, doctorId, patient_id, effectiveEndTime, start_time]
        );

        if (conflictAppointments.length > 0) {
            const conflict = conflictAppointments[0];
            const isDoc = conflict.doctor_id === doctorId;
            return res.status(409).json({
                message: isDoc
                    ? "Appointment time conflict: Doctor already has an overlapping appointment in this interval."
                    : "Appointment time conflict: Patient already has an overlapping appointment in this interval.",
                error: "APPOINTMENT_CONFLICT",
                conflicting_appointment_id: conflict.appointment_id
            });
        }

        // Create appointment
        const [result] = await db.execute(
            `INSERT INTO appointments
             (doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
            [
                doctorId,
                patient_id,
                appointment_date,
                start_time,
                end_time || null,
                reason || null
            ]
        );

        res.status(201).json({
            message: "Appointment created successfully",
            appointment_id: result.insertId
        });

    } catch (error) {
        console.error("Create appointment error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const updateAppointmentStatus = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const appointmentId = req.params.appointmentId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                message: "Status is required"
            });
        }

        const allowedStatuses = [
            "pending",
            "scheduled",
            "confirmed",
            "completed",
            "cancelled",
            "rejected",
            "reschedule_requested"
        ];

        if (!allowedStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                message: `Invalid appointment status. Allowed: ${allowedStatuses.join(", ")}`
            });
        }

        // Find doctor
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctor.doctor_id;

        // Check appointment access
        const check = await verifyAppointmentAccess(doctorId, appointmentId);
        if (check.status === "NOT_FOUND") {
            return res.status(404).json({
                message: "Appointment not found"
            });
        }
        if (check.status === "FORBIDDEN") {
            return res.status(403).json({
                message: "You do not have access to this appointment"
            });
        }

        const appointment = check.appointment;
        const currentStatus = (appointment.status || "scheduled").toLowerCase();
        const newStatus = status.toLowerCase();

        if (currentStatus === newStatus) {
            return res.status(200).json({
                message: `Appointment is already ${newStatus}`,
                appointment_id: Number(appointmentId),
                status: newStatus
            });
        }

        const validTransitions = {
            pending: ["confirmed", "scheduled", "rejected", "cancelled", "reschedule_requested"],
            scheduled: ["confirmed", "completed", "cancelled", "reschedule_requested"],
            confirmed: ["completed", "cancelled", "reschedule_requested"],
            reschedule_requested: ["scheduled", "confirmed", "cancelled", "rejected"],
            completed: [],
            cancelled: [],
            rejected: []
        };

        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            return res.status(400).json({
                message: `Invalid appointment status transition: Cannot transition appointment from '${currentStatus}' to '${newStatus}'.`
            });
        }

        // Interval overlap check on status transition to scheduled or confirmed
        if (["scheduled", "confirmed"].includes(newStatus)) {
            const apptDate = appointment.appointment_date;
            const apptStart = appointment.start_time;
            let apptEnd = appointment.end_time;
            if (!apptEnd && apptStart) {
                const [sh, sm] = String(apptStart).split(":").map(Number);
                const totalMins = (sh || 0) * 60 + (sm || 0) + 30;
                const eh = Math.floor(totalMins / 60) % 24;
                const em = totalMins % 60;
                apptEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
            }

            if (apptDate && apptStart && apptEnd) {
                const [conflicts] = await db.execute(
                    `SELECT appointment_id, doctor_id, patient_id
                     FROM appointments
                     WHERE appointment_date = ?
                       AND appointment_id != ?
                       AND status IN ('pending', 'scheduled', 'confirmed')
                       AND (doctor_id = ? OR patient_id = ?)
                       AND (start_time < ? AND COALESCE(end_time, ADDTIME(start_time, '00:30:00')) > ?)`,
                    [apptDate, appointmentId, doctorId, appointment.patient_id, apptEnd, apptStart]
                );

                if (conflicts.length > 0) {
                    return res.status(409).json({
                        message: "Cannot confirm or schedule appointment: interval conflict with another active appointment.",
                        error: "APPOINTMENT_CONFLICT",
                        conflicting_appointment_id: conflicts[0].appointment_id
                    });
                }
            }
        }

        // Update status
        await db.execute(
            `UPDATE appointments
             SET status = ?
             WHERE appointment_id = ?`,
            [newStatus, appointmentId]
        );

        res.status(200).json({
            message: "Appointment status updated successfully",
            appointment_id: Number(appointmentId),
            status: status
        });

    } catch (error) {
        console.error("Update appointment status error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const updateDoctorProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const {
            full_name,
            phone,
            specialization,
            qualification,
            experience_years,
            bio
        } = req.body;

        if (!full_name) {
            return res.status(400).json({
                message: "Full name is required"
            });
        }

        // Check doctor
        const [doctors] = await db.execute(
            `SELECT doctor_id
             FROM doctors
             WHERE user_id = ?`,
            [userId]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctors[0].doctor_id;

        // Update basic user information
        await db.execute(
            `UPDATE users
             SET full_name = ?, phone = ?
             WHERE user_id = ?`,
            [full_name, phone || null, userId]
        );

        // Update doctor information
        await db.execute(
            `UPDATE doctors
             SET specialization = ?,
                 qualification = ?,
                 experience_years = ?,
                 bio = ?
             WHERE doctor_id = ?`,
            [
                specialization || null,
                qualification || null,
                experience_years || null,
                bio || null,
                doctorId
            ]
        );

        res.status(200).json({
            message: "Doctor profile updated successfully"
        });

    } catch (error) {
        console.error("Update doctor profile error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const createDoctorSchedule = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const {
            day_of_week,
            start_time,
            end_time,
            activity_type,
            location,
            notes
        } = req.body;

        if (!day_of_week || !start_time || !end_time || !activity_type) {
            return res.status(400).json({
                message: "Day, start time, end time and activity are required"
            });
        }

        const validDays = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday"
        ];

        if (!validDays.includes(day_of_week)) {
            return res.status(400).json({
                message: "Invalid day of week"
            });
        }

        // Find doctor
        const [doctors] = await db.execute(
            `SELECT doctor_id
             FROM doctors
             WHERE user_id = ?`,
            [userId]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctors[0].doctor_id;

        // Create schedule
        const [result] = await db.execute(
            `INSERT INTO doctor_schedule
             (doctor_id, day_of_week, start_time, end_time,
              activity_type, location, notes, available)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [
                doctorId,
                day_of_week,
                start_time,
                end_time,
                activity_type,
                location || null,
                notes || null
            ]
        );

        res.status(201).json({
            message: "Doctor schedule created successfully",
            schedule_id: result.insertId
        });

    } catch (error) {
        console.error("Create schedule error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const deleteDoctorSchedule = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const scheduleId = req.params.scheduleId;

        // Find doctor
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctorId = doctor.doctor_id;

        // Check that schedule exists and belongs to this doctor
        const [schedules] = await db.execute(
            `SELECT schedule_id, doctor_id
             FROM doctor_schedule
             WHERE schedule_id = ?`,
            [scheduleId]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        if (schedules[0].doctor_id !== doctorId) {
            return res.status(403).json({
                message: "You do not have access to this schedule"
            });
        }

        // Delete schedule
        await db.execute(
            `DELETE FROM doctor_schedule
             WHERE schedule_id = ?`,
            [scheduleId]
        );

        res.status(200).json({
            message: "Schedule deleted successfully",
            schedule_id: Number(scheduleId)
        });

    } catch (error) {
        console.error("Delete schedule error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
const generatePrescriptionPDF = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const prescriptionId = req.params.prescriptionId;

        // Get doctor details
        const [doctors] = await db.execute(
            `SELECT
                d.doctor_id,
                u.full_name,
                u.email,
                u.phone,
                d.specialization,
                d.qualification,
                d.license_number
             FROM doctors d
             JOIN users u ON d.user_id = u.user_id
             WHERE d.user_id = ?`,
            [userId]
        );

        if (doctors.length === 0) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const doctor = doctors[0];

        // Verify prescription authorization
        const check = await verifyPrescriptionAccess(doctor.doctor_id, prescriptionId);
        if (check.status === "NOT_FOUND") {
            return res.status(404).json({
                message: "Prescription not found"
            });
        }
        if (check.status === "FORBIDDEN") {
            return res.status(403).json({
                message: "You do not have access to this prescription"
            });
        }

        // Get prescription and patient details
        const [prescriptions] = await db.execute(
            `SELECT
                p.prescription_id,
                p.patient_id,
                p.diagnosis,
                p.notes,
                p.prescription_date,
                u.full_name AS patient_name,
                pt.gender,
                pt.blood_group,
                pt.allergies
             FROM prescriptions p
             JOIN patients pt
                ON p.patient_id = pt.patient_id
             JOIN users u
                ON pt.user_id = u.user_id
             WHERE p.prescription_id = ?
             AND p.doctor_id = ?`,
            [prescriptionId, doctor.doctor_id]
        );

        const prescription = prescriptions[0];

        // Get medicines
        const [medicines] = await db.execute(
            `SELECT
                medicine_name,
                dosage,
                frequency,
                duration,
                instructions
             FROM prescription_medicines
             WHERE prescription_id = ?`,
            [prescriptionId]
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename=prescription-${prescriptionId}.pdf`
        );

        generatePrescriptionPdfStream({
            prescription,
            doctor,
            patient: {
                full_name: prescription.patient_name,
                patient_id: prescription.patient_id,
                gender: prescription.gender,
                blood_group: prescription.blood_group,
                allergies: prescription.allergies
            },
            medicines,
            outputStream: res
        });

    } catch (error) {
        console.error(
            "Generate prescription PDF error:",
            error
        );

        if (!res.headersSent) {
            res.status(500).json({
                message: "Server error"
            });
        }
    }
};
const createFollowup = async (req, res) => {
    return res.status(501).json({
        message: "Follow-up service is not implemented"
    });
};

const getDoctorFollowups = async (req, res) => {
    return res.status(501).json({
        message: "Follow-up service is not implemented"
    });
};

const getDoctorReport = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const reportId = req.params.reportId;

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        const check = await verifyReportAccess(doctor.doctor_id, reportId);
        if (check.status === "NOT_FOUND") {
            return res.status(404).json({
                message: "Medical report not found"
            });
        }
        if (check.status === "FORBIDDEN") {
            return res.status(403).json({
                message: "You do not have access to this medical report"
            });
        }

        const report = check.report;
        if (!report.file_path) {
            return res.status(404).json({
                message: "No report file attached"
            });
        }

        const reportsBaseDir = path.resolve(__dirname, "../../uploads/reports");
        const resolvedFilePath = path.resolve(__dirname, "../../", report.file_path);

        // Path traversal protection: ensure resolved path is strictly within reportsBaseDir
        const rel = path.relative(reportsBaseDir, resolvedFilePath);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
            return res.status(403).json({
                message: "Access denied: Invalid file path"
            });
        }

        if (!fs.existsSync(resolvedFilePath)) {
            return res.status(404).json({
                message: "Report file not found on server"
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${path.basename(resolvedFilePath)}"`
        );
        res.setHeader("X-Content-Type-Options", "nosniff");

        const stream = fs.createReadStream(resolvedFilePath);
        stream.pipe(res);

    } catch (error) {
        console.error("Get doctor report error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Server error"
            });
        }
    }
};

/**
 * Phase 3 — CDS Gateway Integration: Evaluates clinical query for an authorized patient.
 * Enforces server-side doctor-patient relationship authorization (Phase 1 BOLA protection),
 * retrieves and sanitizes patient clinical dossier (Zero PII), and invokes FastAPI /cds/evaluate.
 */
const evaluateDoctorCDS = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { patient_id, clinical_query, query, candidate_medications, language } = req.body || {};

        const actualQuery = (clinical_query || query || "").trim();
        if (!actualQuery) {
            return res.status(400).json({
                message: "clinical_query is required"
            });
        }

        if (!patient_id) {
            return res.status(400).json({
                message: "patient_id is required"
            });
        }

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({
                message: "Doctor not found"
            });
        }

        // Enforce Phase 1 BOLA authorization check
        const authorized = await isDoctorAuthorizedForPatient(doctor.doctor_id, patient_id);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have access to this patient"
            });
        }

        // Fetch patient EHR data from database
        const [patient] = await db.execute(
            `SELECT p.patient_id, p.date_of_birth, p.gender, p.blood_group, p.allergies
             FROM patients p
             WHERE p.patient_id = ?`,
            [patient_id]
        );

        if (patient.length === 0) {
            return res.status(404).json({
                message: "Patient record not found"
            });
        }

        const [medicalHistory] = await db.execute(
            `SELECT condition_name, diagnosis, diagnosed_date, notes
             FROM medical_history
             WHERE patient_id = ?
             ORDER BY diagnosed_date DESC`,
            [patient_id]
        );

        const [symptoms] = await db.execute(
            `SELECT symptoms, severity, description, reported_date
             FROM symptoms
             WHERE patient_id = ?
             ORDER BY reported_date DESC`,
            [patient_id]
        );

        const [reports] = await db.execute(
            `SELECT report_type, report_name, report_date, report_summary
             FROM medical_reports
             WHERE patient_id = ?
             ORDER BY report_date DESC`,
            [patient_id]
        );

        const [prescriptions] = await db.execute(
            `SELECT pr.diagnosis, pr.prescription_date, pm.medicine_name, pm.dosage, pm.frequency, pm.duration, pm.instructions
             FROM prescriptions pr
             LEFT JOIN prescription_medicines pm ON pr.prescription_id = pm.prescription_id
             WHERE pr.patient_id = ?
             ORDER BY pr.prescription_date DESC`,
            [patient_id]
        );

        const [discharges] = await db.execute(
            `SELECT discharge_id, discharge_date, diagnosis, discharge_summary,
                    discharge_instructions, follow_up_instructions, follow_up_date, warning_signs, status
             FROM discharges
             WHERE patient_id = ?
             ORDER BY discharge_date DESC, discharge_id DESC
             LIMIT 1`,
            [patient_id]
        );

        const rawData = {
            patient: patient[0],
            medical_history: medicalHistory,
            symptoms: symptoms,
            medical_reports: reports,
            prescriptions: prescriptions,
            discharge: discharges.length > 0 ? discharges[0] : null
        };

        // Sanitize patient context (Zero PII transmitted)
        const sanitizedContext = sanitizePatientContext(rawData);

        // Forward to FastAPI CDS Gateway
        const cdsResponse = await forwardToFastAPICDS({
            clinical_query: actualQuery,
            mode: "doctor",
            patient_context: sanitizedContext,
            candidate_medications: Array.isArray(candidate_medications) ? candidate_medications : [],
            language: language || "auto",
            conversation_history: Array.isArray(req.body.conversation_history) ? req.body.conversation_history.slice(-6) : []
        });

        return res.status(200).json(cdsResponse);
    } catch (error) {
        console.error("Doctor CDS Evaluation error:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            message: error.message || "Failed to evaluate clinical decision support"
        });
    }
};

/**
 * POST /api/doctor/prescriptions/screen
 * High-performance deterministic drug-drug and allergy screening (<20ms).
 * Strictly decoupled from slower generative RAG explanation pipeline.
 */
const screenPrescriptionSafety = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { patient_id, candidate_medications } = req.body;

        if (!candidate_medications || !Array.isArray(candidate_medications) || candidate_medications.length === 0) {
            return res.status(400).json({
                message: "candidate_medications array is required"
            });
        }

        let allergies = [];
        let activeConditions = [];
        let allMedicationsToScreen = [...candidate_medications];

        if (patient_id) {
            const doctor = await getDoctorByUserId(userId);
            if (!doctor) {
                return res.status(404).json({ message: "Doctor not found" });
            }

            const authorized = await isDoctorAuthorizedForPatient(doctor.doctor_id, patient_id);
            if (!authorized) {
                return res.status(403).json({ message: "You do not have access to this patient" });
            }

            // Fetch patient allergies
            const [patientRows] = await db.execute(
                `SELECT allergies FROM patients WHERE patient_id = ?`,
                [patient_id]
            );
            if (patientRows.length > 0 && patientRows[0].allergies) {
                allergies = patientRows[0].allergies
                    .split(",")
                    .map(a => a.trim())
                    .filter(a => a && a.toLowerCase() !== "none" && a.toLowerCase() !== "nil");
            }

            // Fetch patient active medical conditions
            const [historyRows] = await db.execute(
                `SELECT condition_name FROM medical_history WHERE patient_id = ?`,
                [patient_id]
            );
            activeConditions = historyRows.map(h => h.condition_name).filter(Boolean);

            // Fetch active prescriptions to screen candidates against existing medications
            const [activeRxRows] = await db.execute(
                `SELECT pm.medicine_name, MAX(pr.prescription_date) AS max_date
                 FROM prescriptions pr
                 JOIN prescription_medicines pm ON pr.prescription_id = pm.prescription_id
                 WHERE pr.patient_id = ?
                 GROUP BY pm.medicine_name
                 ORDER BY max_date DESC LIMIT 20`,
                [patient_id]
            );
            for (const rx of activeRxRows) {
                if (rx.medicine_name && !allMedicationsToScreen.includes(rx.medicine_name)) {
                    allMedicationsToScreen.push(rx.medicine_name);
                }
            }
        }

        const activeMedsList = patient_id
            ? allMedicationsToScreen.filter(m => !candidate_medications.includes(m))
            : [];

        // Call fast deterministic screening endpoint
        const screenResponse = await forwardToFastAPIPrescriptionScreen({
            allergies,
            active_conditions: activeConditions,
            candidate_medications: candidate_medications,
            active_medications: activeMedsList
        });

        // Shape response to supply both detailed screening contract and backward-compatible safety_findings
        const safetyFindings = [
            ...(screenResponse.interactions || []).map(i => ({
                drugs: i.drug_pair,
                severity: i.severity,
                description: i.explanation,
                clinical_consequence: i.clinical_action,
                rule_id: i.rule_id
            })),
            ...(screenResponse.contraindications || []).map(c => ({
                drugs: [],
                severity: "critical",
                description: c,
                clinical_consequence: "Immediate clinician review required due to documented allergy",
                rule_id: "ALLERGY_RULE"
            })),
            ...(screenResponse.duplicate_ingredients || []).map(d => ({
                drugs: d.source_medications,
                severity: d.severity,
                description: d.finding,
                clinical_consequence: d.clinical_action,
                rule_id: "DUPLICATE_INGREDIENT_RULE"
            }))
        ];

        return res.status(200).json({
            screen_status: screenResponse.screen_status,
            rule_coverage: screenResponse.rule_coverage || "FULL",
            interactions: screenResponse.interactions || [],
            contraindications: screenResponse.contraindications || [],
            duplicate_ingredients: screenResponse.duplicate_ingredients || [],
            candidate_alternatives: screenResponse.candidate_alternatives || [],
            evaluated_drugs: screenResponse.evaluated_drugs || [],
            unindexed_drugs: screenResponse.unindexed_drugs || [],
            recommendations: screenResponse.recommendations || [],
            candidate_medications: candidate_medications,
            existing_active_medications: activeMedsList,
            clinical_disclaimer: screenResponse.clinical_disclaimer || "Deterministic screening reflects verified DailyMed SPL rules in local CDSS database.",
            safety_findings: safetyFindings
        });
    } catch (error) {
        console.error("Prescription screening error:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            message: error.message || "Failed to screen prescription safety"
        });
    }
};

/**
 * POST /api/doctor/discharge
 * Creates or updates a clinical discharge record for an authorized patient.
 */
const createOrUpdateDischarge = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }
        const doctorId = doctor.doctor_id;

        const {
            discharge_id,
            patient_id,
            admission_date,
            discharge_date,
            diagnosis,
            discharge_summary,
            discharge_instructions,
            follow_up_instructions,
            follow_up_date,
            warning_signs,
            status
        } = req.body;

        if (!patient_id || !discharge_date || !discharge_instructions || !warning_signs) {
            return res.status(400).json({
                message: "patient_id, discharge_date, discharge_instructions, and warning_signs are required"
            });
        }

        // Verify doctor authorization for this patient
        const authorized = await isDoctorAuthorizedForPatient(doctorId, patient_id);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have clinical authorization to manage discharge records for this patient"
            });
        }

        if (discharge_id) {
            // Update existing discharge
            await db.execute(
                `UPDATE discharges
                 SET admission_date = ?, discharge_date = ?, diagnosis = ?, discharge_summary = ?,
                     discharge_instructions = ?, follow_up_instructions = ?, follow_up_date = ?,
                     warning_signs = ?, status = ?
                 WHERE discharge_id = ? AND patient_id = ? AND doctor_id = ?`,
                [
                    admission_date || null,
                    discharge_date,
                    diagnosis || null,
                    discharge_summary || null,
                    discharge_instructions,
                    follow_up_instructions || null,
                    follow_up_date || null,
                    warning_signs,
                    status || "discharged",
                    discharge_id,
                    patient_id,
                    doctorId
                ]
            );

            return res.status(200).json({
                message: "Discharge record updated successfully",
                discharge_id: discharge_id
            });
        } else {
            // Insert new discharge
            const [result] = await db.execute(
                `INSERT INTO discharges (
                    patient_id, doctor_id, admission_date, discharge_date, diagnosis,
                    discharge_summary, discharge_instructions, follow_up_instructions,
                    follow_up_date, warning_signs, status
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    patient_id,
                    doctorId,
                    admission_date || null,
                    discharge_date,
                    diagnosis || null,
                    discharge_summary || null,
                    discharge_instructions,
                    follow_up_instructions || null,
                    follow_up_date || null,
                    warning_signs,
                    status || "discharged"
                ]
            );

            return res.status(201).json({
                message: "Discharge record created successfully",
                discharge_id: result.insertId
            });
        }
    } catch (error) {
        console.error("Discharge creation error:", error);
        return res.status(500).json({ message: "Server error managing discharge record" });
    }
};

/**
 * GET /api/doctor/patients/:patientId/discharge
 * Retrieves discharge record for an authorized patient.
 */
const getDoctorPatientDischarge = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const patientId = req.params.patientId;

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }
        const doctorId = doctor.doctor_id;

        const authorized = await isDoctorAuthorizedForPatient(doctorId, patientId);
        if (!authorized) {
            return res.status(403).json({
                message: "You do not have clinical authorization to view discharge records for this patient"
            });
        }

        const [discharges] = await db.execute(
            `SELECT d.*, u.full_name AS doctor_name, doc.specialization
             FROM discharges d
             JOIN doctors doc ON d.doctor_id = doc.doctor_id
             JOIN users u ON doc.user_id = u.user_id
             WHERE d.patient_id = ?
             ORDER BY d.discharge_date DESC
             LIMIT 1`,
            [patientId]
        );

        if (discharges.length === 0) {
            return res.status(200).json({
                discharge: null,
                message: "No discharge record found for this patient"
            });
        }

        return res.status(200).json({
            discharge: discharges[0]
        });
    } catch (error) {
        console.error("Doctor get discharge error:", error);
        return res.status(500).json({ message: "Server error retrieving discharge record" });
    }
};

/**
 * POST /api/doctor/prescriptions/upload-ocr
 * Uploads prescription image, validates format/magic bytes, executes local OCR,
 * extracts candidate fields, and records pending job for clinician review.
 */
const uploadAndProcessPrescriptionOcr = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }
        const doctorId = doctor.doctor_id;

        const patientId = req.body.patient_id;
        if (!patientId) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "patient_id is required" });
        }

        // Verify doctor authorization for target patient
        const authorized = await isDoctorAuthorizedForPatient(doctorId, patientId);
        if (!authorized) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(403).json({
                message: "You do not have clinical authorization for this patient"
            });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Prescription image file is required" });
        }

        // Validate magic bytes
        const fileBuffer = fs.readFileSync(req.file.path);
        const isValidSignature = validateMagicBytes(fileBuffer, req.file.mimetype);
        if (!isValidSignature) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: "Invalid file signature or corrupted image format. Please upload a valid PNG, JPEG, or WEBP image."
            });
        }

        // Execute local OCR with automatic orientation detection and deskewing
        const { raw_text, ocr_confidence, detected_orientation, orientation_corrected } = await performOcr(req.file.path);

        // Extract candidate fields
        const candidateFields = extractCandidateFields(raw_text);

        // Insert job record in pending_review state
        const [result] = await db.execute(
            `INSERT INTO prescription_ocr_jobs (
                patient_id, doctor_id, file_path, original_filename,
                mime_type, file_size_bytes, raw_extracted_text, candidate_fields,
                review_status, confidence_score
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)`,
            [
                patientId,
                doctorId,
                req.file.path,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                raw_text,
                JSON.stringify(candidateFields),
                ocr_confidence
            ]
        );

        const responsePayload = {
            message: "Prescription image uploaded and OCR processed successfully. Human review required before confirmation.",
            job_id: result.insertId,
            review_status: "pending_review",
            raw_extracted_text: raw_text,
            raw_ocr_text: raw_text,
            candidate_fields: candidateFields,
            parsed_medicines: candidateFields,
            confidence_score: ocr_confidence,
            detected_orientation: detected_orientation || 0,
            orientation_corrected: orientation_corrected || false,
            requires_human_confirmation: true,
            job: {
                job_id: result.insertId,
                patient_id: patientId,
                doctor_id: doctorId,
                review_status: "pending_review",
                raw_extracted_text: raw_text,
                raw_ocr_text: raw_text,
                candidate_fields: candidateFields,
                parsed_medicines: candidateFields,
                confidence_score: ocr_confidence
            }
        };

        return res.status(201).json(responsePayload);

    } catch (err) {
        console.error("Prescription OCR upload error:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        return res.status(500).json({
            message: "Failed to process prescription image OCR: " + err.message
        });
    }
};

/**
 * GET /api/doctor/prescriptions/ocr-jobs/:jobId
 * Retrieves OCR extraction job for clinician review.
 */
const getPrescriptionOcrJob = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const jobId = req.params.jobId;

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }
        const doctorId = doctor.doctor_id;

        const [jobs] = await db.execute(
            `SELECT * FROM prescription_ocr_jobs WHERE job_id = ?`,
            [jobId]
        );

        if (jobs.length === 0) {
            return res.status(404).json({ message: "Prescription OCR job not found" });
        }

        const job = jobs[0];
        const authorized = await isDoctorAuthorizedForPatient(doctorId, job.patient_id);
        if (!authorized) {
            return res.status(403).json({ message: "You are not authorized to view this OCR job" });
        }

        return res.status(200).json({ job });
    } catch (err) {
        console.error("Get OCR job error:", err);
        return res.status(500).json({ message: "Server error retrieving OCR job" });
    }
};

/**
 * POST /api/doctor/prescriptions/confirm-ocr
 * Explicitly confirms OCR candidates after clinician review and creates authoritative prescription.
 */
const confirmPrescriptionOcrJob = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const {
            job_id,
            diagnosis,
            notes,
            confirmed_medicines,
            medicines,
            safety_override,
            safety_override_reason
        } = req.body;

        const medsToConfirm = Array.isArray(confirmed_medicines) && confirmed_medicines.length > 0
            ? confirmed_medicines
            : (Array.isArray(medicines) && medicines.length > 0 ? medicines : null);

        if (!job_id || !medsToConfirm) {
            return res.status(400).json({
                message: "job_id and a non-empty confirmed_medicines array are required"
            });
        }

        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }
        const doctorId = doctor.doctor_id;

        const [jobs] = await db.execute(
            `SELECT * FROM prescription_ocr_jobs WHERE job_id = ?`,
            [job_id]
        );

        if (jobs.length === 0) {
            return res.status(404).json({ message: "OCR job not found" });
        }

        const job = jobs[0];
        if (job.review_status === "confirmed") {
            return res.status(400).json({ message: "This OCR job has already been confirmed" });
        }

        const authorized = await isDoctorAuthorizedForPatient(doctorId, job.patient_id);
        if (!authorized) {
            return res.status(403).json({ message: "You are not authorized to confirm prescriptions for this patient" });
        }

        const idempotencyKey = (req.headers["idempotency-key"] || req.body.idempotency_key || `ocr_job_${job_id}`).toString().trim();

        // Route through the single shared server-side safety gate and atomic persistence engine
        const result = await executePrescriptionSafetyGateAndPersist({
            doctorId,
            patientId: job.patient_id,
            diagnosis: diagnosis || "Prescription via Verified Clinical OCR",
            notes: notes || "Confirmed from prescription image OCR scan",
            medicines: medsToConfirm,
            safetyOverride: safety_override,
            safetyOverrideReason: safety_override_reason,
            idempotencyKey,
            source: "ocr_confirmation",
            ocrJobId: job.job_id
        });

        return res.status(result.status).json(result.data);

    } catch (err) {
        console.error("Confirm OCR prescription error:", err);
        return res.status(500).json({ message: "Server error confirming prescription: " + err.message });
    }
};

module.exports = {
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
    screenPrescriptionSafety,
    createOrUpdateDischarge,
    getDoctorPatientDischarge,
    uploadAndProcessPrescriptionOcr,
    getPrescriptionOcrJob,
    confirmPrescriptionOcrJob,
    executePrescriptionSafetyGateAndPersist,
};