import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";
import { ROUTES } from "../../constants/routes";

export default function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // TODO: Integrates with Supabase Auth validation check
  if (user) {
    const dest = user.role === "doctor" ? ROUTES.DOCTOR_DASHBOARD : ROUTES.PATIENT_DASHBOARD;
    return <Navigate to={dest} replace />;
  }

  return children;
}
