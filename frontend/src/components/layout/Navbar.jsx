import React from "react";
import { Link } from "react-router-dom";
import { Menu, Bell, Search, LogOut, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../shared/Avatar";

export default function Navbar({
  isDesktop,
  onMenuClick,
  searchQuery,
  handleSearchChange,
  isSearchOpen,
  setIsSearchOpen,
  searchResults,
  role,
  isDark,
  toggleTheme,
  unreadCount,
  isNotifOpen,
  setIsNotifOpen,
  notifications,
  handleMarkAsRead,
  handleMarkAllRead,
  profile,
  user,
  isProfileOpen,
  setIsProfileOpen,
  handleLogout,
}) {
  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/50 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {!isDesktop && (
          <button
            onClick={onMenuClick}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="relative max-w-xs hidden sm:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-10 pl-10 pr-4 w-60 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:border-primary-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900/50 dark:focus:bg-slate-900"
          />
          <AnimatePresence>
            {isSearchOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSearchOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-40 flex flex-col gap-2 max-h-80 overflow-y-auto"
                >
                  {searchResults.patients.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Patients</p>
                      <div className="flex flex-col gap-1">
                        {searchResults.patients.map((p) => (
                          <Link
                            key={p.id}
                            to="/doctor/patients"
                            onClick={() => setIsSearchOpen(false)}
                            className="text-xs text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 p-1 rounded-sm block"
                          >
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.appointments.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Appointments</p>
                      <div className="flex flex-col gap-1">
                        {searchResults.appointments.map((a) => (
                          <Link
                            key={a.id}
                            to={`/${role}/appointments`}
                            onClick={() => setIsSearchOpen(false)}
                            className="text-xs text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 p-1 rounded-sm block"
                          >
                            {role === "doctor" ? a.patientName : a.doctorName} - {a.date}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.reports.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Reports</p>
                      <div className="flex flex-col gap-1">
                        {searchResults.reports.map((r) => (
                          <Link
                            key={r.id}
                            to="/patient/records"
                            onClick={() => setIsSearchOpen(false)}
                            className="text-xs text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 p-1 rounded-sm block"
                          >
                            {r.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.patients.length === 0 &&
                    searchResults.appointments.length === 0 &&
                    searchResults.reports.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-2">No results found</p>
                    )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 h-4 w-4 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900">
                {unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-40 flex flex-col gap-2 max-h-96 overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-950 dark:text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-bold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No notifications yet</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id)}
                          className={`p-2 rounded-xl text-left cursor-pointer transition-colors ${
                            n.read
                              ? "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/30 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <p className="text-xs font-bold text-slate-950 dark:text-white flex justify-between items-center">
                            <span>{n.title}</span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary-600" />}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Avatar name={profile?.name || user?.name || "User"} src={profile?.avatar} size="sm" />
          </button>
          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-40 flex flex-col gap-1"
                >
                  <Link
                    to={`/${role}/profile`}
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center px-4 h-11 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50 transition-colors select-none"
                  >
                    Edit Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors select-none"
                  >
                    <LogOut className="h-5 w-5" />
                    Log Out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
