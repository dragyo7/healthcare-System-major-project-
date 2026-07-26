import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <Loader2
        className={`animate-spin text-primary-600 dark:text-primary-400 ${sizeClasses[size]} ${className}`}
      />
    </div>
  );
}
