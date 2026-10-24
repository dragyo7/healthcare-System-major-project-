import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Sun, Moon, Menu, X, Shield, Sparkles, Globe } from "lucide-react";
import { DOCTOR_NAV, PATIENT_NAV, RECEPTIONIST_NAV } from "../constants/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";
import Sidebar from "../components/layout/Sidebar";

export default function DashboardLayout({ children, role }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentRole = role || user?.role || "doctor";
  let navigation = DOCTOR_NAV;
  let workspaceTitle = "Clinician Workspace";
  let badgeColor = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  let roleIcon = "🩺";

  if (currentRole === "patient") {
    navigation = PATIENT_NAV;
    workspaceTitle = "Patient Care Portal";
    badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    roleIcon = "🏥";
  } else if (currentRole === "receptionist") {
    navigation = RECEPTIONIST_NAV;
    workspaceTitle = "Administrative Front Desk";
    badgeColor = "bg-purple-500/10 text-purple-600 border-purple-500/20";
    roleIcon = "📋";
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col antialiased text-slate-800 dark:text-slate-100">
      {/* Top Application Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {!isDesktop && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5 select-none">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20 text-base">
              CDSS
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                CDSS Healthcare
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Clinical Intelligence Platform
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center ml-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
              <span>{roleIcon}</span>
              <span>{t(workspaceTitle)}</span>
            </span>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {user?.name || user?.full_name || t("Authorized User")}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {user?.email || (user?.role ? `${user.role.toUpperCase()} Session` : "")}
            </span>
          </div>

          {/* Visible Multilingual Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-xs" title={t("Select Platform Language")}>
            <Globe className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-hidden"
              aria-label="Interface Language"
            >
              <option value="en" className="text-slate-900">EN (English)</option>
              <option value="hi" className="text-slate-900">हिन्दी (Hindi)</option>
              <option value="mr" className="text-slate-900">मराठी (Marathi)</option>
              <option value="gu" className="text-slate-900">ગુજરાતી (Gujarati)</option>
            </select>
          </div>

          <button
            onClick={toggleTheme}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title={t("Toggle theme")}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
            title={t("Sign out of current session")}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("Sign Out")}</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        {isDesktop && (
          <aside className="w-64 border-r border-slate-200/80 bg-white/60 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60 shrink-0 flex flex-col justify-between overflow-y-auto">
            <Sidebar navigation={navigation} />
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col gap-1 items-center justify-center">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>{t("Clinical Safety Checks Enabled")}</span>
              </div>
              <Link to="/about" className="text-primary-600 dark:text-primary-400 hover:underline font-medium text-[11px]">
                {t("About & Healthcare Ethics")}
              </Link>
            </div>
          </aside>
        )}

        {/* Mobile Sidebar Overlay */}
        {!isDesktop && isSidebarOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="relative w-64 max-w-xs bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between z-50 p-2">
              <div>
                <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-400">
                    {t(workspaceTitle)}
                  </span>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Sidebar navigation={navigation} onItemClick={() => setIsSidebarOpen(false)} />
              </div>
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                Express Port 5000 Active
              </div>
            </div>
          </div>
        )}

        {/* Workspace Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
