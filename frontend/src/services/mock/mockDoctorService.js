import { getDB, saveDB } from "./db";

export const mockDoctorService = {
  getProfile: async (doctorId) => {
    const db = getDB();
    return db.profiles[doctorId] || null;
  },

  updateProfile: async (doctorId, profileData) => {
    const db = getDB();
    db.profiles[doctorId] = {
      ...db.profiles[doctorId],
      ...profileData,
    };
    saveDB(db);
    return { data: db.profiles[doctorId] };
  },

  getDoctorList: async () => {
    const db = getDB();
    return Object.entries(db.profiles)
      .filter(([id, profile]) => profile.specialization !== undefined)
      .map(([id, profile]) => ({ id, ...profile }));
  },
};
