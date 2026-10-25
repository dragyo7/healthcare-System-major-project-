import { resilientFetch } from "./client";

export const authApi = {
  loginDoctor: async (email, password) => {
    const data = await resilientFetch("/auth/doctor/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
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
    const data = await resilientFetch("/auth/patient/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
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
    const data = await resilientFetch("/auth/receptionist/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
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

  signupPatient: async (patientData) => {
    return await resilientFetch("/auth/patient/signup", {
      method: "POST",
      body: JSON.stringify(patientData),
    });
  },

  signupDoctor: async (doctorData) => {
    return await resilientFetch("/auth/doctor/signup", {
      method: "POST",
      body: JSON.stringify(doctorData),
    });
  },

  signupReceptionist: async (receptionistData) => {
    return await resilientFetch("/auth/receptionist/signup", {
      method: "POST",
      body: JSON.stringify(receptionistData),
    });
  },

  activateAccount: async ({ token, password }) => {
    return await resilientFetch("/auth/patient/activate", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  activatePatient: async (token, password) => {
    return await resilientFetch("/auth/patient/activate", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  forgotPassword: async (email) => {
    return await resilientFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  verifyResetToken: async (token) => {
    return await resilientFetch(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });
  },

  resetPassword: async (token, new_password) => {
    return await resilientFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    });
  },
};
