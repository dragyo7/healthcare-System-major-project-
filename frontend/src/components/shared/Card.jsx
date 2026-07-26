import React from "react";
import { twMerge } from "tailwind-merge";

export default function Card({ children, className = "" }) {
  return (
    <div
      className={twMerge(
        "rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-md p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 dark:shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}
