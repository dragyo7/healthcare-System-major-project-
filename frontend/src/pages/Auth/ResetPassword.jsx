import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { authApi } from "../../api/authApi";
import { validatePassword } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        if (isMounted) {
          setTokenError("No password reset authorization token provided. Please request a new recovery link.");
          setIsVerifying(false);
        }
        return;
      }

      try {
        const res = await authApi.verifyResetToken(token);
        if (isMounted) {
          if (res && res.valid) {
            setTokenValid(true);
          } else {
            setTokenError(res?.message || "Password reset token is invalid or has expired.");
          }
        }
      } catch (err) {
        if (isMounted) {
          setTokenError(err?.message || "This password reset token is invalid, expired, or has already been used.");
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    checkToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      setError(err?.message || "Failed to update password. The authorization token may have expired.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Your password has been successfully reset"
      >
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your credentials have been securely updated in the institutional directory. You can now log in using your new password.
          </p>
          <Button onClick={() => navigate(ROUTES.LOGIN)} className="w-full mt-2">
            Proceed to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (isVerifying) {
    return (
      <AuthLayout
        title="Verifying Authorization"
        subtitle="Validating single-use cryptographic security token..."
      >
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-slate-500">Checking token authenticity...</p>
        </div>
      </AuthLayout>
    );
  }

  if (tokenError || !tokenValid) {
    return (
      <AuthLayout
        title="Authorization Invalid"
        subtitle="Password recovery link is no longer valid"
      >
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {tokenError || "Invalid Token"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              For security, password reset tokens are single-use and expire within 60 minutes.
            </p>
          </div>
          <Link to="/forgot-password" className="w-full mt-2">
            <Button variant="primary" className="w-full">
              Request New Reset Link
            </Button>
          </Link>
          <Link
            to={ROUTES.LOGIN}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Configure a secure new password for your account"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          id="new-password"
          label="New Password"
          type="password"
          placeholder="••••••••"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Input
          id="confirm-password"
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          icon={Lock}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Update Password
        </Button>
      </form>
    </AuthLayout>
  );
}
