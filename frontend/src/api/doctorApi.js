const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000") + "/api";

function getAuthHeaders() {
  const token = localStorage.getItem("cdss_token") || localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const doctorApi = {
  getProfile: async () => {
    const res = await fetch(`${API_BASE}/doctor/profile`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load doctor profile");
    return data;
  },

  updateProfile: async (profileData) => {
    const res = await fetch(`${API_BASE}/doctor/profile`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update profile");
    return data;
  },

  getDashboard: async () => {
    const res = await fetch(`${API_BASE}/doctor/dashboard`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load dashboard metrics");
    return data;
  },

  getPatients: async () => {
    const res = await fetch(`${API_BASE}/doctor/patients`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch patients list");
    return data.patients || [];
  },

  getPatientDetails: async (patientId) => {
    const res = await fetch(`${API_BASE}/doctor/patients/${patientId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to fetch patient #${patientId}`);
    return data;
  },

  getPatientPrescriptions: async (patientId) => {
    const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/prescriptions`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch prescriptions");
    return data.prescriptions || [];
  },

  getPatientDischarge: async (patientId) => {
    const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/discharge`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch discharge records");
    return data.discharge || null;
  },

  getAppointments: async () => {
    const res = await fetch(`${API_BASE}/doctor/appointments`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch doctor appointments");
    return data.appointments || [];
  },

  createAppointment: async (appointmentData) => {
    const res = await fetch(`${API_BASE}/doctor/appointments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(appointmentData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to schedule appointment");
    return data;
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    const res = await fetch(`${API_BASE}/doctor/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update appointment status");
    return data;
  },

  getSchedule: async () => {
    const res = await fetch(`${API_BASE}/doctor/schedule`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch doctor schedule");
    return data.schedule || [];
  },

  createSchedule: async (scheduleData) => {
    const res = await fetch(`${API_BASE}/doctor/schedule`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(scheduleData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create schedule");
    return data;
  },

  deleteSchedule: async (scheduleId) => {
    const res = await fetch(`${API_BASE}/doctor/schedule/${scheduleId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to delete schedule item");
    return data;
  },

  createPrescription: async (prescriptionData) => {
    const res = await fetch(`${API_BASE}/doctor/prescriptions`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(prescriptionData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save prescription");
    return data;
  },

  createDischarge: async (dischargeData) => {
    const res = await fetch(`${API_BASE}/doctor/discharge`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(dischargeData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to record discharge care");
    return data;
  },

  getPatientDischarge: async (patientId) => {
    const res = await fetch(`${API_BASE}/doctor/patients/${patientId}/discharge`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch patient discharge records");
    return data;
  },

  evaluateCDS: async ({ patientId, clinicalQuery, candidateMedications = [], language = "auto" }) => {
    const res = await fetch(`${API_BASE}/doctor/cds`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        patient_id: patientId,
        clinical_query: clinicalQuery,
        candidate_medications: candidateMedications,
        language,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `CDS evaluation failed (${res.status})`);
    return data;
  },

  uploadPrescriptionOcr: async (formData) => {
    const token = localStorage.getItem("cdss_token") || localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/doctor/prescriptions/upload-ocr`, {
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
    const res = await fetch(`${API_BASE}/doctor/prescriptions/ocr-jobs/${jobId}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch OCR job status");
    return data;
  },

  confirmPrescriptionOcr: async (jobId, confirmedData) => {
    const res = await fetch(`${API_BASE}/doctor/prescriptions/confirm-ocr`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ job_id: jobId, ...confirmedData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to finalize OCR prescription");
    return data;
  },
};
