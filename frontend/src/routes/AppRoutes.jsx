import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Splash from "../pages/Common/Splash";
import Home from "../pages/Common/Home";
import Login from "../pages/Auth/Login";
import Signup from "../pages/Auth/Signup";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import EmailVerification from "../pages/Auth/EmailVerification";
import ResetPassword from "../pages/Auth/ResetPassword";
import DoctorDashboard from "../pages/Doctor/Dashboard";
import PatientDashboard from "../pages/Patient/Dashboard";
import NotFound from "../pages/Common/NotFound";
import Unauthorized from "../pages/Common/Unauthorized";
import ServerError from "../pages/Common/ServerError";

import ProtectedRoute from "../components/shared/ProtectedRoute";
import GuestRoute from "../components/shared/GuestRoute";
import RoleGuard from "../components/shared/RoleGuard";
import DashboardLayout from "../layouts/DashboardLayout";
import { ROUTES } from "../constants/routes";

// New Page Imports
import Appointments from "../pages/Common/Appointments";
import Settings from "../pages/Common/Settings";
import Profile from "../pages/Common/Profile";
import Patients from "../pages/Doctor/Patients";
import Reports from "../pages/Doctor/Reports";
import Records from "../pages/Patient/Records";
import Vitals from "../pages/Patient/Vitals";
import Prescription from "../pages/Patient/Prescription";
import Chat from "../pages/Patient/Chat";
import DrugChecker from "../pages/Patient/DrugChecker";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding & Splash */}
        <Route path="/" element={<Splash />} />
        <Route path="/home" element={<Home />} />

        {/* Auth Pages wrapped in GuestRoute */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path={ROUTES.SIGNUP}
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route
          path={ROUTES.FORGOT_PASSWORD}
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />
        <Route
          path={ROUTES.VERIFY_EMAIL}
          element={
            <GuestRoute>
              <EmailVerification />
            </GuestRoute>
          }
        />

        <Route
          path={ROUTES.RESET_PASSWORD}
          element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          }
        />

        {/* Protected Doctor Routes */}
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
          path="/doctor/appointments"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <Appointments />
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
                  <Patients />
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
                  <Reports />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/settings"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <Settings />
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
                  <Profile />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/chat"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["doctor"]}>
                <DashboardLayout role="doctor">
                  <Chat />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />


        {/* Protected Patient Routes */}
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
          path="/patient/records"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <Records />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/vitals"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <Vitals />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <Appointments />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/settings"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <Settings />
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
                  <Profile />
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
                  <Prescription />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/chat"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <Chat />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/drug-checker"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={["patient"]}>
                <DashboardLayout role="patient">
                  <DrugChecker />
                </DashboardLayout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Error Pages */}
        <Route path={ROUTES.UNAUTHORIZED} element={<Unauthorized />} />
        <Route path={ROUTES.SERVER_ERROR} element={<ServerError />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}