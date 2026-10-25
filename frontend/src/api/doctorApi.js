import { resilientFetch, getApiBase, getAuthHeaders } from "./client";

export const doctorApi = {
  getProfile: async () => {
    return await resilientFetch("/doctor/profile");
  },

  updateProfile: async (profileData) => {
    return await resilientFetch("/doctor/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  },

  getDashboard: async () => {
    return await resilientFetch("/doctor/dashboard");
  },

  getPatients: async (search = "") => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const data = await resilientFetch(`/doctor/patients${q}`);
    return data.patients || [];
  },

  getPatientDetails: async (patientId) => {
    return await resilientFetch(`/doctor/patients/${patientId}`);
  },

  getPatientPrescriptions: async (patientId) => {
    const data = await resilientFetch(`/doctor/patients/${patientId}/prescriptions`);
    return data.prescriptions || [];
  },

  getPatientDischarge: async (patientId) => {
    const data = await resilientFetch(`/doctor/patients/${patientId}/discharge`);
    return data.discharge || null;
  },

  getAppointments: async () => {
    const data = await resilientFetch("/doctor/appointments");
    return data.appointments || [];
  },

  createAppointment: async (appointmentData) => {
    return await resilientFetch("/doctor/appointments", {
      method: "POST",
      body: JSON.stringify(appointmentData),
    });
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    return await resilientFetch(`/doctor/appointments/${appointmentId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },

  getSchedule: async () => {
    const data = await resilientFetch("/doctor/schedule");
    return data.schedule || [];
  },

  createSchedule: async (scheduleData) => {
    return await resilientFetch("/doctor/schedule", {
      method: "POST",
      body: JSON.stringify(scheduleData),
    });
  },

  deleteSchedule: async (scheduleId) => {
    return await resilientFetch(`/doctor/schedule/${scheduleId}`, {
      method: "DELETE",
    });
  },

  createPrescription: async (prescriptionData, idempotencyKey = null) => {
    const key = idempotencyKey || prescriptionData?.idempotency_key;
    const headers = {};
    if (key) {
      headers["Idempotency-Key"] = key;
    }
    return await resilientFetch("/doctor/prescriptions", {
      method: "POST",
      headers,
      body: JSON.stringify(prescriptionData),
    });
  },

  createDischarge: async (dischargeData) => {
    return await resilientFetch("/doctor/discharge", {
      method: "POST",
      body: JSON.stringify(dischargeData),
    });
  },

  evaluateCDS: async ({ patientId, clinicalQuery, candidateMedications = [], language = "auto", conversationHistory = [] }) => {
    return await resilientFetch("/doctor/cds", {
      method: "POST",
      timeoutMs: 90000,
      body: JSON.stringify({
        patient_id: patientId,
        clinical_query: clinicalQuery,
        candidate_medications: candidateMedications,
        language,
        conversation_history: conversationHistory,
      }),
    });
  },

  screenPrescription: async ({ patientId, candidateMedications = [] }) => {
    return await resilientFetch("/doctor/prescriptions/screen", {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        candidate_medications: candidateMedications,
      }),
    });
  },

  uploadPrescriptionOcr: async (formData) => {
    const token = localStorage.getItem("cdss_token") || localStorage.getItem("token");
    const targetUrl = `${getApiBase()}/doctor/prescriptions/upload-ocr`;
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Prescription OCR upload failed");
    return data;
  },

  getPrescriptionOcrJob: async (jobId) => {
    return await resilientFetch(`/doctor/prescriptions/ocr-jobs/${jobId}`);
  },

  confirmPrescriptionOcr: async (jobId, confirmedData) => {
    return await resilientFetch("/doctor/prescriptions/confirm-ocr", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, ...confirmedData }),
    });
  },

  downloadPrescriptionPDF: async (prescriptionId) => {
    const url = `${getApiBase()}/doctor/prescriptions/${prescriptionId}/pdf`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to download PDF" }));
      throw new Error(err.message || `Download failed (${res.status})`);
    }
    return await res.blob();
  },
};
