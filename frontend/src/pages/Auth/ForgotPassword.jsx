import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Info } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { validateEmail } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
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
    setSubmitted(true);
  };

  return (
    <AuthLayout
      title="Account Recovery"
      subtitle="Institutional password assistance and account support"
    >
      {submitted ? (
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
            <Info className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Institutional Account Recovery Notice
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              In this on-premises Clinical Decision Support prototype, automatic external email dispatch is disabled to protect patient privacy and system isolation.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              To reset your credentials for <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>, please present verification to the hospital front-desk receptionist or system administrator.
            </p>
          </div>
          <Link to={ROUTES.LOGIN} className="w-full mt-2">
            <Button variant="secondary" className="w-full">
              Return to Login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
            Self-service password recovery instructions for registered institutional accounts.
          </div>

          <Input
            id="email"
            label="Registered Email"
            type="email"
            placeholder="yourname@hospital.org"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit" className="w-full mt-2">
            Request Password Assistance
          </Button>

          <Link
            to={ROUTES.LOGIN}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
