import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingScreen from "./LoadingScreen";

export default function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    let dest = "/doctor";
    if (user.role === "patient") {
      dest = "/patient";
    } else if (user.role === "receptionist") {
      dest = "/receptionist";
    }
    return <Navigate to={dest} replace />;
  }

  return children;
}
