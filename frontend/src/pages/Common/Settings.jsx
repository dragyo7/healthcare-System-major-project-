import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/ui/Button";
import { useTheme } from "../../hooks/useTheme";
import { getDB, saveDB } from "../../services/mock/db";

export default function Settings() {
  const { isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("English");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const db = getDB();
    if (db.settings) {
      setNotifications(db.settings.notifications ?? true);
      setLanguage(db.settings.language || "English");
    }
  }, []);

  const handleSave = () => {
    const db = getDB();
    db.settings = {
      theme: isDark ? "dark" : "light",
      notifications,
      language,
    };
    saveDB(db);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl select-none animate-fadeIn">
      <PageHeader
        title="Account Preferences"
        subtitle="Manage theme settings and communication options."
      />

      <Card className="flex flex-col gap-6">
        {isSaved && (
          <div className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-400">
            Settings updated successfully.
          </div>
        )}

        {/* Theme Settings */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Dark Display Theme</h3>
            <p className="text-xs text-slate-500 mt-0.5">Toggle interface design mode.</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
              isDark ? "bg-primary-600" : "bg-slate-300"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                isDark ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        {/* Notification Settings */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Inbound Alerts</h3>
            <p className="text-xs text-slate-500 mt-0.5">Receive appointment and diagnostic alerts.</p>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
              notifications ? "bg-primary-600" : "bg-slate-300"
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                notifications ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        {/* Language Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-slate-900 dark:text-white">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full h-11 px-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl text-sm focus:outline-hidden"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
          </select>
        </div>

        <Button onClick={handleSave} className="mt-4">
          Save Settings
        </Button>
      </Card>
    </div>
  );
}
