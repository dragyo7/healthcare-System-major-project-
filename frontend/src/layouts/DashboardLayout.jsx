import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/shared/Logo";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { DOCTOR_NAV, PATIENT_NAV } from "../constants/navigation";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../contexts/AuthContext";
import { mockNotificationService } from "../services/mock/mockNotificationService";
import { mockPatientService } from "../services/mock/mockPatientService";
import { mockDoctorService } from "../services/mock/mockDoctorService";
import { getDB } from "../services/mock/db";
import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";

export default function DashboardLayout({ children, role = "patient" }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ patients: [], appointments: [], reports: [] });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigation = role === "doctor" ? DOCTOR_NAV : PATIENT_NAV;

  useEffect(() => {
    async function loadData() {
      if (user?.id) {
        const profService = role === "doctor" ? mockDoctorService : mockPatientService;
        const prof = await profService.getProfile(user.id);
        setProfile(prof);

        const notifs = await mockNotificationService.getNotifications(user.id);
        setNotifications(notifs);
        const count = await mockNotificationService.getUnreadCount(user.id);
        setUnreadCount(count);
      }
    }
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [user, role]);

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.LOGIN);
  };

  const handleMarkAsRead = async (id) => {
    await mockNotificationService.markAsRead(id);
    if (user?.id) {
      setNotifications(await mockNotificationService.getNotifications(user.id));
      setUnreadCount(await mockNotificationService.getUnreadCount(user.id));
    }
  };

  const handleMarkAllRead = async () => {
    if (user?.id) {
      await mockNotificationService.markAllAsRead(user.id);
      setNotifications(await mockNotificationService.getNotifications(user.id));
      setUnreadCount(0);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults({ patients: [], appointments: [], reports: [] });
      setIsSearchOpen(false);
      return;
    }

    const db = getDB();
    const queryLower = query.toLowerCase();

    const patients = Object.entries(db.profiles)
      .filter(([id, p]) => p.age !== undefined && p.name.toLowerCase().includes(queryLower))
      .map(([id, p]) => ({ id, name: p.name }));

    const appointments = db.appointments
      .filter(
        (a) =>
          (a.doctorId === user?.id || a.patientId === user?.id) &&
          (a.patientName.toLowerCase().includes(queryLower) ||
            a.doctorName.toLowerCase().includes(queryLower) ||
            a.reason.toLowerCase().includes(queryLower))
      );

    const reports = db.reports
      .filter((r) =>
        role === "doctor"
          ? r.title.toLowerCase().includes(queryLower)
          : r.patientId === user?.id && r.title.toLowerCase().includes(queryLower)
      );

    setSearchResults({ patients, appointments, reports });
    setIsSearchOpen(true);
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950">
      {isDesktop && (
        <aside className="w-64 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/50 flex flex-col sticky top-0 h-screen">
          <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
            <Logo />
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <Sidebar navigation={navigation} />
          </div>
        </aside>
      )}

      <AnimatePresence>
        {!isDesktop && isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="fixed top-0 bottom-0 left-0 w-72 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
                <Logo />
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <Sidebar navigation={navigation} onItemClick={() => setIsSidebarOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          isDesktop={isDesktop}
          onMenuClick={() => setIsSidebarOpen(true)}
          searchQuery={searchQuery}
          handleSearchChange={handleSearchChange}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          searchResults={searchResults}
          role={role}
          isDark={isDark}
          toggleTheme={toggleTheme}
          unreadCount={unreadCount}
          isNotifOpen={isNotifOpen}
          setIsNotifOpen={setIsNotifOpen}
          notifications={notifications}
          handleMarkAsRead={handleMarkAsRead}
          handleMarkAllRead={handleMarkAllRead}
          profile={profile}
          user={user}
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          handleLogout={handleLogout}
        />

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
