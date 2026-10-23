import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { KeyRound, Lock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { authApi } from "../../api/authApi";

export default function Activate() {
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/70 via-teal-50/50 to-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-600 shadow-xl shadow-emerald-700/20 text-white font-extrabold text-2xl mb-4">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Activate Patient Account
        </h1>
        <p className="mt-2 text-sm text-slate-600 font-medium">
          Verify your one-time activation token and set a secure password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-emerald-100">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto mb-4 animate-bounce" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Account Successfully Activated!</h2>
              <p className="text-sm text-slate-600 mb-6 font-medium">
                Your credentials have been securely stored. Redirecting you to the patient login...
              </p>
              <Link
                to="/login?activated=true"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
              >
                Go to Login Now <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Activation Token
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    placeholder="Enter token provided by front desk"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Set New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <span>Verifying Token...</span>
                ) : (
                  <>
                    <span>Activate Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-slate-100 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  Already have an active account? Sign In →
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
