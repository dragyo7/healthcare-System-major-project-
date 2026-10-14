import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

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
      setSuccessMessage("Your patient account has been successfully activated! Please log in.");
      setRole("patient");
      setEmail("aarav@gmail.com");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 shadow-xl shadow-primary-500/20 text-white font-extrabold text-2xl mb-4">
          CDSS
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Clinical Decision Support
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Unified Healthcare Platform • Role-Based Authentication
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-800">
          {/* Role Selection Tabs */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mb-6 border border-slate-700/60">
            <button
              type="button"
              onClick={() => handleRoleChange("doctor")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                role === "doctor"
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🩺</span>
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("patient")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                role === "patient"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🏥</span>
              <span>Patient</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("receptionist")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                role === "receptionist"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📋</span>
              <span>Receptionist</span>
            </button>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                role === "doctor"
                  ? "bg-primary-600 hover:bg-primary-500 shadow-primary-600/30"
                  : role === "patient"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
              }`}
            >
              {isLoading ? (
                <span>Authenticating with Express...</span>
              ) : (
                <>
                  <span>Sign In as {role.charAt(0).toUpperCase() + role.slice(1)}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Verified Synthetic Demo Accounts
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange("doctor")}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-primary-400">🩺 Doctor</div>
                <div className="text-slate-400 truncate">doctor@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("patient")}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-emerald-400">🏥 Patient</div>
                <div className="text-slate-400 truncate">aarav@gmail.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("receptionist")}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left text-[11px] transition-colors cursor-pointer"
              >
                <div className="font-bold text-purple-400">📋 Receptionist</div>
                <div className="text-slate-400 truncate">receptionist@...</div>
              </button>
            </div>
          </div>

          {/* Patient Activation Link */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <Link
              to="/activate"
              className="text-xs font-semibold text-slate-400 hover:text-primary-400 transition-colors inline-flex items-center gap-1.5"
            >
              <span>🔑 Received an activation link from reception?</span>
              <span className="text-primary-400 underline">Activate Account</span>
            </Link>
          </div>
        </div>

        {/* Security Invariant Footer */}
        <div className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Server-Side RBAC • Express Gateway Port 5000</span>
        </div>
      </div>
    </div>
  );
}