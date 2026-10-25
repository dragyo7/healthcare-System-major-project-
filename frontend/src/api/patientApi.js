import { resilientFetch, getApiBase, getAuthHeaders } from "./client";

export const patientApi = {
  getProfile: async () => {
    return await resilientFetch("/patient/profile");
  },

  getDashboard: async () => {
    return await resilientFetch("/patient/dashboard");
  },

  getMedicalHistory: async () => {
    return await resilientFetch("/patient/medical-history");
  },

  getPrescriptions: async () => {
    const data = await resilientFetch("/patient/prescriptions");
    return data.prescriptions || [];
  },

  getMedications: async () => {
    const data = await resilientFetch("/patient/medications");
    return data.medications || [];
  },

  getDischarge: async () => {
    const data = await resilientFetch("/patient/discharge");
    return data.discharge || null;
  },

  getAppointments: async () => {
    const data = await resilientFetch("/patient/appointments");
    return data.appointments || [];
  },

  getDoctors: async () => {
    const data = await resilientFetch("/patient/doctors");
    return data.doctors || [];
  },

  requestAppointment: async ({ doctor_id, appointment_date, appointment_time, reason }) => {
    return await resilientFetch("/patient/appointments", {
      method: "POST",
      body: JSON.stringify({
        doctor_id,
        appointment_date,
        appointment_time,
        reason,
      }),
    });
  },

  cancelAppointment: async (appointmentId, reason) => {
    return await resilientFetch(`/patient/appointments/${appointmentId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
  },

  evaluateCDS: async ({ clinicalQuery, language = "en", conversationHistory = [] }) => {
    return await resilientFetch("/patient/cds", {
      method: "POST",
      timeoutMs: 90000,
      body: JSON.stringify({
        clinical_query: clinicalQuery,
        language,
        conversation_history: conversationHistory,
      }),
    });
  },

  getPrescriptionPDFUrl: (prescriptionId) => {
    return `${getApiBase()}/patient/prescriptions/${prescriptionId}/pdf`;
  },

  downloadPrescriptionPDF: async (prescriptionId) => {
    const url = `${getApiBase()}/patient/prescriptions/${prescriptionId}/pdf`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to download PDF" }));
      throw new Error(err.message || `Download failed (${res.status})`);
    }
    return await res.blob();
  },
};
