import { getDB, saveDB } from "./db";

export const mockPatientService = {
  getProfile: async (patientId) => {
    const db = getDB();
    return db.profiles[patientId] || null;
  },

  updateProfile: async (patientId, profileData) => {
    const db = getDB();
    db.profiles[patientId] = {
      ...db.profiles[patientId],
      ...profileData,
    };
    saveDB(db);
    return { data: db.profiles[patientId] };
  },

  searchPatients: async (query) => {
    const db = getDB();
    const queryLower = query.toLowerCase();
    return Object.entries(db.profiles)
      .filter(([id, profile]) => {
        // Patients are profiles with age/gender values
        const isPatient = profile.age !== undefined;
        const matchesName = profile.name.toLowerCase().includes(queryLower);
        return isPatient && matchesName;
      })
      .map(([id, profile]) => ({ id, ...profile }));
  },

  getVitals: async (patientId) => {
    const db = getDB();
    if (!db.vitals) db.vitals = {};
    return db.vitals[patientId] || {
      heartRate: "72 BPM",
      oxygenSaturation: "98%",
      bodyTemperature: "98.6 °F",
    };
  },

  updateVitals: async (patientId, vitalsData) => {
    const db = getDB();
    if (!db.vitals) db.vitals = {};
    db.vitals[patientId] = {
      ...db.vitals[patientId],
      ...vitalsData,
    };
    saveDB(db);
    return db.vitals[patientId];
  },
};
