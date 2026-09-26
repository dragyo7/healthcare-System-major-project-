import { LayoutDashboard, Calendar, Users, FileText, Settings, Heart, Activity, Sparkles, Pill, Bot, Database, User } from "lucide-react";
import { ROUTES } from "./routes";

export const DOCTOR_NAV = [
  { label: "Dashboard", path: ROUTES.DOCTOR_DASHBOARD, icon: LayoutDashboard },
  { label: "CDS AI Assistant", path: ROUTES.DOCTOR_CDS, icon: Sparkles },
  { label: "Patients", path: "/doctor/patients", icon: Users },
  { label: "Prescriptions", path: "/doctor/prescriptions", icon: FileText },
  { label: "Medical Knowledge", path: "/doctor/knowledge", icon: Database },
  { label: "Schedule", path: "/doctor/appointments", icon: Calendar },
  { label: "Profile", path: "/doctor/profile", icon: User },
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
