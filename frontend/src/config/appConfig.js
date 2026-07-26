export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  environment: import.meta.env.MODE || "development",
  appName: "MedAI Platform",
  defaultSessionDuration: 3600, // seconds
};
