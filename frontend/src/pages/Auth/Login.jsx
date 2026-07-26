import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { validateEmail } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [error, setError] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("medai_remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "true") {
      setSuccessMessage("Your email has been verified successfully. You can now sign in.");
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (!validateEmail(email)) {
      setError("Invalid email format");
      return;
    }
    
    setError("");
    setSuccessMessage("");
    setResendSuccess("");
    setShowResend(false);
    setIsLoading(true);

    try {
      const { error: authError, data } = await signIn(email, password);
      if (authError) throw authError;

      if (rememberMe) {
        localStorage.setItem("medai_remembered_email", email);
      } else {
        localStorage.removeItem("medai_remembered_email");
      }

      const userRole = data?.user?.role || "patient";
      if (userRole === "doctor") {
        navigate(ROUTES.DOCTOR_DASHBOARD);
      } else {
        navigate(ROUTES.PATIENT_DASHBOARD);
      }
    } catch (err) {
      const errMsg = err?.message || "Authentication failed. Please verify credentials.";
      setError(errMsg);
      if (errMsg.toLowerCase().includes("verify your email") || errMsg.toLowerCase().includes("email not confirmed")) {
        setShowResend(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    setResendLoading(true);
    setResendSuccess("");
    try {
      const { error: resendErr } = await resendVerification(email);
      if (resendErr) throw resendErr;
      setResendSuccess("Verification email has been resent successfully!");
      setError("");
      setShowResend(false);
    } catch (err) {
      setError(err?.message || "Failed to resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your secure healthcare portal"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400 flex flex-col gap-2">
            <span>{error}</span>
            {showResend && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="text-left text-xs font-bold underline hover:text-red-800 dark:hover:text-red-300 cursor-pointer self-start"
              >
                {resendLoading ? "Resending..." : "Resend Verification Email"}
              </button>
            )}
          </div>
        )}

        {resendSuccess && (
          <div className="rounded-xl bg-green-50 p-3.5 text-sm font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {resendSuccess}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl bg-green-50 p-3.5 text-sm font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400">
            {successMessage}
          </div>
        )}

        <Input
          id="email"
          label="Email Address"
          type="email"
          placeholder="doctor@medai.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="relative">
          <Input
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-[38px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded-sm border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Remember me
            </span>
          </label>
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Sign In
        </Button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4 select-none">
          Don't have an account?{" "}
          <Link
            to={ROUTES.SIGNUP}
            className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            Create Account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}