import React from "react";
import LoadingSpinner from "./LoadingSpinner";
import Logo from "./Logo";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
      <Logo className="scale-110 mb-2" />
      <LoadingSpinner size="lg" />
    </div>
  );
}
