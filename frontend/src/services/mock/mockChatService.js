import { getDB, saveDB } from "./db";

export const mockChatService = {
  getMessages: async (patientId, doctorId) => {
    const db = getDB();
    return db.chats.filter(
      (c) => c.patientId === patientId && c.doctorId === doctorId
    );
  },

  sendMessage: async ({ patientId, doctorId, sender, message }) => {
    const db = getDB();
    const newChat = {
      id: `chat-${Date.now()}`,
      patientId,
      doctorId,
      sender, // 'patient' or 'doctor'
      message,
      timestamp: new Date().toISOString(),
    };
    db.chats.push(newChat);
    saveDB(db);
    return { data: newChat };
  },
};
