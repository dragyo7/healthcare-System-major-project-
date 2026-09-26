import { LayoutDashboard, Calendar, Users, FileText, Settings, Heart, Activity, Sparkles, Pill, Bot } from "lucide-react";
import { ROUTES } from "./routes";

export const DOCTOR_NAV = [
  { label: "Dashboard", path: ROUTES.DOCTOR_DASHBOARD, icon: LayoutDashboard },
  { label: "CDS AI Assistant", path: ROUTES.DOCTOR_CDS, icon: Sparkles },
  { label: "Appointments", path: "/doctor/appointments", icon: Calendar },
  { label: "Patients", path: "/doctor/patients", icon: Users },
  { label: "Prescriptions", path: "/doctor/prescriptions", icon: FileText },
  { label: "Settings", path: "/doctor/settings", icon: Settings },
];

export const PATIENT_NAV = [
  { label: "Overview", path: ROUTES.PATIENT_DASHBOARD, icon: Heart },
  { label: "CDS AI Assistant", path: ROUTES.PATIENT_CDS, icon: Sparkles },
  { label: "Drug Checker", path: "/patient/drug-checker", icon: Pill },
  { label: "My Records", path: "/patient/records", icon: FileText },
  { label: "Vitals Log", path: "/patient/vitals", icon: Activity },
  { label: "Appointments", path: "/patient/appointments", icon: Calendar },
  { label: "Settings", path: "/patient/settings", icon: Settings },
];
