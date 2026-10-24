import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Phone,
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
  ClipboardList
} from "lucide-react";
import { authApi } from "../../api/authApi";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Signup() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [roleTab, setRoleTab] = useState("patient"); // "patient" | "doctor" | "receptionist"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!consentGiven) {
      setError(t("Please acknowledge the academic research disclaimer and consent to proceed."));
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      setError(t("Full name, email, and password are required."));
      return;
    }

    if (fullName.trim().length < 2) {
      setError(t("Full name must be at least 2 characters."));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError(t("Please provide a valid email address."));
      return;
    }

    if (password.length < 8) {
      setError(t("Password must be at least 8 characters long."));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.signupPatient({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        terms_accepted: true,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/login?registered=true");
      }, 1800);
    } catch (err) {
      setError(err?.message || t("Patient registration failed. Please try again."));
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

        {/* Right Form Panel */}
        <section className="flex flex-col items-center justify-center p-2 sm:p-4">
          <div className="form-card-glass">
            <div className="mb-5 text-left">
              <span className="inline-block text-[10px] font-bold tracking-[1.6px] text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                {t("GET STARTED")}
              </span>
              <h2 className="text-2xl font-bold font-['Manrope'] text-slate-900 dark:text-white tracking-tight">
                {t("Create your account")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t("Create a patient account to get started.")}
              </p>
            </div>

            {/* Mode Switch Tabs (Sign In | Create Account) */}
            <div className="mode-switch-pill mb-5" role="tablist">
              <Link
                to="/login"
                role="tab"
                aria-selected="false"
                className="mode-tab-button"
              >
                {t("Sign In")}
              </Link>
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="mode-tab-button active"
              >
                {t("Create Account")}
              </button>
            </div>

            {/* Choose Your Role Label */}
            <div className="text-[10px] font-bold tracking-[1.4px] text-slate-500 dark:text-slate-400 uppercase mb-2">
              {t("CHOOSE YOUR ROLE")}
            </div>

            {/* Role Switch Grid */}
            <div className="grid grid-cols-3 gap-2 mb-2" role="group">
              <button
                type="button"
                onClick={() => {
                  setRoleTab("patient");
                  setError("");
                }}
                className={`role-card-btn ${roleTab === "patient" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">♡</span>
                <span className="text-xs font-bold">{t("Patient")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRoleTab("receptionist");
                  setError("");
                }}
                className={`role-card-btn ${roleTab === "receptionist" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">▦</span>
                <span className="text-xs font-bold">{t("Reception")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRoleTab("doctor");
                  setError("");
                }}
                className={`role-card-btn ${roleTab === "doctor" ? "selected" : ""}`}
              >
                <span className="role-card-symbol">✚</span>
                <span className="text-xs font-bold">{t("Doctor")}</span>
              </button>
            </div>

            {/* Messages */}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{t("Registration successful! Redirecting to login...")}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Patient Form Mode */}
            {roleTab === "patient" ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Full Name")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="e.g. Priya Sharma"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

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
                      placeholder="priya@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Phone Number")} <span className="text-[10px] text-slate-400 font-normal">({t("Optional")})</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t("Confirm")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Informed Consent Gate */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      {t("I acknowledge this platform is an academic Clinical Decision Support research system and consent to my data processing under simulated clinical protocols.")}{" "}
                      <Link to="/about" className="text-emerald-700 dark:text-emerald-400 underline font-medium">
                        {t("Read full clinical ethics")}
                      </Link>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !consentGiven}
                  className="submit-btn-emerald mt-3"
                >
                  {isLoading ? (
                    <span>{t("Creating Account...")}</span>
                  ) : (
                    <span>
                      {t("Create Patient Account")} ↗
                    </span>
                  )}
                </button>
              </form>
            ) : roleTab === "doctor" ? (
              /* Doctor NMC Credentialing Guidance */
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-slate-700 dark:text-slate-300 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs">
                  <Stethoscope className="h-4 w-4" />
                  <span>{t("Clinician Credentialing Required")}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {t(
                    "Doctor accounts cannot be self-registered anonymously. In compliance with National Medical Commission (NMC) regulations, clinicians must be vetted and provisioned by hospital administration."
                  )}
                </p>
                <div className="text-[11px] p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 font-medium">
                  {t("Contact hospital administration or clinic registry desk to obtain verified practitioner credentials.")}
                </div>
                <Link
                  to="/login"
                  className="block text-center py-2 px-3 rounded-xl bg-blue-700 text-white text-xs font-bold shadow-xs hover:bg-blue-800 transition-colors"
                >
                  {t("Return to Clinician Sign In")}
                </Link>
              </div>
            ) : (
              /* Receptionist Provisioning Guidance */
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 text-slate-700 dark:text-slate-300 space-y-3">
                <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 font-bold text-xs">
                  <ClipboardList className="h-4 w-4" />
                  <span>{t("Administrative Front Desk Provisioning")}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {t(
                    "Receptionist accounts are provisioned directly by hospital administrative coordinators using single-use activation tokens."
                  )}
                </p>
                <div className="text-[11px] p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-purple-100 dark:border-slate-800 font-medium">
                  {t("If you received an activation token, proceed to activate your assigned credentials.")}
                </div>
                <Link
                  to="/activate"
                  className="block text-center py-2 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold shadow-xs hover:bg-purple-800 transition-colors"
                >
                  {t("Proceed to Account Activation")}
                </Link>
              </div>
            )}

            {/* Token Security Footnote */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">◇</span>
              <span>{t("Your session is protected with token-based authentication.")}</span>
            </div>

            {/* Account Activation Link */}
            <div className="mt-3 text-center text-xs">
              <Link
                to="/activate"
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{t("Activate Account")}</span>
              </Link>
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