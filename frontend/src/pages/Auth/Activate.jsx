import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { KeyRound, Lock, CheckCircle2, AlertCircle, ArrowRight, Globe, Sun, Moon } from "lucide-react";
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
    if (!token) {
      setError("Activation token is required.");
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

    setError("");
    setIsLoading(true);

    try {
      await authApi.activatePatient(token, password);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login?activated=true");
      }, 2000);
    } catch (err) {
      setError(err?.message || "Failed to activate account. The token may be expired or already used.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 antialiased relative transition-colors">
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

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-600 shadow-xl shadow-emerald-700/20 text-white font-extrabold text-2xl mb-4">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("Account Activation")}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
          {t("Set your account password to complete registration.")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-emerald-100 dark:border-slate-800">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Success")}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-medium">
                {t("Your account has been successfully activated! Please log in.")}
              </p>
              <Link
                to="/login?activated=true"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
              >
                {t("Sign In")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Activation Token")}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    placeholder="Enter token provided by front desk"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Set Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Confirm Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span>{t("Activating Account...")}</span>
                ) : (
                  <>
                    <span>{t("Complete Account Activation")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors"
                >
                  {t("Already have an account?")} {t("Sign In")} →
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
