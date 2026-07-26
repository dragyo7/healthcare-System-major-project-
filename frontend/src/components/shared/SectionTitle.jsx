import React from "react";

export default function SectionTitle({ children }) {
  return (
    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
      {children}
    </h2>
  );
}
