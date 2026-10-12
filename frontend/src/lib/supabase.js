import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidHttpUrl = (str) => {
  if (!str || typeof str !== "string") return false;
  try {
    const parsed = new URL(str);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !str.includes("placeholder");
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(
  isValidHttpUrl(rawUrl) &&
    rawAnonKey &&
    typeof rawAnonKey === "string" &&
    rawAnonKey.trim().length > 10 &&
    !rawAnonKey.includes("placeholder")
);

const unconfiguredAuthHandler = {
  getSession: async () => ({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  signInWithPassword: async () => ({
    data: null,
    error: {
      message:
        "Supabase cloud authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment, or use local demo credentials (e.g. doctor@medai.com / password123).",
    },
  }),
  signUp: async () => ({
    data: null,
    error: {
      message:
        "Supabase cloud registration is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
    },
  }),
  signOut: async () => ({ error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  resend: async () => ({
    data: null,
    error: {
      message: "Email verification is unavailable because Supabase is not configured.",
    },
  }),
  resetPasswordForEmail: async () => ({
    data: null,
    error: {
      message: "Password reset is unavailable because Supabase is not configured.",
    },
  }),
  updateUser: async () => ({
    data: null,
    error: {
      message: "User profile updates are unavailable because Supabase is not configured.",
    },
  }),
};

if (!isSupabaseConfigured) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured. Cloud authentication is disabled; running in local demo mode without speculative network fallbacks."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey)
  : { auth: unconfiguredAuthHandler };

export default supabase;