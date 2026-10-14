const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000") + "/api";

function getAuthHeaders() {
  const token = localStorage.getItem("cdss_token") || localStorage.getItem("receptionist_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const receptionistApi = {
  getDoctors: async () => {
    const res = await fetch(`${API_BASE}/receptionist/doctors`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch doctors list");
    return data.doctors || [];
  },

  getPatients: async () => {
    const res = await fetch(`${API_BASE}/receptionist/patients`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch patient roster");
    return data.patients || [];
  },

  registerPatient: async (patientData) => {
    const res = await fetch(`${API_BASE}/receptionist/patients`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(patientData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to register patient");
    return data;
  },

  getAppointments: async () => {
    const res = await fetch(`${API_BASE}/receptionist/appointments`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch appointments");
    return data.appointments || [];
  },

  createAppointment: async (appointmentData) => {
    const res = await fetch(`${API_BASE}/receptionist/appointments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(appointmentData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create appointment");
    return data;
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    const res = await fetch(`${API_BASE}/receptionist/appointments/${appointmentId}/status`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update appointment status");
    return data;
  },
};
