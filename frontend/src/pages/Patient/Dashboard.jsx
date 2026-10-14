import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { patientApi } from "../../api/patientApi";
import { useAuth } from "../../contexts/AuthContext";
import {
  FileText,
  Calendar,
  Pill,
  Bot,
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await patientApi.getDashboard();
        setDashboard(res);
      } catch (err) {
        setError(err.message || "Failed to load patient dashboard.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading patient health overview...</p>
      </div>
    );
  }

  const activeDischarge = dashboard?.active_discharge;
  const appointments = dashboard?.upcoming_appointments || [];
  const prescriptions = dashboard?.recent_prescriptions || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome, {dashboard?.patient_name || user?.name || "Patient"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Personal Health Overview & Post-Discharge Care Summary
          </p>
        </div>
        <Link
          to="/patient/assistant"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm w-fit"
        >
          <Bot className="w-4 h-4" />
          Ask Post-Discharge Assistant
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Emergency Advisory Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-700 dark:text-amber-400">
            Medical Advisory & Emergency Notice
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This platform is an AI-augmented decision support assistant grounded in clinical guidelines.
            If you experience severe chest tightness, sudden shortness of breath, severe dizziness, or confusion,
            immediately dial <strong>108 / 112</strong> or proceed to the nearest emergency room.
          </p>
        </div>
      </div>

      {/* Active Discharge Alert */}
      {activeDischarge ? (
        <div className="rounded-xl border-l-4 border-l-primary border-t border-r border-b border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Active Discharge Episode Follow-up
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Discharged on {activeDischarge.discharge_date ? new Date(activeDischarge.discharge_date).toLocaleDateString() : "Recent"}
            </span>
          </div>

          <p className="text-sm text-foreground">
            <strong>Diagnosis:</strong> {activeDischarge.diagnosis}
          </p>

          <div className="p-3 rounded-lg bg-muted/60 text-xs text-foreground space-y-1">
            <p className="font-semibold text-muted-foreground">Primary Care Instructions:</p>
            <p className="line-clamp-2">{activeDischarge.discharge_instructions}</p>
          </div>

          {activeDischarge.follow_up_date && (
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Follow-up Scheduled: {new Date(activeDischarge.follow_up_date).toLocaleDateString()}
              {activeDischarge.follow_up_instructions && ` (${activeDischarge.follow_up_instructions})`}
            </p>
          )}

          <div className="pt-2">
            <Link
              to="/patient/discharge"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              View Full Discharge Directives & Warning Signs
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground text-center">
          No hospital discharge records currently found for your patient profile.
        </div>
      )}

      {/* Two Column Grid: Appointments & Prescriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appointments */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Upcoming Clinical Appointments
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
              {appointments.length}
            </span>
          </div>

          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((app, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/60 bg-background flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">Dr. {app.doctor_name}</p>
                    <p className="text-muted-foreground">{app.specialization || "Clinical Consultation"}</p>
                    <p className="text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-primary" />
                      {app.appointment_date ? new Date(app.appointment_date).toLocaleDateString() : ""} at {app.start_time || "Scheduled"}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[11px] font-semibold uppercase ${
                    app.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                    app.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {app.status || "confirmed"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No upcoming appointments scheduled.
            </p>
          )}
        </div>

        {/* Prescriptions */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              Active Medication & Prescriptions
            </h3>
            <Link to="/patient/prescriptions" className="text-xs text-primary hover:underline font-semibold">
              View All ({prescriptions.length})
            </Link>
          </div>

          {prescriptions.length > 0 ? (
            <div className="space-y-3">
              {prescriptions.slice(0, 3).map((rx, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/60 bg-background flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{rx.diagnosis || "Medical Consultation"}</p>
                    <p className="text-muted-foreground">Prescribed by Dr. {rx.doctor_name || "Physician"}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Date: {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : "Recent"}
                    </p>
                  </div>
                  <Link
                    to="/patient/prescriptions"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="View Rx details"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No active prescription records found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
