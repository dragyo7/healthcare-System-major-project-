const API_BASE = "http://localhost:5000/api";

export const getAuthToken = () => localStorage.getItem("patient_token");
export const setAuthToken = (token) => localStorage.setItem("patient_token", token);
export const removeAuthToken = () => localStorage.removeItem("patient_token");

export const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }
  return data;
};

export const patientApi = {
  login: (email, password) => 
    apiFetch("/auth/patient/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  signup: (patientData) =>
    apiFetch("/auth/patient/signup", {
      method: "POST",
      body: JSON.stringify(patientData)
    }),
  getProfile: () => apiFetch("/patient/profile"),
  getDashboard: () => apiFetch("/patient/dashboard"),
  getMedicalHistory: () => apiFetch("/patient/medical-history"),
  getPrescriptions: () => apiFetch("/patient/prescriptions"),
  getMedications: () => apiFetch("/patient/medications"),
  getDischarge: () => apiFetch("/patient/discharge"),
  getAppointments: () => apiFetch("/patient/appointments"),
  evaluateCDS: (clinical_query, language = "en") =>
    apiFetch("/patient/cds", {
      method: "POST",
      body: JSON.stringify({ clinical_query, language })
    })
};
