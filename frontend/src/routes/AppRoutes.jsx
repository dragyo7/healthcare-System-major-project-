import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Auth & Access
import Login from "../pages/Auth/Login";
import Activate from "../pages/Auth/Activate";
import Signup from "../pages/Auth/Signup";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import ResetPassword from "../pages/Auth/ResetPassword";

// Route Guards & Layouts
import ProtectedRoute from "../components/shared/ProtectedRoute";
import GuestRoute from "../components/shared/GuestRoute";
import RoleGuard from "../components/shared/RoleGuard";
import DashboardLayout from "../layouts/DashboardLayout";

// Doctor Workspace
import DoctorDashboard from "../pages/Doctor/Dashboard";
import DoctorPatients from "../pages/Doctor/Patients";
import DoctorCDS from "../pages/Doctor/CDS";
import DoctorPrescriptions from "../pages/Doctor/Prescriptions";
import DoctorDischarge from "../pages/Doctor/Discharge";
import DoctorAppointments from "../pages/Doctor/Appointments";
import DoctorProfile from "../pages/Doctor/Profile";

// Patient Workspace
import PatientDashboard from "../pages/Patient/Dashboard";
import PatientDischarge from "../pages/Patient/Discharge";
import PatientAssistant from "../pages/Patient/Assistant";
import PatientPrescriptions from "../pages/Patient/Prescriptions";
import PatientMedicalHistory from "../pages/Patient/MedicalHistory";
import PatientProfile from "../pages/Patient/Profile";

// Receptionist Workspace
import ReceptionistDashboard from "../pages/Receptionist/Dashboard";
import ReceptionistPatients from "../pages/Receptionist/Patients";
import ReceptionistAppointments from "../pages/Receptionist/Appointments";
import ReceptionistDoctors from "../pages/Receptionist/Doctors";

// Error Pages
import NotFound from "../pages/Common/NotFound";
import Unauthorized from "../pages/Common/Unauthorized";
import ServerError from "../pages/Common/ServerError";
import About from "../pages/Common/About";
import Home from "../pages/Common/Home";

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role || "").toLowerCase();
  if (role === "doctor") return <Navigate to="/doctor" replace />;
  if (role === "patient") return <Navigate to="/patient" replace />;
  if (role === "receptionist") return <Navigate to="/receptionist" replace />;

  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unified Intelligent Root Entry Point */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public & Guest Authentication Entry Points */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route path="/activate" element={<Activate />} />
        <Route path="/about" element={<About />} />
        <Route path="/home" element={<Home />} />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          }
        />

        {/* ------------------------------------------------------------- */}
        {/* DOCTOR WORKSPACE: CLINICAL CDS & EHR MANAGEMENT               */}
        {/* ------------------------------------------------------------- */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorDashboard />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/patients"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorPatients />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/cds"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorCDS />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/prescriptions"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorPrescriptions />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/discharge"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorDischarge />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/appointments"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorAppointments />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/profile"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <DoctorProfile />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* ------------------------------------------------------------- */}
        {/* PATIENT WORKSPACE: POST-DISCHARGE CARE & ASSISTANT           */}
        {/* ------------------------------------------------------------- */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientDashboard />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/discharge"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientDischarge />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/assistant"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientAssistant />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/prescriptions"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientPrescriptions />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/history"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientMedicalHistory />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <PatientProfile />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* ------------------------------------------------------------- */}
        {/* RECEPTIONIST WORKSPACE: ADMINISTRATIVE FRONT DESK COORDINATION */}
        {/* ------------------------------------------------------------- */}
        <Route
          path="/receptionist"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["receptionist"]}>
                <DashboardLayout role="receptionist">
                  <ReceptionistDashboard />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/receptionist/patients"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["receptionist"]}>
                <DashboardLayout role="receptionist">
                  <ReceptionistPatients />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/receptionist/appointments"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["receptionist"]}>
                <DashboardLayout role="receptionist">
                  <ReceptionistAppointments />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/receptionist/doctors"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["receptionist"]}>
                <DashboardLayout role="receptionist">
                  <ReceptionistDoctors />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Error Pages */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/server-error" element={<ServerError />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}