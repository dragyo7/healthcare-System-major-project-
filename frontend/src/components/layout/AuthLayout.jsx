import React from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 overflow-hidden select-none bg-slate-50 dark:bg-slate-950">
      {/* Premium Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-primary-500/10 dark:bg-primary-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-secondary-500/10 dark:bg-secondary-500/5 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo/Branding */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center mb-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-500/20 mb-3">
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            MedAI Platform
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Intelligent Health Solutions
          </p>
        </motion.div>

        {/* Card Component */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="w-full border border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-100/40 rounded-2xl p-8 dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-none"
        >
          {title && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </motion.div>
      </div>
    </div>
  );
}
