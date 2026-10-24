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
  ShieldCheck,
  Stethoscope,
  ClipboardList,
  GraduationCap,
  Award,
  FileBadge
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Signup() {
  const navigate = useNavigate();
  const { signUpDoctor, signUpPatient, signUpReceptionist } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [roleTab, setRoleTab] = useState("doctor"); // "doctor" | "patient" | "receptionist"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("General Medicine");
  const [qualification, setQualification] = useState("MBBS");
  const [licenseNumber, setLicenseNumber] = useState("");
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
      if (roleTab === "doctor") {
        await signUpDoctor({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          specialization: specialization.trim() || "General Medicine",
          qualification: qualification.trim() || "MBBS",
          license_number: licenseNumber.trim() || undefined,
          terms_accepted: true,
        });

        setSuccess(true);
        setTimeout(() => {
          navigate("/doctor");
        }, 800);
      } else if (roleTab === "receptionist") {
        await signUpReceptionist({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          terms_accepted: true,
        });

        setSuccess(true);
        setTimeout(() => {
          navigate("/receptionist");
        }, 800);
      } else {
        await signUpPatient({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          terms_accepted: true,
        });

        setSuccess(true);
        setTimeout(() => {
          navigate("/patient");
        }, 800);
      }
    } catch (err) {
      setError(
        err?.message ||
          (roleTab === "doctor"
            ? t("Doctor registration failed. Please try again.")
            : roleTab === "receptionist"
            ? t("Receptionist registration failed. Please try again.")
            : t("Patient registration failed. Please try again."))
      );
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
        {/* Left Welcome Panel (CareUnity Emerald Aesthetic) */}
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
                <span>{t("Direct clinician & patient registration")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Sub-15ms deterministic safety screening")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Evidence-grounded medical intelligence")}</span>
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
                {roleTab === "doctor"
                  ? t("Register as an attending physician for immediate Clinical Decision Support access.")
                  : roleTab === "patient"
                  ? t("Create a personal patient care account to access health records.")
                  : t("Administrative front desk access for hospital reception staff.")}
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
            <div className="grid grid-cols-3 gap-2 mb-4" role="group">
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
            </div>

            {/* Success & Error Messages */}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {roleTab === "doctor"
                    ? t("Doctor account registered successfully! Entering clinician workspace...")
                    : roleTab === "receptionist"
                    ? t("Receptionist account registered successfully! Entering administrative front desk...")
                    : t("Patient account registered successfully! Entering patient portal...")}
                </span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Unified Registration Form for Doctor, Patient & Receptionist */}
            <form onSubmit={handleSubmit} className="space-y-3">
                {/* Full Name */}
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
                      placeholder={roleTab === "doctor" ? "e.g. Dr. Priya Sharma" : roleTab === "receptionist" ? "e.g. Pooja Verma" : "e.g. Priya Sharma"}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
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
                      placeholder={roleTab === "doctor" ? "dr.priya@hospital.org" : roleTab === "receptionist" ? "frontdesk@hospital.org" : "priya@example.com"}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Phone Number (Optional) */}
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

                {/* Doctor-Specific Fields: Specialization & Qualification */}
                {roleTab === "doctor" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t("Specialization")}
                        </label>
                        <div className="relative">
                          <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <select
                            value={specialization}
                            onChange={(e) => setSpecialization(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                          >
                            <option value="General Medicine">General Medicine</option>
                            <option value="Cardiology">Cardiology</option>
                            <option value="Internal Medicine">Internal Medicine</option>
                            <option value="Endocrinology">Endocrinology</option>
                            <option value="Neurology">Neurology</option>
                            <option value="Pediatrics">Pediatrics</option>
                            <option value="Pulmonology">Pulmonology</option>
                            <option value="Orthopedics">Orthopedics</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t("Qualification")}
                        </label>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={qualification}
                            onChange={(e) => setQualification(e.target.value)}
                            placeholder="e.g. MBBS, MD"
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Medical License / Registration Number */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Medical License / Registration No.")}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">({t("Optional")})</span>
                      </label>
                      <div className="relative">
                        <FileBadge className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          placeholder="e.g. MCI-2026-88192"
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        {t(
                          "Self-declared for academic research evaluation. The system validates formatting and does not query external council databases."
                        )}
                      </p>
                    </div>
                  </>
                )}

                {/* Password & Confirm Password */}
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

                {/* Informed Research Consent Gate */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      {t(
                        "I acknowledge this platform is an academic Clinical Decision Support research system and consent to simulated clinical processing under test protocols."
                      )}{" "}
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
                      {roleTab === "doctor"
                        ? t("Register as Attending Doctor")
                        : roleTab === "receptionist"
                        ? t("Register as Front Desk Staff")
                        : t("Create Patient Account")}{" "}
                      ↗
                    </span>
                  )}
                </button>
              </form>

            {/* Token Security Footnote */}
            <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">◇</span>
              <span>{t("Your session is protected with token-based authentication.")}</span>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {t("Already have an account?")}{" "}
            <Link to="/login" className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">
              {t("Sign In")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}