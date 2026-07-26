import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ArrowLeft } from "lucide-react";
import Button from "../../components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 mb-6 border border-slate-200 dark:border-slate-800">
        <HelpCircle className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        404
      </h1>
      <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mt-2">
        Page Not Found
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs text-center leading-relaxed">
        The resource you are looking for has been relocated or doesn't exist.
      </p>
      <Link to="/" className="mt-8">
        <Button className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5" />
          Back to Home
        </Button>
      </Link>
    </div>
  );
}
