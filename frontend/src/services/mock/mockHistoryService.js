import { getDB, saveDB } from "./db";

export const mockHistoryService = {
  getMedicalHistory: async (patientId) => {
    const db = getDB();
    return db.medicalHistory.filter((mh) => mh.patientId === patientId);
  },

  addHistoryEntry: async ({ patientId, condition, diagnosedDate, status }) => {
    const db = getDB();
    const newEntry = {
      id: `mh-${Date.now()}`,
      patientId,
      condition,
      diagnosedDate,
      status,
    };
    db.medicalHistory.push(newEntry);
    saveDB(db);
    return { data: newEntry };
  },

  getReports: async (patientId) => {
    const db = getDB();
    return db.reports.filter((r) => r.patientId === patientId);
  },

  addReport: async ({ patientId, title, status = "Reviewed", notes = "" }) => {
    const db = getDB();
    const newReport = {
      id: `rep-${Date.now()}`,
      patientId,
      title,
      date: new Date().toISOString().split("T")[0],
      status,
      notes,
    };
    db.reports.push(newReport);
    saveDB(db);
    return { data: newReport };
  },
};
