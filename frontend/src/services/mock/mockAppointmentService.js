import { getDB, saveDB } from "./db";

export const mockAppointmentService = {
  getAppointments: async (role, userId) => {
    const db = getDB();
    if (role === "doctor") {
      return db.appointments.filter((a) => a.doctorId === userId);
    } else {
      return db.appointments.filter((a) => a.patientId === userId);
    }
  },

  scheduleAppointment: async ({ patientId, patientName, doctorId, doctorName, date, time, reason }) => {
    const db = getDB();
    const newApt = {
      id: `apt-${Date.now()}`,
      patientId,
      patientName,
      doctorId,
      doctorName,
      date,
      time,
      status: "scheduled",
      reason,
    };
    db.appointments.push(newApt);
    
    // Add notification for doctor
    db.notifications.push({
      id: `notif-${Date.now()}`,
      userId: doctorId,
      title: "New Appointment Booked",
      body: `${patientName} has booked a consultation for ${date} at ${time}.`,
      read: false,
      date: new Date().toISOString(),
    });

    saveDB(db);
    return { data: newApt };
  },

  cancelAppointment: async (aptId) => {
    const db = getDB();
    const apt = db.appointments.find((a) => a.id === aptId);
    if (apt) {
      apt.status = "cancelled";
      saveDB(db);
    }
    return { success: true };
  },
};
