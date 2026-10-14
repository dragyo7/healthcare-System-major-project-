/**
 * cdsBridgeService.js
 * 
 * Internal Service Bridge between Express EHR backend and the FastAPI CDS Gateway.
 * Enforces strict request-scoped patient context sanitization (Zero PII)
 * and forwards clinical inquiries to POST /cds/evaluate.
 */

const CDS_SERVICE_URL = process.env.CDS_SERVICE_URL || "http://127.0.0.1:8000";

/**
 * Derives patient age in whole years from ISO date string.
 * @param {string|Date} dob 
 * @returns {number|null}
 */
const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const diffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(diffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Sanitizes rich EHR patient dossier into a data-minimized clinical context.
 * STRICTLY OMITS PII: name, email, phone, address, emergency_contact, user_id, patient_id.
 * 
 * @param {object} patientData Raw patient dossier from database
 * @returns {object} Sanitized PatientContext object conforming to cds_module/models.py
 */
const sanitizePatientContext = (patientData) => {
    const rawPatient = patientData.patient || {};
    const rawSymptoms = patientData.symptoms || [];
    const rawHistory = patientData.medical_history || [];
    const rawPrescriptions = patientData.prescriptions || [];
    const rawReports = patientData.medical_reports || [];

    // 1. Age & Gender
    const age = calculateAge(rawPatient.date_of_birth);
    const gender = rawPatient.gender || null;

    // 2. Symptoms (strings)
    const symptoms = rawSymptoms.map((s) => {
        if (s.severity && s.symptoms) {
            return `${s.symptoms} (severity: ${s.severity})`;
        }
        return s.symptoms || "";
    }).filter(Boolean);

    // 3. Active diagnoses / Conditions
    const diagnoses = rawHistory.map((h) => {
        if (h.condition_name && h.diagnosis) {
            return `${h.condition_name} - ${h.diagnosis}`;
        }
        return h.condition_name || h.diagnosis || "";
    }).filter(Boolean);

    // 4. Allergies
    let allergies = [];
    if (rawPatient.allergies) {
        allergies = rawPatient.allergies
            .split(",")
            .map((a) => a.trim())
            .filter((a) => a && a.toLowerCase() !== "none" && a.toLowerCase() !== "nil");
    }

    // 5. Active Medications from recent prescriptions
    const activeMedications = [];
    const seenMeds = new Set();
    for (const pr of rawPrescriptions) {
        if (pr.medicine_name && !seenMeds.has(pr.medicine_name.toLowerCase())) {
            seenMeds.add(pr.medicine_name.toLowerCase());
            let medDesc = pr.medicine_name;
            if (pr.dosage) medDesc += ` ${pr.dosage}`;
            if (pr.frequency) medDesc += ` ${pr.frequency}`;
            activeMedications.push(medDesc);
        }
    }

    // 6. Medical history summaries & Discharge context
    const medicalHistory = rawHistory.map((h) => {
        let desc = h.condition_name || "";
        if (h.notes) desc += ` - Note: ${h.notes}`;
        return desc;
    }).filter(Boolean);

    const rawDischarge = patientData.discharge;
    if (rawDischarge) {
        if (rawDischarge.diagnosis && !diagnoses.includes(rawDischarge.diagnosis)) {
            diagnoses.push(`Discharge Diagnosis: ${rawDischarge.diagnosis}`);
        }
        if (rawDischarge.discharge_instructions) {
            medicalHistory.push(`Discharge Care Instructions: ${rawDischarge.discharge_instructions}`);
        }
        if (rawDischarge.warning_signs) {
            medicalHistory.push(`Discharge Warning Signs: ${rawDischarge.warning_signs}`);
        }
    }

    // 7. Lab report summaries
    const labSummaries = rawReports.map((r) => {
        let summary = r.report_name || r.report_type || "Report";
        if (r.report_summary) summary += `: ${r.report_summary}`;
        return summary;
    }).filter(Boolean);

    return {
        age,
        gender,
        symptoms,
        diagnoses,
        allergies,
        active_medications: activeMedications,
        medical_history: medicalHistory,
        lab_summaries: labSummaries
    };
};

/**
 * Forwards clinical query + sanitized patient context to FastAPI CDS Gateway.
 * 
 * @param {object} payload 
 * @param {string} payload.clinical_query
 * @param {string} payload.mode
 * @param {object} payload.patient_context
 * @param {Array<string>} [payload.candidate_medications]
 * @returns {Promise<object>}
 */
const forwardToFastAPICDS = async (payload) => {
    const targetUrl = `${CDS_SERVICE_URL}/cds/evaluate`;

    const requestBody = {
        clinical_query: payload.clinical_query,
        mode: payload.mode || "doctor",
        patient_context: payload.patient_context || null,
        candidate_medications: payload.candidate_medications || [],
        retrieval_mode: "hybrid",
        top_k: 5,
        language: payload.language || "auto"
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for RAG inference (handles CPU model cold-start)

    try {
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorDetail = `FastAPI CDS Gateway responded with HTTP ${response.status}`;
            try {
                const errorJson = await response.json();
                if (errorJson.detail) errorDetail += `: ${JSON.stringify(errorJson.detail)}`;
            } catch (_) {}
            const err = new Error(errorDetail);
            err.statusCode = response.status;
            throw err;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            const timeoutErr = new Error("CDS Gateway request timed out after 60 seconds");
            timeoutErr.statusCode = 504;
            throw timeoutErr;
        }
        throw error;
    }
};

module.exports = {
    calculateAge,
    sanitizePatientContext,
    forwardToFastAPICDS
};
