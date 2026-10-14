import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { patientApi } from "../../api/patientApi";
import {
  FileText,
  AlertOctagon,
  Calendar,
  Clock,
  User,
  Bot,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

export default function PatientDischarge() {
  const [discharge, setDischarge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDischarge() {
      try {
        const res = await patientApi.getDischarge();
        setDischarge(res);
      } catch (err) {
        setError(err.message || "Failed to load discharge care guidelines.");
      } finally {
        setLoading(false);
      }
    }
    loadDischarge();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading post-discharge care guidelines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!discharge) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-base font-bold text-foreground">No Hospital Discharge Records</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          There are currently no active inpatient discharge directives recorded in your electronic medical record.
          If you were recently discharged, please contact your care team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Post-Discharge Care & Recovery
          </h1>
          <p className="text-sm text-muted-foreground">
            Treating Physician: Dr. {discharge.doctor_name || "Specialist"} ({discharge.specialization || "Clinical Care"})
          </p>
        </div>
        <Link
          to="/patient/assistant"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm w-fit"
        >
          <Bot className="w-4 h-4" />
          Ask Assistant About This Plan
        </Link>
      </div>

      {/* Critical Red Warning Banner */}
      {discharge.warning_signs && (
        <div className="p-5 rounded-xl bg-rose-500/10 border-2 border-rose-500/30 text-foreground space-y-2">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            Critical Red-Flag Symptoms — Seek Immediate Emergency Care
          </div>
          <p className="text-xs font-medium text-rose-950 dark:text-rose-200 leading-relaxed">
            {discharge.warning_signs}
          </p>
        </div>
      )}

      {/* Main Discharge Details Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episode Primary Diagnosis</span>
            <h2 className="text-lg font-bold text-primary mt-0.5">{discharge.diagnosis}</h2>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Discharge Status: {discharge.status || "Finalized"}
          </span>
        </div>

        {/* Timelines Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/40 text-xs">
          <div>
            <p className="text-muted-foreground font-semibold uppercase text-[11px]">Admission Date</p>
            <p className="font-bold text-foreground mt-0.5">
              {discharge.admission_date ? new Date(discharge.admission_date).toLocaleDateString() : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold uppercase text-[11px]">Discharge Date</p>
            <p className="font-bold text-foreground mt-0.5">
              {discharge.discharge_date ? new Date(discharge.discharge_date).toLocaleDateString() : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold uppercase text-[11px]">Follow-up Scheduled</p>
            <p className="font-bold text-foreground mt-0.5">
              {discharge.follow_up_date ? new Date(discharge.follow_up_date).toLocaleDateString() : "As directed"}
            </p>
          </div>
        </div>

        {/* Clinical Summary */}
        {discharge.discharge_summary && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Clinical Inpatient Course & Summary
            </h3>
            <div className="p-4 rounded-lg bg-background border border-border text-xs text-foreground leading-relaxed">
              {discharge.discharge_summary}
            </div>
          </div>
        )}

        {/* Patient Instructions */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Patient Home Care Instructions (Activity, Nutrition & Recovery)
          </h3>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground leading-relaxed font-medium">
            {discharge.discharge_instructions}
          </div>
        </div>

        {/* Follow-up Guidelines */}
        {discharge.follow_up_instructions && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Follow-up Directives & Laboratory Orders
            </h3>
            <div className="p-4 rounded-lg bg-background border border-border text-xs text-foreground leading-relaxed">
              {discharge.follow_up_instructions}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
