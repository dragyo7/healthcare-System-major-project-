const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000") + "/api";

export const authApi = {
  loginDoctor: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/doctor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Doctor login failed");
    return { token: data.token, user: { ...data.doctor, role: "doctor", name: data.doctor?.name || "Dr. Bhumi Sharma" } };
  },

  loginPatient: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/patient/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Patient login failed");
    return { token: data.token, user: { ...data.patient, role: "patient", name: data.patient?.full_name || "Aarav Patil" } };
  },

  loginReceptionist: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/receptionist/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Receptionist login failed");
    return { token: data.token, user: { ...data.user, role: "receptionist", name: data.user?.name || "Pooja Verma" } };
  },

  activatePatient: async (token, password) => {
    const res = await fetch(`${API_BASE}/auth/patient/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Account activation failed");
    return data;
  },

  signupPatient: async (patientData) => {
    const res = await fetch(`${API_BASE}/auth/patient/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patientData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Patient registration failed");
    return data;
  },
};
