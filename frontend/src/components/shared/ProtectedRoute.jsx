import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";
import { ROUTES } from "../../constants/routes";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // TODO: Integrates with Supabase Auth session validation
  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return children;
}
