import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building,
  PlusCircle,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import { patientApi } from "../../api/patientApi";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PatientAppointments() {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [specialityFilter, setSpecialityFilter] = useState("all");

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancellation State
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [docList, appList] = await Promise.all([
        patientApi.getDoctors(),
        patientApi.getAppointments(),
      ]);
      setDoctors(docList || []);
      setAppointments(appList || []);
    } catch (err) {
      setError(err?.message || "Failed to load directory and appointments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBookRequest = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !appointmentDate || !appointmentTime) {
      setError("Please select a doctor, appointment date, and appointment time.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const docId = selectedDoctor.doctor_id || selectedDoctor.id;
      const docName = selectedDoctor.full_name || selectedDoctor.name;

      await patientApi.requestAppointment({
        doctor_id: docId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        reason: reason.trim() || "Consultation",
      });

      setSuccess(`Appointment request sent to Dr. ${docName}. Status: Pending approval.`);
      setSelectedDoctor(null);
      setAppointmentDate("");
      setAppointmentTime("");
      setReason("");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to submit appointment request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (appointmentId) => {
    if (!window.confirm("Are you sure you want to cancel this appointment request?")) return;

    setError("");
    setSuccess("");
    try {
      await patientApi.cancelAppointment(appointmentId, cancelReason || "Cancelled by patient");
      setSuccess("Appointment successfully cancelled.");
      setCancellingId(null);
      setCancelReason("");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to cancel appointment.");
    }
  };

  const standardSpecialities = [
    "General Medicine",
    "Cardiology",
    "Endocrinology",
    "Internal Medicine",
    "Pediatrics",
    "Neurology",
    "Pulmonology",
    "Orthopedics",
  ];

  const registered = doctors.map((d) => d.specialization).filter((s) => s && s !== "Unspecified");
  const hasUnspecified = doctors.some((d) => d.specialization === "Unspecified");
  const uniqueSpecialities = Array.from(new Set([...registered, ...standardSpecialities])).sort();
  if (hasUnspecified) uniqueSpecialities.push("Unspecified");

  const filteredDoctors = doctors.filter((doc) => {
    const docName = doc.full_name || doc.name || "";
    const docSpec = doc.specialization || "Unspecified";
    const matchesSearch =
      docName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      docSpec.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpeciality =
      specialityFilter === "all" || docSpec.toLowerCase() === specialityFilter.toLowerCase();
    return matchesSearch && matchesSpeciality;
  });

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "confirmed":
      case "scheduled":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300";
      case "pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300";
      case "cancelled":
      case "rejected":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300";
      case "reschedule_requested":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" />
            {t("Appointments & Doctor Directory")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("Discover hospital specialists, request consultations, and monitor appointment statuses")}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2 font-medium">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Section 1: My Appointments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            {t("My Appointment History & Requests")}
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
            {appointments.length} {t("Records")}
          </span>
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/50">
            <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("No appointments found")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("Browse the specialist directory below to book your first clinical consultation.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appointments.map((app) => {
              const apptId = app.appointment_id || app.id;
              return (
                <div
                  key={apptId}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {t(app.status || "pending")}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        #{apptId}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      Dr. {app.doctor_name || "Specialist"}
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      {app.specialization || "General Practice"}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{app.appointment_date ? new Date(app.appointment_date).toLocaleDateString() : "Date TBD"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{app.start_time || app.appointment_time || "Time TBD"}</span>
                      </div>
                      {app.reason && (
                        <p className="mt-1 text-slate-500 dark:text-slate-400 italic">
                          "{app.reason}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Cancel Action (if pending or scheduled/confirmed) */}
                  {["pending", "scheduled", "confirmed"].includes((app.status || "").toLowerCase()) && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleCancel(apptId)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("Cancel Appointment")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Doctor Directory */}
      <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-emerald-600" />
              {t("Hospital Doctor Directory")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("Select an accredited physician to schedule a consultation")}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by doctor name or specialty...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:border-emerald-600 w-56 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={specialityFilter}
                onChange={(e) => setSpecialityFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:border-emerald-600 font-medium"
              >
                <option value="all">{t("All Specialities")}</option>
                {uniqueSpecialities.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
          </div>
        ) : error && doctors.length === 0 ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 p-8 text-center bg-rose-50/50 dark:bg-rose-950/20">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
              {t("Unable to connect to hospital doctor directory")}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {t("Retry Loading Directory")}
            </button>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/50">
            <User className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {doctors.length === 0
                ? t("No registered physicians currently available in directory.")
                : t("No physicians match your search or specialization filter criteria.")}
            </p>
            {(searchTerm || specialityFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSpecialityFilter("all");
                }}
                className="mt-3 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t("Reset Filters")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDoctors.map((doc) => {
              const docId = doc.doctor_id || doc.id;
              const docName = doc.full_name || doc.name;
              return (
                <div
                  key={docId}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-lg shrink-0">
                        <Stethoscope className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                          Dr. {docName}
                        </h3>
                        <p className={`text-xs font-semibold ${doc.specialization === "Unspecified" ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {doc.specialization && doc.specialization !== "Unspecified" ? doc.specialization : t("Specialization: Unspecified")}
                        </p>
                        {doc.qualification && doc.qualification !== "Unspecified" ? (
                          <p className="text-[11px] text-slate-500 font-mono">
                            {doc.qualification}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            {t("Credentials pending completion")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {doc.room_number && (
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          <span>Room / Clinic: {doc.room_number}</span>
                        </div>
                      )}
                      {doc.experience_years && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Experience: {doc.experience_years} years</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setError("");
                        setSuccess("");
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4" />
                      {t("Request Appointment")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedDoctor(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Book Appointment
                </h3>
                <p className="text-xs text-slate-500">
                  Dr. {selectedDoctor.full_name || selectedDoctor.name} ({selectedDoctor.specialization && selectedDoctor.specialization !== "Unspecified" ? selectedDoctor.specialization : "Specialization Unspecified"})
                </p>
              </div>
            </div>

            <form onSubmit={handleBookRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preferred Time (HH:MM) *
                </label>
                <input
                  type="time"
                  required
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Consultation
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your symptoms or reason for visit..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    "Submit Appointment Request"
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
