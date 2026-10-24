const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_EXPRESS_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000"
).replace(/\/api\/?$/, "") + "/api";


function getAuthHeaders() {
  const token = localStorage.getItem("cdss_token") || localStorage.getItem("patient_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const patientApi = {
  getProfile: async () => {
    const res = await fetch(`${API_BASE}/patient/profile`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load patient profile");
    return data;
  },

  getDashboard: async () => {
    const res = await fetch(`${API_BASE}/patient/dashboard`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load patient dashboard");
    return data;
  },

  getMedicalHistory: async () => {
    const res = await fetch(`${API_BASE}/patient/medical-history`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load medical history");
    return data;
  },

  getPrescriptions: async () => {
    const res = await fetch(`${API_BASE}/patient/prescriptions`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load prescriptions");
    return data.prescriptions || [];
  },

  getMedications: async () => {
    const res = await fetch(`${API_BASE}/patient/medications`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load active medications");
    return data.medications || [];
  },

  getDischarge: async () => {
    const res = await fetch(`${API_BASE}/patient/discharge`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load discharge care guidelines");
    return data.discharge || null;
  },

  getAppointments: async () => {
    const res = await fetch(`${API_BASE}/patient/appointments`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load patient appointments");
    return data.appointments || [];
  },

  getDoctors: async () => {
    const res = await fetch(`${API_BASE}/patient/doctors`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load doctor directory");
    return data.doctors || [];
  },

  requestAppointment: async ({ doctor_id, appointment_date, appointment_time, reason }) => {
    const res = await fetch(`${API_BASE}/patient/appointments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        doctor_id,
        appointment_date,
        appointment_time,
        reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to submit appointment request");
    return data;
  },

  cancelAppointment: async (appointmentId, reason) => {
    const res = await fetch(`${API_BASE}/patient/appointments/${appointmentId}/cancel`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to cancel appointment");
    return data;
  },

  evaluateCDS: async ({ clinicalQuery, language = "en", conversationHistory = [] }) => {
    const res = await fetch(`${API_BASE}/patient/cds`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        clinical_query: clinicalQuery,
        language,
        conversation_history: conversationHistory,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Post-discharge CDS query failed (${res.status})`);
    return data;
  },

  getPrescriptionPDFUrl: (prescriptionId) => {
    return `${API_BASE}/patient/prescriptions/${prescriptionId}/pdf`;
  },

  downloadPrescriptionPDF: async (prescriptionId) => {
    const res = await fetch(`${API_BASE}/patient/prescriptions/${prescriptionId}/pdf`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to download PDF" }));
      throw new Error(err.message || `Download failed (${res.status})`);
    }
    return await res.blob();
  },
};
