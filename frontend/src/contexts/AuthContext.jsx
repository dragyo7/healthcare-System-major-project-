import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/authApi";

const AuthContext = createContext();

export function mapSupabaseUser(sbUser) {
  if (!sbUser) return null;
  const serverAssignedRole = sbUser.app_metadata?.role;
  const role = (serverAssignedRole === "doctor" || serverAssignedRole === "receptionist") ? serverAssignedRole : "patient";
  return {
    id: sbUser.id,
    email: sbUser.email,
    name: sbUser.user_metadata?.full_name || sbUser.email?.split("@")[0] || "User",
    role,
    verified: sbUser.user_metadata?.email_verified ?? true,
    ...sbUser,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("cdss_token") || localStorage.getItem("token") || localStorage.getItem("patient_token") || localStorage.getItem("receptionist_token");
      const storedUser = localStorage.getItem("cdss_user");
      const storedRole = localStorage.getItem("cdss_role");

      if (storedToken && storedUser && storedRole) {
        const parsedUser = JSON.parse(storedUser);
        setUser({
          ...parsedUser,
          token: storedToken,
          role: storedRole,
        });
      }
    } catch (e) {
      console.warn("Failed to restore session from localStorage:", e);
      localStorage.removeItem("cdss_token");
      localStorage.removeItem("cdss_user");
      localStorage.removeItem("cdss_role");
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (email, password, selectedRole = "doctor") => {
    let result = null;

    if (selectedRole === "doctor") {
      result = await authApi.loginDoctor(email, password);
    } else if (selectedRole === "patient") {
      result = await authApi.loginPatient(email, password);
    } else if (selectedRole === "receptionist") {
      result = await authApi.loginReceptionist(email, password);
    } else {
      // Auto-detect role
      try {
        result = await authApi.loginDoctor(email, password);
      } catch (docErr) {
        try {
          result = await authApi.loginReceptionist(email, password);
        } catch (recErr) {
          result = await authApi.loginPatient(email, password);
        }
      }
    }

    if (!result?.token || !result?.user) {
      throw new Error("Invalid authentication credentials");
    }

    const role = result.user.role || selectedRole;
    const authUser = {
      ...result.user,
      token: result.token,
      role,
    };

    // Store authoritative tokens and keys
    localStorage.setItem("cdss_token", result.token);
    localStorage.setItem("cdss_role", role);
    localStorage.setItem("cdss_user", JSON.stringify(authUser));

    // Backward-compatibility keys for legacy teammate submodules
    localStorage.setItem("token", result.token);
    if (role === "doctor") {
      localStorage.setItem("doctor", JSON.stringify(result.user));
    } else if (role === "patient") {
      localStorage.setItem("patient_token", result.token);
    } else if (role === "receptionist") {
      localStorage.setItem("receptionist_token", result.token);
      localStorage.setItem("receptionist_user", JSON.stringify(result.user));
    }

    setUser(authUser);
    return { data: { user: authUser } };
  };

  const signOut = async () => {
    localStorage.removeItem("cdss_token");
    localStorage.removeItem("cdss_role");
    localStorage.removeItem("cdss_user");
    localStorage.removeItem("token");
    localStorage.removeItem("doctor");
    localStorage.removeItem("patient_token");
    localStorage.removeItem("receptionist_token");
    localStorage.removeItem("receptionist_user");
    setUser(null);
    return { success: true };
  };

  const activateAccount = async (token, password) => {
    return await authApi.activatePatient(token, password);
  };

  const signUpDoctor = async (doctorData) => {
    const res = await authApi.signupDoctor(doctorData);
    if (res?.token && res?.doctor) {
      const authUser = {
        ...res.doctor,
        token: res.token,
        role: "doctor",
      };
      localStorage.setItem("cdss_token", res.token);
      localStorage.setItem("cdss_role", "doctor");
      localStorage.setItem("cdss_user", JSON.stringify(authUser));
      localStorage.setItem("token", res.token);
      localStorage.setItem("doctor", JSON.stringify(res.doctor));
      setUser(authUser);
      return { data: { user: authUser, token: res.token } };
    }
    return res;
  };

  const signUpPatient = async (patientData) => {
    const res = await authApi.signupPatient(patientData);
    if (res?.token && res?.patient) {
      const authUser = {
        ...res.patient,
        token: res.token,
        role: "patient",
      };
      localStorage.setItem("cdss_token", res.token);
      localStorage.setItem("cdss_role", "patient");
      localStorage.setItem("cdss_user", JSON.stringify(authUser));
      localStorage.setItem("token", res.token);
      localStorage.setItem("patient_token", res.token);
      setUser(authUser);
      return { data: { user: authUser, token: res.token } };
    }
    return res;
  };

  const signUpReceptionist = async (receptionistData) => {
    const res = await authApi.signupReceptionist(receptionistData);
    if (res?.token && res?.receptionist) {
      const authUser = {
        ...res.receptionist,
        token: res.token,
        role: "receptionist",
      };
      localStorage.setItem("cdss_token", res.token);
      localStorage.setItem("cdss_role", "receptionist");
      localStorage.setItem("cdss_user", JSON.stringify(authUser));
      localStorage.setItem("token", res.token);
      localStorage.setItem("receptionist_token", res.token);
      localStorage.setItem("receptionist_user", JSON.stringify(res.receptionist));
      setUser(authUser);
      return { data: { user: authUser, token: res.token } };
    }
    return res;
  };

  const signUp = async (email, password, metadata = {}) => {
    return await signUpPatient({
      email,
      password,
      full_name: metadata.name || metadata.full_name || email.split("@")[0],
      phone: metadata.phone || null,
      role: "patient",
      ...metadata,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role,
        token: user?.token,
        loading,
        signIn,
        signOut,
        activateAccount,
        signUpDoctor,
        signUpPatient,
        signUpReceptionist,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}