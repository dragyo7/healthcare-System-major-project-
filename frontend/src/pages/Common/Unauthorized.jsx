import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Button from "../../components/ui/Button";

export default function Unauthorized() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 mb-6 border border-red-100 dark:border-red-900/30">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Access Denied
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
        You do not possess the required credentials to access this page. Please contact administration if you believe this is in error.
      </p>
      <Link to="/" className="mt-8">
        <Button className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5" />
          Back to Safety
        </Button>
      </Link>
    </div>
  );
}
