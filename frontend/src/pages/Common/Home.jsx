import React from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldCheck, Cpu, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import Button from "../../components/ui/Button";
import Card from "../../components/shared/Card";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/50 flex items-center justify-between px-4 lg:px-8 select-none shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
            MedAI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Main Landing Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-6">
            <ShieldCheck className="h-4 w-4" /> HIPAA Compliant Security
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-2xl leading-tight">
            Intelligent Health Diagnostics & Care
          </h1>
          
          <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 mt-4 max-w-xl leading-relaxed">
            MedAI unites advanced machine learning with clinical records to empower medical practitioners and patient self-care.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8 w-full">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-48">Access Patient Portal</Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-48">
                Access Clinician Portal
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left">
          <Card className="flex flex-col gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">AI Diagnostics</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Unlock automated health scans and smart recommendations in real time.
            </p>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Capacitor Native</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Optimized for Android device runtimes and seamless mobile interaction.
            </p>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Secure Storage</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your clinical history encrypted with Supabase client-side validation protocols.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
