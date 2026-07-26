import { getDB, saveDB } from "./db";

export const mockNotificationService = {
  getNotifications: async (userId) => {
    const db = getDB();
    return db.notifications.filter((n) => n.userId === userId);
  },

  getUnreadCount: async (userId) => {
    const db = getDB();
    return db.notifications.filter((n) => n.userId === userId && !n.read).length;
  },

  markAsRead: async (notifId) => {
    const db = getDB();
    const notif = db.notifications.find((n) => n.id === notifId);
    if (notif) {
      notif.read = true;
      saveDB(db);
    }
    return { success: true };
  },

  markAllAsRead: async (userId) => {
    const db = getDB();
    db.notifications.forEach((n) => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
    saveDB(db);
    return { success: true };
  },
};
