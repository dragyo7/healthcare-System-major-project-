import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { validatePassword } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

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
      const { error: authError } = await updatePassword(password);
      if (authError) throw authError;
      setIsSuccess(true);
    } catch (err) {
      setError(err?.message || "Failed to update password.");
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
            You can now log in using your new credentials.
          </p>
          <Button onClick={() => navigate(ROUTES.LOGIN)} className="w-full mt-2">
            Proceed to Login
          </Button>
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
