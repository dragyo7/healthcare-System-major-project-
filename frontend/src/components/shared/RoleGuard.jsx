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

  const userRole = user?.user_metadata?.role || user?.role || "patient";

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return children;
}
