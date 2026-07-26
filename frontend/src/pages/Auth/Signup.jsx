import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, UserCheck, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";
import AuthLayout from "../../components/layout/AuthLayout";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { validateEmail, validatePassword } from "../../utils/validators";
import { ROUTES } from "../../constants/routes";

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient"); // 'patient' or 'doctor'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (!validateEmail(email)) {
      setError("Invalid email format");
      return;
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { error: authError } = await signUp(email, password, {
        name,
        role,
      });
      if (authError) throw authError;

      // Navigate to verification state, passing email state
      navigate(ROUTES.VERIFY_EMAIL, { state: { email } });
    } catch (err) {
      setError(err?.message || "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register to start your digital healthcare journey"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          id="name"
          label="Full Name"
          type="text"
          placeholder="Dr. John Doe / Sarah Parker"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          id="email"
          label="Email Address"
          type="email"
          placeholder="yourname@medai.com"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* Role Selector */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
            I am a
          </label>
          <div className="relative flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {/* Sliding Highlight */}
            <motion.div
              layoutId="roleHighlight"
              className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-950 shadow-xs pointer-events-none"
              style={{
                width: "calc(50% - 4px)",
                left: role === "patient" ? "4px" : "calc(50%)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <button
              type="button"
              onClick={() => setRole("patient")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg z-10 transition-colors duration-200 ${
                role === "patient"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Patient
            </button>
            <button
              type="button"
              onClick={() => setRole("doctor")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg z-10 transition-colors duration-200 ${
                role === "doctor"
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Stethoscope className="h-4 w-4" />
              Doctor
            </button>
          </div>
        </div>

        <Button type="submit" isLoading={isLoading} className="w-full mt-3">
          Create Account
        </Button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3 select-none">
          Already have an account?{" "}
          <Link
            to={ROUTES.LOGIN}
            className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            Log In
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}