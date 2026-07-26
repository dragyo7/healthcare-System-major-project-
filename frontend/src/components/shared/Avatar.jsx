import React from "react";

export default function Avatar({ src, alt, name = "", size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400 font-semibold overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {src ? (
        <img src={src} alt={alt || name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
