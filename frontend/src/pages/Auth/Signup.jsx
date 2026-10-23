import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, HeartPulse, Stethoscope, Globe, Sun, Moon } from "lucide-react";
import { authApi } from "../../api/authApi";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Signup() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

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

  const [roleTab, setRoleTab] = useState("patient"); // "patient" | "doctor"

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!consentGiven) {
      setError("Please acknowledge the academic research disclaimer and consent to proceed.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Full name, email, and password are required.");
      return;
    }

    if (fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      setError("Please provide a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
      }, 2000);
    } catch (err) {
      setError(err?.message || "Patient registration failed. Please try again.");
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
          {/* Mode Switch Tabs */}
          <div className="flex rounded-xl bg-emerald-50 dark:bg-slate-800/80 p-1 mb-5 border border-emerald-200/60 dark:border-slate-700/60">
            <Link
              to="/login"
              className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-white"
            >
              {t("Sign In")}
            </Link>
            <button
              type="button"
              className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 bg-emerald-700 text-white shadow-md cursor-default"
            >
              {t("Create Account")}
            </button>
          </div>

          {/* Role Selection Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setRoleTab("patient"); setError(""); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                roleTab === "patient"
                  ? "bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {t("Patient Registration")}
            </button>
            <button
              type="button"
              onClick={() => { setRoleTab("doctor"); setError(""); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                roleTab === "doctor"
                  ? "bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              {t("Doctor Onboarding")}
            </button>
          </div>

          {roleTab === "doctor" ? (
            /* Doctor Onboarding Guidance Panel */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50/90 dark:bg-slate-800/80 border border-emerald-200/80 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>{t("Clinical Physician Credentialing")}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  In compliance with hospital clinical governance and National Medical Commission (NMC) regulations, physician accounts require verified medical council registration and cannot be registered through public unverified sign-up forms.
                </p>
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-1">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Physicians are onboarded by Hospital Administration / Reception with medical license verification.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Once onboarded, physicians receive a single-use cryptographic activation link to create their credentials securely.</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <Link
                  to="/activate"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  {t("Have an Activation Link? Activate Account")}
                </Link>
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                >
                  {t("Already Activated? Doctor Sign In")}
                </Link>
                <button
                  type="button"
                  onClick={() => setRoleTab("patient")}
                  className="w-full text-center py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  {t("← Return to Patient Registration")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Role Notice */}
              <div className="p-3.5 mb-5 rounded-xl bg-emerald-50/80 dark:bg-slate-800/60 border border-emerald-200/70 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-400 mb-1">
                  <User className="h-4 w-4 text-emerald-600" />
                  <span>{t("Patient Self-Registration Portal")}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  Patients can create accounts directly to access personal health records and appointments with hospital specialists.
                </p>
              </div>

              {/* Success Message */}
              {success ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400 mx-auto mb-4 animate-bounce" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Account Created Successfully!")}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                    Your patient account has been registered in the EHR system. Redirecting you to sign in...
                  </p>
                  <Link
                    to="/login?registered=true"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md shadow-emerald-700/20"
                  >
                    {t("Go to Sign In")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Full Name")}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/60 dark:text-emerald-400/60" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Priya Sharma"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

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
                    placeholder="priya@example.com"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Phone Number")} <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/60 dark:text-emerald-400/60" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Password")} <span className="text-slate-400 font-normal">(Min. 8 characters)</span>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Confirm Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/60 dark:text-emerald-400/60" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Explicit Consent Declaration */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer select-none">
                  I acknowledge this is an <strong>academic research prototype</strong> utilizing synthetic demonstration data, and consent to account processing per the{" "}
                  <Link to="/about" target="_blank" className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold">
                    {t("About & Clinical Ethics")}
                  </Link>.
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white shadow-lg bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span>{t("Creating Account...")}</span>
                ) : (
                  <>
                    <span>{t("Complete Patient Registration")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
          </>
        )}

          {/* Links */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
            <div>
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
              >
                {t("Already have an account?")} <span className="text-emerald-700 dark:text-emerald-400 font-bold underline">{t("Sign In")}</span>
              </Link>
            </div>
            <div>
              <Link
                to="/activate"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
              >
                <span>🔑 {t("Received an activation link from reception?")}</span>
                <span className="text-emerald-700 dark:text-emerald-400 underline font-medium">{t("Activate Account")}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Security & Ethical Footer */}
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