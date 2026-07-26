import React from "react";
import Card from "./Card";

export default function StatCard({ title, value, icon: Icon, description, trend }) {
  return (
    <Card className="flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </span>
        {description && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </div>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
    </Card>
  );
}
