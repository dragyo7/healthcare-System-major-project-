import React, { useState, useEffect } from "react";
import { receptionistApi } from "../../api/receptionistApi";
import {
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Loader2,
  Filter,
} from "lucide-react";

export default function ReceptionistAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    patient_id: "",
    doctor_id: "",
    appointment_date: new Date().toISOString().split("T")[0],
    start_time: "10:00:00",
    reason: "General Consultation",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [apptList, patList, docList] = await Promise.all([
        receptionistApi.getAppointments(),
        receptionistApi.getPatients(),
        receptionistApi.getDoctors(),
      ]);
      setAppointments(apptList);
      setPatients(patList);
      setDoctors(docList);
      if (patList.length > 0 && !formData.patient_id) {
        setFormData((prev) => ({ ...prev, patient_id: patList[0].patient_id }));
      }
      if (docList.length > 0 && !formData.doctor_id) {
        setFormData((prev) => ({ ...prev, doctor_id: docList[0].doctor_id }));
      }
    } catch (err) {
      setError(err.message || "Failed to load appointments data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await receptionistApi.updateAppointmentStatus(appointmentId, newStatus);
      setAppointments((prev) =>
        prev.map((a) => (a.appointment_id === appointmentId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await receptionistApi.createAppointment({
        ...formData,
        patient_id: parseInt(formData.patient_id),
        doctor_id: parseInt(formData.doctor_id),
      });
      setShowModal(false);
      loadData();
    } catch (err) {
      setFormError(err.message || "Failed to schedule appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = appointments.filter((a) => {
    if (statusFilter === "all") return true;
    return (a.status || "").toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Consultation Scheduling & Appointment Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule doctor consultations, assign queue tokens, and coordinate patient visits.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Book New Consultation
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Requests Alert Banner */}
      {appointments.filter((a) => (a.status || "").toLowerCase() === "pending").length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            {appointments.filter((a) => (a.status || "").toLowerCase() === "pending").length} patient consultation request(s) awaiting administrative review.
          </span>
          <button
            onClick={() => setStatusFilter("pending")}
            className="ml-auto underline font-bold cursor-pointer hover:text-amber-900 dark:hover:text-amber-200"
          >
            Review Pending Queue
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </span>
        {["all", "pending", "confirmed", "scheduled", "completed", "cancelled", "rejected"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-semibold uppercase text-[11px] transition cursor-pointer ${
              statusFilter === st
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground ml-2">Loading appointments...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No consultations registered under this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Booking ID</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Physician</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Clinical Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-muted/20 transition">
                    <td className="py-3 px-4 font-mono font-bold text-primary">#{a.appointment_id}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {a.patient_name || `Patient #${a.patient_id}`}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      Dr. {a.doctor_name || "Specialist"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {a.appointment_date ? new Date(a.appointment_date).toLocaleDateString() : ""} at {a.start_time || "10:00"}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">{a.reason || "General Consult"}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.status === "confirmed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" :
                        a.status === "scheduled" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30" :
                        a.status === "pending" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30" :
                        a.status === "completed" ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30" :
                        a.status === "cancelled" || a.status === "rejected" ? "bg-destructive/15 text-destructive border border-destructive/30" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {a.status || "scheduled"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {(a.status || "").toLowerCase() === "pending" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(a.appointment_id, "confirmed")}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition shadow-xs cursor-pointer"
                            title="Approve and confirm consultation"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatusChange(a.appointment_id, "rejected")}
                            className="px-2.5 py-1 rounded bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 dark:text-rose-400 font-semibold text-[11px] transition cursor-pointer"
                            title="Reject consultation request"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {["scheduled", "confirmed"].includes((a.status || "").toLowerCase()) && (
                        <>
                          <button
                            onClick={() => handleStatusChange(a.appointment_id, "completed")}
                            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-semibold text-[11px] transition cursor-pointer"
                            title="Mark completed"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleStatusChange(a.appointment_id, "cancelled")}
                            className="px-2 py-1 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-[11px] transition cursor-pointer"
                            title="Cancel appointment"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {["completed", "cancelled", "rejected"].includes((a.status || "").toLowerCase()) && (
                        <span className="text-[11px] text-muted-foreground italic">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
        >
          {/* Dedicated backdrop layer behind dialog */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowModal(false)}
            aria-hidden="true"
          />

          {/* Opaque readable dialog surface rendered above backdrop */}
          <div className="relative z-10 w-full max-w-lg my-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 id="booking-modal-title" className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Schedule Consultation Appointment
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Select Patient *
                </label>
                <select
                  required
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {patients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.full_name || p.name} (#{p.patient_id}) - {p.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Select Physician *
                </label>
                <select
                  required
                  value={formData.doctor_id}
                  onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {doctors.map((d) => (
                    <option key={d.doctor_id} value={d.doctor_id}>
                      Dr. {d.name} ({d.specialization || "Clinical Specialist"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Appointment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Consultation Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Clinical Reason / Chief Complaint
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow-up consultation, Routine BP check"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
