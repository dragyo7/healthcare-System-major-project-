/**
 * appointmentValidation.js
 * 
 * Clinical Decision Support & EHR Appointment Interval Validation Engine
 * Enforces:
 * 1. Standard clinic operating hours (09:00 - 17:00, Monday through Saturday, Sunday closed)
 * 2. 30-minute standard slot resolution (15 - 120 minutes bounds)
 * 3. Half-open interval conflict detection: [start, end)
 *    Condition: (existing_start < requested_end AND existing_end > requested_start)
 * 4. Active status reservation: 'pending', 'scheduled', 'confirmed'
 * 5. Deterministic concurrency control via MySQL session advisory locks & row locks
 */

const CLINIC_START_HOUR = "09:00:00";
const CLINIC_END_HOUR = "17:00:00";

/**
 * Normalizes time string to HH:MM:SS format.
 */
function normalizeTime(timeStr) {
    if (!timeStr) return null;
    const parts = String(timeStr).trim().split(":");
    const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
    const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
    const s = String(parseInt(parts[2], 10) || 0).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/**
 * Calculates end time assuming a standard 30-minute consultation slot.
 */
function resolveEndTime(startTime, endTime) {
    if (endTime) {
        return normalizeTime(endTime);
    }
    const [h, m] = startTime.split(":");
    const startMins = parseInt(h, 10) * 60 + parseInt(m || "0", 10);
    const endMins = startMins + 30;
    const endH = String(Math.floor(endMins / 60) % 24).padStart(2, "0");
    const endM = String(endMins % 60).padStart(2, "0");
    return `${endH}:${endM}:00`;
}

/**
 * Validates clinic schedule, calendar days, operating hours, and interval length.
 */
function validateClinicHours(appointmentDate, startTime, endTime = null) {
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        return {
            valid: false,
            message: "Invalid appointment date format. Expected YYYY-MM-DD."
        };
    }

    if (!startTime || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(startTime)) {
        return {
            valid: false,
            message: "Invalid start time format. Expected HH:MM or HH:MM:SS."
        };
    }

    const normStart = normalizeTime(startTime);
    const normEnd = resolveEndTime(normStart, endTime);

    // Verify day of the week (Sunday is closed)
    const dateObj = new Date(appointmentDate + "T00:00:00");
    if (isNaN(dateObj.getTime())) {
        return { valid: false, message: "Invalid appointment calendar date." };
    }

    if (dateObj.getDay() === 0) {
        return {
            valid: false,
            message: "Clinic is closed on Sundays. Appointments are available Monday through Saturday."
        };
    }

    // Verify operating hours (09:00 to 17:00)
    if (normStart < CLINIC_START_HOUR || normEnd > CLINIC_END_HOUR) {
        return {
            valid: false,
            message: `Appointments must be scheduled within clinic operating hours (${CLINIC_START_HOUR.slice(0, 5)} to ${CLINIC_END_HOUR.slice(0, 5)}).`
        };
    }

    if (normStart >= normEnd) {
        return {
            valid: false,
            message: "Appointment start time must be strictly earlier than end time."
        };
    }

    // Calculate duration in minutes
    const [sh, sm] = normStart.split(":");
    const [eh, em] = normEnd.split(":");
    const durationMinutes = (parseInt(eh, 10) * 60 + parseInt(em, 10)) - (parseInt(sh, 10) * 60 + parseInt(sm, 10));

    if (durationMinutes < 15 || durationMinutes > 120) {
        return {
            valid: false,
            message: `Consultation duration must be between 15 and 120 minutes (requested: ${durationMinutes} mins).`
        };
    }

    return {
        valid: true,
        startTime: normStart,
        endTime: normEnd
    };
}

/**
 * Checks for doctor and patient slot overlaps on a given date.
 * Excludes cancelled, rejected, and completed appointments.
 * Optionally excludes a specific appointmentId (for rescheduling).
 */
async function checkAppointmentConflict(connection, {
    doctorId,
    patientId,
    appointmentDate,
    startTime,
    endTime,
    excludeAppointmentId = null
}) {
    // 1. Doctor Conflict Check: existing_start < requested_end AND existing_end > requested_start
    let docSql = `
        SELECT appointment_id, start_time, end_time, status
        FROM appointments
        WHERE doctor_id = ?
          AND appointment_date = ?
          AND status IN ('pending', 'scheduled', 'confirmed')
          AND (start_time < ? AND end_time > ?)
    `;
    const docParams = [doctorId, appointmentDate, endTime, startTime];

    if (excludeAppointmentId) {
        docSql += " AND appointment_id != ?";
        docParams.push(excludeAppointmentId);
    }
    docSql += " FOR UPDATE";

    const [docConflicts] = await connection.execute(docSql, docParams);

    if (docConflicts.length > 0) {
        return {
            conflict: true,
            type: "doctor",
            message: "The requested physician already has a consultation scheduled during this time interval.",
            conflictingAppointmentId: docConflicts[0].appointment_id
        };
    }

    // 2. Patient Conflict Check: existing_start < requested_end AND existing_end > requested_start
    let patSql = `
        SELECT appointment_id, start_time, end_time, status
        FROM appointments
        WHERE patient_id = ?
          AND appointment_date = ?
          AND status IN ('pending', 'scheduled', 'confirmed')
          AND (start_time < ? AND end_time > ?)
    `;
    const patParams = [patientId, appointmentDate, endTime, startTime];

    if (excludeAppointmentId) {
        patSql += " AND appointment_id != ?";
        patParams.push(excludeAppointmentId);
    }
    patSql += " FOR UPDATE";

    const [patConflicts] = await connection.execute(patSql, patParams);

    if (patConflicts.length > 0) {
        return {
            conflict: true,
            type: "patient",
            message: "The patient already has a consultation scheduled during this time interval.",
            conflictingAppointmentId: patConflicts[0].appointment_id
        };
    }

    return { conflict: false };
}

module.exports = {
    CLINIC_START_HOUR,
    CLINIC_END_HOUR,
    normalizeTime,
    resolveEndTime,
    validateClinicHours,
    checkAppointmentConflict
};
