const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_EXPRESS_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000"
).replace(/\/api\/?$/, "") + "/api";

export const authApi = {
  loginDoctor: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/doctor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Doctor login failed");
    return {
      token: data.token,
      user: {
        ...data.doctor,
        role: "doctor",
        name: data.doctor?.name || data.doctor?.full_name || data.user?.name || data.user?.full_name,
      },
    };
  },

  loginPatient: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/patient/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Patient login failed");
    return {
      token: data.token,
      user: {
        ...data.patient,
        role: "patient",
        name: data.patient?.name || data.patient?.full_name || data.user?.name || data.user?.full_name,
      },
    };
  },

  loginReceptionist: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/receptionist/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Receptionist login failed");
    const recData = data.receptionist || data.user || {};
    return {
      token: data.token,
      user: {
        ...recData,
        role: "receptionist",
        name: recData.name || recData.full_name,
      },
    };
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

  signupDoctor: async (doctorData) => {
    const res = await fetch(`${API_BASE}/auth/doctor/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doctorData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Doctor registration failed");
    return data;
  },

  signupReceptionist: async (receptionistData) => {
    const res = await fetch(`${API_BASE}/auth/receptionist/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receptionistData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Receptionist registration failed");
    return data;
  },
};
