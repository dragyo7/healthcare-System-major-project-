import { getDB } from "./db";

export const mockDashboardService = {
  getDoctorStats: async (doctorId) => {
    const db = getDB();
    const patientsCount = Object.values(db.profiles).filter((p) => p.age !== undefined).length;
    const today = new Date().toISOString().split("T")[0];
    const todayAppointments = db.appointments.filter(
      (a) => a.doctorId === doctorId && a.date === today
    ).length;

    return [
      { title: "Active Patients", value: String(patientsCount), description: "Assigned medical files" },
      { title: "Appointments Today", value: String(todayAppointments || 2), description: "Consultations scheduled" },
      { title: "Attention Required", value: "3", description: "Vitals out of bounds alerts" },
    ];
  },

  getPatientStats: async (patientId) => {
    const db = getDB();
    const vitals = (db.vitals && db.vitals[patientId]) || {
      heartRate: "72 BPM",
      oxygenSaturation: "96%",
    };
    return [
      { title: "Heart Rate", value: vitals.heartRate || "72 BPM", description: "Resting average" },
      { title: "Active Vitals", value: vitals.oxygenSaturation || "96%", description: "Biometric status index" },
      { title: "Active Energy", value: "480 kcal", description: "Daily active calories" },
    ];
  },

  getRecentActivity: async (role, id) => {
    const db = getDB();
    if (role === "doctor") {
      return db.appointments
        .filter((a) => a.doctorId === id)
        .map((a) => ({
          id: a.id,
          title: `Consultation with ${a.patientName}`,
          description: `Reason: ${a.reason} on ${a.date} at ${a.time}`,
          time: "Recently",
        }));
    } else {
      return db.prescriptions
        .filter((p) => p.patientId === id)
        .map((p) => ({
          id: p.id,
          title: `Prescription issued: ${p.medication}`,
          description: `Dosage: ${p.dosage}`,
          time: "Recently",
        }));
    }
  },
};
