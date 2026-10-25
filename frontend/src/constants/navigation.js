import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Activity,
  Sparkles,
  Pill,
  Bot,
  User,
} from "lucide-react";

export const DOCTOR_NAV = [
  { label: "Dashboard", path: "/doctor", icon: LayoutDashboard },
  { label: "Patients Dossier", path: "/doctor/patients", icon: Users },
  { label: "Clinical CDS Assistant", path: "/doctor/cds", icon: Sparkles },
  { label: "Prescriptions & Safety", path: "/doctor/prescriptions", icon: Pill },
  { label: "Discharge Care", path: "/doctor/discharge", icon: FileText },
  { label: "Appointments & Schedule", path: "/doctor/appointments", icon: Calendar },
  { label: "Profile", path: "/doctor/profile", icon: User },
];

export const PATIENT_NAV = [
  { label: "My Dashboard", path: "/patient", icon: LayoutDashboard },
  { label: "Appointments & Doctors", path: "/patient/appointments", icon: Calendar },
  { label: "Post-Discharge Care", path: "/patient/discharge", icon: FileText },
  { label: "Post-Discharge Assistant", path: "/patient/assistant", icon: Bot },
  { label: "My Prescriptions", path: "/patient/prescriptions", icon: Pill },
  { label: "Medical History", path: "/patient/history", icon: Activity },
  { label: "My Profile", path: "/patient/profile", icon: User },
];

export const RECEPTIONIST_NAV = [
  { label: "Front Desk Dashboard", path: "/receptionist", icon: LayoutDashboard },
  { label: "Patient Directory & Reg", path: "/receptionist/patients", icon: Users },
  { label: "Appointment Queue", path: "/receptionist/appointments", icon: Calendar },
  { label: "Doctor Roster", path: "/receptionist/doctors", icon: Activity },
];
