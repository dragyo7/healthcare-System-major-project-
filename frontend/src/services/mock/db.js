// Mock Local Database Initializer
const DB_KEY = "medai_db";

const DEFAULT_DB = {
  users: [
    {
      id: "u-doc-1",
      email: "doctor@medai.com",
      password: "password123",
      role: "doctor",
      name: "Dr. Alexander Ross",
      verified: true,
    },
    {
      id: "u-pat-1",
      email: "patient@medai.com",
      password: "password123",
      role: "patient",
      name: "Sarah Parker",
      verified: true,
    },
  ],
  profiles: {
    "u-doc-1": {
      name: "Dr. Alexander Ross",
      email: "doctor@medai.com",
      phone: "+1 (555) 019-2834",
      specialization: "Cardiology",
      avatar: "",
    },
    "u-pat-1": {
      name: "Sarah Parker",
      email: "patient@medai.com",
      phone: "+1 (555) 012-9876",
      age: 28,
      gender: "Female",
      bloodGroup: "O+",
      avatar: "",
    },
  },
  appointments: [
    {
      id: "apt-1",
      patientId: "u-pat-1",
      patientName: "Sarah Parker",
      doctorId: "u-doc-1",
      doctorName: "Dr. Alexander Ross",
      date: "2026-07-28",
      time: "10:00",
      status: "scheduled",
      reason: "Cardio Checkup",
    },
    {
      id: "apt-2",
      patientId: "u-pat-1",
      patientName: "Sarah Parker",
      doctorId: "u-doc-1",
      doctorName: "Dr. Alexander Ross",
      date: "2026-06-15",
      time: "14:30",
      status: "completed",
      reason: "Initial Consultation",
    },
  ],
  notifications: [
    {
      id: "notif-1",
      userId: "u-pat-1",
      title: "Appointment Confirmed",
      body: "Your consultation with Dr. Ross is set for July 28 at 10:00 AM.",
      read: false,
      date: "2026-07-26T10:00:00Z",
    },
    {
      id: "notif-2",
      userId: "u-doc-1",
      title: "New Booking",
      body: "Sarah Parker has scheduled a Cardio Checkup for July 28.",
      read: false,
      date: "2026-07-26T09:30:00Z",
    },
  ],
  prescriptions: [
    {
      id: "prc-1",
      patientId: "u-pat-1",
      doctorId: "u-doc-1",
      doctorName: "Dr. Alexander Ross",
      medication: "Lisinopril 10mg",
      dosage: "Once daily, morning",
      date: "2026-06-15",
      refills: 2,
    },
  ],
  reports: [
    {
      id: "rep-1",
      patientId: "u-pat-1",
      title: "ECG Summary Report",
      date: "2026-06-15",
      status: "Reviewed",
      notes: "Sinus rhythm with normal axis. No acute abnormalities.",
    },
  ],
  medicalHistory: [
    {
      id: "mh-1",
      patientId: "u-pat-1",
      condition: "Mild Hypertension",
      diagnosedDate: "2026-06-15",
      status: "Active",
    },
  ],
  chats: [
    {
      id: "chat-1",
      patientId: "u-pat-1",
      doctorId: "u-doc-1",
      sender: "doctor",
      message: "Hello Sarah, remember to log your vitals before Tuesday.",
      timestamp: "2026-07-25T15:00:00Z",
    },
  ],
  settings: {
    theme: "light",
    notifications: true,
    language: "English",
  },
};

export const getDB = () => {
  const data = localStorage.getItem(DB_KEY);
  if (!data) {
    localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_DB));
    return DEFAULT_DB;
  }
  return JSON.parse(data);
};

export const saveDB = (db) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};
