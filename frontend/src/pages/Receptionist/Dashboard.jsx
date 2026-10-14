import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { receptionistApi } from "../../api/receptionistApi";
import {
  Users,
  Calendar,
  Activity,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Loader2,
} from "lucide-react";

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState({
    patients: 0,
    doctors: 0,
    appointments: 0,
    scheduledCount: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [patList, docList, apptList] = await Promise.all([
          receptionistApi.getPatients(),
          receptionistApi.getDoctors(),
          receptionistApi.getAppointments(),
        ]);

        const scheduled = apptList.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;
        setStats({
          patients: patList.length,
          doctors: docList.length,
          appointments: apptList.length,
          scheduledCount: scheduled,
        });
        setRecentAppointments(apptList.slice(0, 5));
      } catch (err) {
        setError(err.message || "Failed to load front desk operational metrics.");
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
        <p className="text-sm text-muted-foreground">Loading front desk operations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Front Desk Operations Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Administrative intake, patient account provisioning, physician rosters, and appointment coordination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/receptionist/patients"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Intake New Patient
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/receptionist/patients"
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition group"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Total Patients</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.patients}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition">
            Manage directory & accounts <ArrowRight className="w-3 h-3" />
          </p>
        </Link>

        <Link
          to="/receptionist/doctors"
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition group"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Active Physicians</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.doctors}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-emerald-600 transition">
            View OPD schedules & rosters <ArrowRight className="w-3 h-3" />
          </p>
        </Link>

        <Link
          to="/receptionist/appointments"
          className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition group"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Total Bookings</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.appointments}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-sky-600 transition">
            Review all bookings <ArrowRight className="w-3 h-3" />
          </p>
        </Link>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Pending In Queue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.scheduledCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Ready for clinician consultation</p>
        </div>
      </div>

      {/* Recent Appointments Queue Table */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Recent Consultation Queue
          </h3>
          <Link to="/receptionist/appointments" className="text-xs text-primary hover:underline font-semibold">
            View Full Queue →
          </Link>
        </div>

        {recentAppointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Doctor</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentAppointments.map((app, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition">
                    <td className="py-2.5 px-3 font-semibold text-foreground">
                      {app.patient_name || `Patient #${app.patient_id}`}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      Dr. {app.doctor_name || "Physician"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {app.appointment_date ? new Date(app.appointment_date).toLocaleDateString() : ""} {app.start_time || ""}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{app.reason || "General Checkup"}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        app.status === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                        app.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {app.status || "scheduled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No consultations registered in the queue yet.
          </p>
        )}
      </div>
    </div>
  );
}
