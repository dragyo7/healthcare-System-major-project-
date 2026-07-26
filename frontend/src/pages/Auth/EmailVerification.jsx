import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MailOpen, ArrowLeft, CheckCircle } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES } from "../../constants/routes";

export default function EmailVerification() {
  const location = useLocation();
  const { resendVerification } = useAuth();
  
  const initialEmail = location.state?.email || "";
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to resend the verification link");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: resendError } = await resendVerification(email);
      if (resendError) throw resendError;
      setMessage("Verification email has been resent successfully!");
    } catch (err) {
      setError(err?.message || "Failed to resend verification email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Verify Your Email"
      subtitle="We've sent a verification email to your inbox"
    >
      <div className="flex flex-col gap-6 select-none animate-fadeIn">
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-green-50 p-3.5 text-sm font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {message}
          </div>
        )}

        <div className="flex justify-center my-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400">
            <MailOpen className="h-8 w-8 animate-bounce" />
          </div>
        </div>

        <div className="text-center flex flex-col gap-3">
          {email && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Verification email sent to{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {email}
              </span>
            </p>
          )}

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-center">
            Click the verification link in your email to activate your account. Once verified, return here and sign in.
          </p>
        </div>

        {!initialEmail && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-hidden focus:border-primary-500 dark:bg-slate-900/50 dark:border-slate-800 dark:text-white text-sm"
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-3 mt-2">
          <Button
            type="button"
            onClick={handleResend}
            isLoading={isLoading}
            className="w-full"
          >
            Resend Verification Email
          </Button>

          <Link
            to={ROUTES.LOGIN}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
