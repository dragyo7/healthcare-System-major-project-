import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { authApi } from "../../api/authApi";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Activate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError(t("Please enter your activation token."));
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
      await authApi.activateAccount({
        token: token.trim(),
        password,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/login?activated=true");
      }, 1800);
    } catch (err) {
      setError(err?.message || t("Activation failed. The token may be expired or invalid."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-bg min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative transition-colors text-slate-800 dark:text-slate-100 antialiased">
      {/* Top Floating Controls */}
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
        {/* Left Welcome Panel */}
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
              {t("CRYPTOGRAPHIC SECURITY")}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-['Manrope'] text-white leading-[1.08] mb-5">
              {t("Activate Your Account")}
              <span className="text-[#64e6ae]">.</span>
            </h1>
            <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed mb-8">
              {t(
                "Secure single-use cryptographic token activation for provisioned healthcare practitioners, administrative staff, and patients."
              )}
            </p>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Single-use SHA-256 activation tokens")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Role-based cryptographic security")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-emerald-50">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[#c6ffe1] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{t("Zero pre-set passwords or shared accounts")}</span>
              </div>
            </div>
          </div>

          <div className="orb-decor orb-large-emerald" />
          <div className="orb-decor orb-small-emerald" />

          <div className="relative z-10 flex items-center gap-2.5 text-xs text-emerald-100/80 pt-4">
            <span className="pulse-dot-indicator" />
            <span>{t("A unified platform built around your care")}</span>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className="flex flex-col items-center justify-center p-2 sm:p-4">
          <div className="form-card-glass">
            <div className="mb-6 text-left">
              <span className="inline-block text-[10px] font-bold tracking-[1.6px] text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                {t("SECURE ENCOUNTER")}
              </span>
              <h2 className="text-2xl font-bold font-['Manrope'] text-slate-900 dark:text-white tracking-tight">
                {t("Activate Your Account")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {t("Enter your cryptographic activation token to establish your permanent password.")}
              </p>
            </div>

            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{t("Account activated successfully! Redirecting to login...")}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Activation Token")}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    placeholder="act_sec_..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Create Password")} <span className="text-[10px] text-slate-400 font-normal">({t("Min. 8 characters")})</span>
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Confirm Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="submit-btn-emerald mt-4"
              >
                {isLoading ? (
                  <span>{t("Activating Account...")}</span>
                ) : (
                  <span>
                    {t("Activate Account")} ↗
                  </span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs">
              <Link
                to="/login"
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
              >
                ← {t("Back to Sign In")}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
