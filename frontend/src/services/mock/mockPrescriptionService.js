import { getDB, saveDB } from "./db";

export const mockPrescriptionService = {
  getPrescriptions: async (patientId) => {
    const db = getDB();
    return db.prescriptions.filter((p) => p.patientId === patientId);
  },

  addPrescription: async ({ patientId, doctorId, doctorName, medication, dosage, refills }) => {
    const db = getDB();
    const newPresc = {
      id: `prc-${Date.now()}`,
      patientId,
      doctorId,
      doctorName,
      medication,
      dosage,
      date: new Date().toISOString().split("T")[0],
      refills: parseInt(refills) || 0,
    };
    db.prescriptions.push(newPresc);

    // Notify patient
    db.notifications.push({
      id: `notif-${Date.now()}`,
      userId: patientId,
      title: "New Prescription Issued",
      body: `${doctorName} issued a prescription for ${medication}.`,
      read: false,
      date: new Date().toISOString(),
    });

    saveDB(db);
    return { data: newPresc };
  },
};
