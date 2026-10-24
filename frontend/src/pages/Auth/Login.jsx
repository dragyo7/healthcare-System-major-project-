import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Globe,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Stethoscope,
  User,
  ClipboardList
} from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("registered") === "true") {
      setSuccessMessage("Account registered successfully! Please sign in with your credentials.");
      const regRole = params.get("role");
      if (regRole === "doctor" || regRole === "patient" || regRole === "receptionist") {
        setRole(regRole);
      }
      setEmail("");
      setPassword("");
    }
  }, [location]);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setError("");
  };


  const handleQuickLogin = async (selectedRole) => {
    setRole(selectedRole);
    setError("");
    let demoEmail = "doctor@gmail.com";
    let demoPass = "doctor123";
    if (selectedRole === "patient") {
      demoEmail = "aarav@gmail.com";
      demoPass = "patient123";
    } else if (selectedRole === "receptionist") {
      demoEmail = "receptionist@gmail.com";
      demoPass = "receptionist123";
    }
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsLoading(true);
    try {
      const { data } = await signIn(demoEmail, demoPass, selectedRole);
      const userRole = data?.user?.role || selectedRole;
      if (userRole === "doctor") {
        navigate("/doctor");
      } else if (userRole === "receptionist") {
        navigate("/receptionist");
      } else {
        navigate("/patient");
      }
    } catch (err) {
      setError(err?.message || t("Authentication failed. Please check credentials."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("Please provide both email and password."));
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
      setError(err?.message || t("Authentication failed. Please check credentials."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-bg min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative transition-colors text-slate-800 dark:text-slate-100 antialiased">
      {/* Top Floating Controls: Language Switcher & Dark/Light Theme */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-30">
        <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-1 rounded-xl border border-emerald-900/10 dark:border-slate-700 shadow-xs">
          <Globe className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 ml-1.5" />
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              language === "en"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage("hi")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              language === "hi"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => setLanguage("mr")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              language === "mr"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            मराठी
          </button>
          <button
            type="button"
            onClick={() => setLanguage("gu")}
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              language === "gu"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            ગુજરાતી
          </button>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-emerald-900/10 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 shadow-xs transition-colors cursor-pointer"
          title={t("Toggle theme")}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Main 2-Column Auth Layout */}
      <div className="max-w-[1380px] w-full mx-auto my-auto auth-layout-grid">
        {/* Left Welcome Panel (Fork CareUnity Design) */}
        <section className="welcome-panel-emerald">
          <header className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#c9f4df] text-[#176c58] flex items-center justify-center font-bold text-xl shadow-xs">
                +
              </span>
              <span className="font-extrabold text-lg tracking-tight text-white font-['Manrope']">
                {t("CareUnity")}
              </span>
            </div>
            <span className="text-xs text-emerald-100/80 font-medium">
              {t("One connected experience")}
            </span>
          </header>

          <div className="relative z-10 my-auto py-8 lg:py-12 max-w-[510px]">
            <span className="inline-block text-[#b6f1d7] text-[11px] font-bold tracking-[1.8px] leading-relaxed uppercase mb-3">
              {t("A MORE CONNECTED WAY TO CARE")}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-['Manrope'] text-white leading-[1.08] mb-5">
              {t("Healthcare, in harmony.")}
              <span className="text-[#64e6ae]">.</span>
            </h1>
            <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed mb-8">
              {t(
                "One secure starting point for patients, clinicians and healthcare teams—with a workspace shaped around your role."
              )}
            </p>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Role-aware account access")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Connected healthcare services")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("One unified interface")}</span>
              </div>
            </div>
          </div>

          {/* Decorative Orbs */}
          <div className="orb-decor orb-large-emerald" />
          <div className="orb-decor orb-small-emerald" />

          {/* Bottom Pulse Banner */}
          <div className="relative z-10 flex items-center gap-2.5 text-xs text-emerald-100/80 pt-4">
            <span className="pulse-dot-indicator" />
            <span>{t("A unified platform built around your care")}</span>
          </div>
        </section>

        {/* Right Form Panel (Fork CareUnity Card) */}
        <section className="flex flex-col items-center justify-center p-2 sm:p-4">
          <div className="form-card-glass">
            <div className="mb-5 text-left">
              <span className="inline-block text-[10px] font-bold tracking-[1.6px] text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                {t("WELCOME BACK")}
              </span>
              <h2 className="text-2xl font-bold font-['Manrope'] text-slate-900 dark:text-white tracking-tight">
                {t("Sign in to your account")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t("Enter your details to continue to your workspace.")}
              </p>
            </div>

            {/* Mode Switch Tabs (Sign In | Create Account) */}
            <div className="mode-switch-pill mb-5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="mode-tab-button active"
              >
                {t("Sign In")}
              </button>
              <Link
                to="/signup"
                role="tab"
                aria-selected="false"
                className="mode-tab-button"
              >
                {t("Create Account")}
              </Link>
            </div>

            {/* Choose Your Role Label */}
            <div className="text-[10px] font-bold tracking-[1.4px] text-slate-500 dark:text-slate-400 uppercase mb-2">
              {t("CHOOSE YOUR ROLE")}
            </div>

            {/* Role Switch Grid */}
            <div className="grid grid-cols-3 gap-2 mb-2" role="group">
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className={`role-card-btn ${role === "patient" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">♡</span>
                <span className="text-xs font-bold">{t("Patient")}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange("receptionist")}
                className={`role-card-btn ${role === "receptionist" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">▦</span>
                <span className="text-xs font-bold">{t("Reception")}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className={`role-card-btn ${role === "doctor" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">✚</span>
                <span className="text-xs font-bold">{t("Doctor")}</span>
              </button>
            </div>

            {/* Role Switch Contextual Help */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 min-h-[30px] leading-relaxed">
              {role === "patient"
                ? t("Sign in as a patient, or create a patient account.")
                : role === "doctor"
                ? t("Already approved? Sign in. New doctors can submit an application for Receptionist verification.")
                : t("Sign in with the existing Receptionist account. Receptionist access must be provisioned by an administrator.")}
            </p>

            {/* Messages */}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Email Address")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-14 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {showPassword ? t("Hide") : t("Show")}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="submit-btn-emerald mt-4"
              >
                {isLoading ? (
                  <span>{t("Signing In...")}</span>
                ) : (
                  <span>
                    {t("Sign in securely")} ↗
                  </span>
                )}
              </button>
            </form>

            {/* Verified Synthetic Demo Accounts Grid */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase text-center mb-2">
                {t("Quick Demo Accounts")}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("doctor")}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors cursor-pointer"
                  title="1-Click Login as Doctor"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-400">
                    <Stethoscope className="h-3 w-3" />
                    <span>{t("Doctor")}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">doctor@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("patient")}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors cursor-pointer"
                  title="1-Click Login as Patient"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-teal-800 dark:text-teal-400">
                    <User className="h-3 w-3" />
                    <span>{t("Patient")}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">aarav@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("receptionist")}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors cursor-pointer"
                  title="1-Click Login as Receptionist"
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-900 dark:text-emerald-400">
                    <ClipboardList className="h-3 w-3" />
                    <span>{t("Reception")}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">receptionist@...</div>
                </button>
              </div>
            </div>

            {/* Token Security Footnote */}
            {/* Token Security Footnote */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">◇</span>
              <span>{t("Your session is protected with token-based authentication.")}</span>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {t("Need access help? Contact your healthcare administrator.")}
          </div>
        </section>
      </div>
    </div>
  );
}