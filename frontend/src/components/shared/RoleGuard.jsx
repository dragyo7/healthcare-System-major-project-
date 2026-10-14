import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";
import { ROUTES } from "../../constants/routes";

export default function RoleGuard({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Security Invariant: Local demo sessions are strictly prohibited in production builds
  if (user?.isLocalDemo && !import.meta.env.DEV) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Security Invariant: Never evaluate unverified caller-controlled user_metadata.
  const userRole = user?.role || "patient";

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return children;
}
