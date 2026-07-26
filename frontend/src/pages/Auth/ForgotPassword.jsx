import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { validateEmail } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    if (!validateEmail(email)) {
      setError("Invalid email format");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { error: authError } = await resetPassword(email);
      if (authError) throw authError;
      setIsSuccess(true);
    } catch (err) {
      setError(err?.message || "Failed to trigger recovery instructions.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="Password reset instructions have been dispatched"
      >
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We have sent a security link to <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>. Please click the link to configure a new password.
          </p>
          <Link to={ROUTES.LOGIN} className="w-full mt-2">
            <Button variant="secondary" className="w-full">
              Return to Login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email to receive a recovery link"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          id="email"
          label="Registered Email"
          type="email"
          placeholder="yourname@medai.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Send Recovery Link
        </Button>

        <Link
          to={ROUTES.LOGIN}
          className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mt-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
      </form>
    </AuthLayout>
  );
}
