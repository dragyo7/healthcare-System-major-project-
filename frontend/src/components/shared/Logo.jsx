import React from "react";
import { Activity } from "lucide-react";

export default function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md shadow-primary-500/10">
        <Activity className="h-5 w-5" />
      </div>
      <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
        MedAI
      </span>
    </div>
  );
}
