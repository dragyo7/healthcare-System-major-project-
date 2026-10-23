import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2, Activity, HeartPulse, Stethoscope, User, ClipboardList, Globe, Sun, Moon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [role, setRole] = useState("doctor");
  const [email, setEmail] = useState("doctor@gmail.com");
  const [password, setPassword] = useState("doctor123");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("activated") === "true") {
      setSuccessMessage("Your account has been successfully activated! Please log in.");
      setRole("patient");
      setEmail("aarav@gmail.com");
      setPassword("");
    } else if (params.get("registered") === "true") {
      setSuccessMessage("Your patient account has been registered! Please sign in with your credentials.");
      setRole("patient");
      setEmail("");
      setPassword("");
    }
  }, [location]);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setError("");
    if (selectedRole === "doctor") {
      setEmail("doctor@gmail.com");
      setPassword("doctor123");
    } else if (selectedRole === "patient") {
      setEmail("aarav@gmail.com");
      setPassword("patient123");
    } else if (selectedRole === "receptionist") {
      setEmail("receptionist@gmail.com");
      setPassword("receptionist123");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { data } = await signIn(email, password, role);
      const userRole = data?.user?.role || role;

      if (userRole === "doctor") {
        navigate("/doctor");
      } else if (userRole === "receptionist") {
        navigate("/receptionist");
      } else {
        navigate("/patient");
      }
    } catch (err) {
      setError(err?.message || "Authentication failed. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 antialiased transition-colors relative">
      {/* Top Floating Controls: Language & Theme */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 ml-1.5" />
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
              language === "en" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage("hi")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
              language === "hi" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => setLanguage("mr")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
              language === "mr" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            मराठी
          </button>
          <button
            type="button"
            onClick={() => setLanguage("gu")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
              language === "gu" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            ગુજરાતી
          </button>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm transition-colors"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Branding Header Area */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 shadow-xl shadow-emerald-600/25 text-white mb-4 ring-4 ring-emerald-100 dark:ring-emerald-900/50">
          <HeartPulse className="h-9 w-9 text-white animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("Clinical Decision Support")}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
          {t("Modular Healthcare Platform • Evidence-Grounded Medical Intelligence")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-2xl shadow-emerald-950/10 rounded-2xl sm:px-10 border border-emerald-100/80 dark:border-slate-800">
          {/* Top Access Mode Switch */}
          <div className="flex rounded-xl bg-emerald-50 dark:bg-slate-800/80 p-1 mb-6 border border-emerald-200/60 dark:border-slate-700/60">
            <button
              type="button"
              className="flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 bg-emerald-700 text-white shadow-md cursor-default"
            >
              {t("Sign In")}
            </button>
            <Link
              to="/signup"
              className="flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-white cursor-pointer"
            >
              {t("Create Account")}
            </Link>
          </div>

          {/* Role Selection Tabs */}
          <div className="mb-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
              {t("Select Your Clinical Role")}
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === "doctor"
                    ? "bg-emerald-700 text-white shadow-sm ring-1 ring-emerald-600"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span>{t("Doctor")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === "patient"
                    ? "bg-teal-700 text-white shadow-sm ring-1 ring-teal-600"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>{t("Patient")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("receptionist")}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === "receptionist"
                    ? "bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>{t("Reception")}</span>
              </button>
            </div>
          </div>

          {/* Role Guidance Helper */}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-5 px-1 text-center">
            {role === "patient"
              ? t("Access your appointments, prescriptions, and health records.")
              : role === "doctor"
              ? t("Clinician portal for consultations, prescriptions & CDS.")
              : t("Administrative desk for intake, appointments & doctor registration.")}
          </p>

          {/* Messages */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("Email Address")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/60 dark:text-emerald-400/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@healthcare.org"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("Password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/60 dark:text-emerald-400/60" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white shadow-lg bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>{t("Authenticating with Clinical Gateway...")}</span>
              ) : (
                <>
                  <span>
                    {role === "doctor"
                      ? t("Sign In as Doctor")
                      : role === "patient"
                      ? t("Sign In as Patient")
                      : t("Sign In as Receptionist")}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Bar */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              {t("Quick Synthetic Demo Accounts")}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-slate-800/60 hover:bg-emerald-100/60 dark:hover:bg-slate-800 border border-emerald-100 dark:border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> {t("Doctor")}
                </div>
                <div className="text-slate-500 dark:text-slate-400 truncate text-[10px]">doctor@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className="p-2.5 rounded-xl bg-teal-50/60 dark:bg-slate-800/60 hover:bg-teal-100/60 dark:hover:bg-slate-800 border border-teal-100 dark:border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1">
                  <User className="h-3 w-3" /> {t("Patient")}
                </div>
                <div className="text-slate-500 dark:text-slate-400 truncate text-[10px]">aarav@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("receptionist")}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" /> {t("Reception")}
                </div>
                <div className="text-slate-500 dark:text-slate-400 truncate text-[10px]">receptionist@...</div>
              </button>
            </div>
          </div>

          {/* Patient Registration & Activation Links */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div>
              <Link
                to="/signup"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
              >
                <span>{t("Don't have a patient account?")}</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold underline">{t("Create Account")}</span>
              </Link>
            </div>
            <div>
              <Link
                to="/activate"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
              >
                <span>🔑 {t("Received an activation link from reception?")}</span>
                <span className="text-emerald-700 dark:text-emerald-400 underline font-medium">{t("Activate Account")}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Security Invariant Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t("Server-Side RBAC • Express Gateway Port 5000")}</span>
          </div>
          <span className="hidden sm:inline">•</span>
          <Link to="/about" className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold">
            {t("About & Clinical Ethics")}
          </Link>
        </div>
      </div>
    </div>
  );
}