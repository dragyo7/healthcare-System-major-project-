import { getDB, saveDB } from "./db";

const SESSION_KEY = "medai_session";

export const mockAuthService = {
  signIn: async (email, password) => {
    const db = getDB();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      return { error: { message: "Invalid email or password" } };
    }

    if (!user.verified) {
      return { error: { message: "Please verify your email address before logging in." } };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { data: { user } };
  },

  signUp: async (email, password, { name, role }) => {
    const db = getDB();
    const exists = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase());

    if (exists) {
      return { error: { message: "A user with this email already exists" } };
    }

    const newUser = {
      id: `u-${role === "doctor" ? "doc" : "pat"}-${Date.now()}`,
      email,
      password,
      role,
      name,
      verified: false, // Must be verified
    };

    db.users.push(newUser);
    
    // Add default profile
    db.profiles[newUser.id] = {
      name,
      email,
      phone: "",
      avatar: "",
      ...(role === "doctor"
        ? { specialization: "General Medicine" }
        : { age: "", gender: "", bloodGroup: "" }),
    };

    saveDB(db);
    return { data: { user: newUser } };
  },

  signOut: async () => {
    localStorage.removeItem(SESSION_KEY);
    return { error: null };
  },

  resetPassword: async (email) => {
    const db = getDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return { error: { message: "User not found" } };
    }
    return { error: null };
  },

  verifyOtp: async (email, token, type = "signup") => {
    const db = getDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { error: { message: "Verification failed. User mismatch." } };
    }

    // Accept any 6 digit token for easy sandbox simulation
    if (token.length !== 6) {
      return { error: { message: "Verification code must be 6 digits" } };
    }

    user.verified = true;
    saveDB(db);

    return { error: null };
  },

  getCurrentUser: () => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },
};
