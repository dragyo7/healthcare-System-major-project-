import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Calendar, AlertCircle, Sparkles, Pill, FileText, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useAuth } from "../../contexts/AuthContext";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await doctorApi.getDashboard();
        setData(res);
      } catch (err) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading Clinician Dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const todayAppointments = data?.today_appointments || [];
  const recentPatients = data?.recent_patients || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-indigo-950 text-white shadow-xl relative overflow-hidden border border-primary-800/40">
        <div className="space-y-1 z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 text-primary-200 text-xs font-semibold backdrop-blur-xs border border-primary-400/20">
            <Sparkles className="h-3.5 w-3.5 text-primary-300" />
            <span>Frozen RAG v2.10 • Deterministic Clinical Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome, Dr. {user?.name || "Bhumi Sharma"}
          </h1>
          <p className="text-xs sm:text-sm text-primary-100/80">
            Automated patient EHR dossiers, multi-drug safety screening, and evidence-grounded decision support.
          </p>
        </div>

        <div className="flex items-center gap-2 z-10 shrink-0">
          <Link
            to="/doctor/cds"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary-950 font-bold text-xs sm:text-sm shadow-md hover:bg-primary-50 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-primary-600" />
            <span>Open CDS Assistant</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Patients</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats.total_patients ?? recentPatients.length ?? 0}
          </div>
          <span className="text-[11px] text-slate-400">Registered hospital records</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Visits</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats.today_appointments ?? todayAppointments.length ?? 0}
          </div>
          <span className="text-[11px] text-slate-400">Scheduled consultations</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Prescriptions</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <Pill className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats.active_prescriptions ?? "12"}
          </div>
          <span className="text-[11px] text-slate-400">Screened for interactions</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Follow-ups</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {stats.pending_followups ?? "3"}
          </div>
          <span className="text-[11px] text-slate-400">Post-discharge reviews</span>
        </div>
      </div>

      {/* Two Column Layout: Today's Appointments & Recent Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-600" />
                <span>Today's Consultation Queue</span>
              </h2>
              <Link to="/doctor/appointments" className="text-xs font-semibold text-primary-600 hover:underline">
                View all →
              </Link>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No consultations scheduled for today.
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appt) => (
                  <div
                    key={appt.appointment_id || appt.id}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {appt.patient_name || `Patient #${appt.patient_id}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {appt.start_time} - {appt.end_time} • {appt.reason || "General Consultation"}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        appt.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}
                    >
                      {appt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/doctor/appointments"
              className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <span>Manage Doctor Appointments & Schedules</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent Patients */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-primary-600" />
                <span>Recent Clinical Records</span>
              </h2>
              <Link to="/doctor/patients" className="text-xs font-semibold text-primary-600 hover:underline">
                View all patients →
              </Link>
            </div>

            {recentPatients.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No recent patient records found.
              </div>
            ) : (
              <div className="space-y-3">
                {recentPatients.map((pat) => (
                  <div
                    key={pat.patient_id}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {pat.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Blood: {pat.blood_group || "—"} • Phone: {pat.phone || "—"}
                      </div>
                    </div>
                    <Link
                      to={`/doctor/patients?id=${pat.patient_id}`}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/60 px-3 py-1.5 rounded-lg border border-primary-200 dark:border-primary-900"
                    >
                      Open Dossier
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/doctor/patients"
              className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <span>Inspect All Patients & Complete Dossiers</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
