import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar({ navigation, onItemClick }) {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1.5 p-4">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={`flex items-center gap-3.5 px-4 h-12 rounded-xl text-sm font-semibold transition-all select-none active:scale-[0.98] ${
              isActive
                ? "bg-primary-600 text-white shadow-md shadow-primary-500/10"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
