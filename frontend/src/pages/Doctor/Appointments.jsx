import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Plus, CheckCircle2, XCircle, Trash2, User, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DoctorAppointments() {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("all"); // "all" | "scheduled" | "completed" | "cancelled"
  const [activeTab, setActiveTab] = useState("appointments"); // "appointments" | "schedule"

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New appointment form state
  const [showApptModal, setShowApptModal] = useState(false);
  const [newPatientId, setNewPatientId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("09:30");
  const [newReason, setNewReason] = useState("");

  // New schedule slot form state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newDay, setNewDay] = useState("Monday");
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("13:00");
  const [newActivity, setNewActivity] = useState("Outpatient Clinic (OPD)");
  const [newLocation, setNewLocation] = useState("Room 204");

  const loadData = async () => {
    try {
      const [appts, sched, patList] = await Promise.all([
        doctorApi.getAppointments(),
        doctorApi.getSchedule(),
        doctorApi.getPatients(),
      ]);
      setAppointments(appts);
      setSchedule(sched);
      setPatients(patList);
      if (patList.length > 0 && !newPatientId) {
        setNewPatientId(patList[0].patient_id);
      }
    } catch (err) {
      setError(err?.message || "Failed to load appointments or schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    setError("");
    setSuccess("");
    try {
      await doctorApi.updateAppointmentStatus(appointmentId, newStatus);
      setSuccess(`Appointment #${appointmentId} marked as ${newStatus}!`);
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to update appointment status");
    }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await doctorApi.createAppointment({
        patient_id: newPatientId,
        appointment_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
        reason: newReason,
      });
      setSuccess("New consultation appointment scheduled successfully!");
      setShowApptModal(false);
      setNewReason("");
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to schedule appointment");
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await doctorApi.createSchedule({
        day_of_week: newDay,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        activity_type: newActivity,
        location: newLocation,
      });
      setSuccess("New availability slot saved to schedule!");
      setShowScheduleModal(false);
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to add schedule slot");
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await doctorApi.deleteSchedule(scheduleId);
      setSuccess("Schedule slot removed.");
      loadData();
    } catch (err) {
      setError(err?.message || "Failed to delete schedule slot");
    }
  };

  // Date filter state
  const [selectedDate, setSelectedDate] = useState("");
  const [filterByDate, setFilterByDate] = useState(false);

  const handlePrevDay = () => {
    const cur = selectedDate ? new Date(selectedDate) : new Date();
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split("T")[0]);
    setFilterByDate(true);
  };

  const handleNextDay = () => {
    const cur = selectedDate ? new Date(selectedDate) : new Date();
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(cur.toISOString().split("T")[0]);
    setFilterByDate(true);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setFilterByDate(true);
  };

  const filteredAppointments = appointments.filter((a) => {
    if (filter !== "all" && a.status?.toLowerCase() !== filter.toLowerCase()) {
      return false;
    }
    if (filterByDate && selectedDate) {
      const aDate = a.appointment_date ? new Date(a.appointment_date).toISOString().split("T")[0] : "";
      if (aDate !== selectedDate) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading Doctor Schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Consultations & Availability Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review patient appointments, update consultation statuses, and configure weekly clinical routine slots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "appointments" ? (
            <button
              onClick={() => setShowApptModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-600/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Consultation</span>
            </button>
          ) : (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-md shadow-primary-600/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Availability Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300/60 dark:border-slate-700/60 max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "appointments"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>{t("Appointments & Schedule")} ({appointments.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "schedule"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{t("Consultation Schedule")} ({schedule.length})</span>
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {error}
        </div>
      )}

      {/* TAB 1: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <div className="space-y-4">
          {/* Calendar Date Navigator & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {/* Date Navigator */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDay}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t("Previous Day")}
              >
                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t("Today")}
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setFilterByDate(!!e.target.value);
                }}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                onClick={handleNextDay}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t("Next Day")}
              >
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              {filterByDate && (
                <button
                  onClick={() => {
                    setFilterByDate(false);
                    setSelectedDate("");
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold ml-1"
                >
                  {t("Clear")}
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t("Status")}:</span>
              {["all", "pending", "confirmed", "completed", "cancelled"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                    filter === f
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {f === "all" ? t("All Appointments") : t(f.charAt(0).toUpperCase() + f.slice(1)) || f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-6">{t("Patient Name")}</th>
                    <th className="py-3.5 px-6">{t("Date")}</th>
                    <th className="py-3.5 px-6">{t("Time Slot")}</th>
                    <th className="py-3.5 px-6">{t("Reason for Visit")}</th>
                    <th className="py-3.5 px-6">{t("Status")}</th>
                    <th className="py-3.5 px-6 text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                        No appointments found matching current filter{filterByDate ? ` on ${selectedDate}` : ""}.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt) => (
                      <tr
                        key={appt.appointment_id || appt.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 font-bold flex items-center justify-center text-xs">
                              {appt.patient_name?.charAt(0) || "P"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{appt.patient_name || `Patient #${appt.patient_id}`}</span>
                                <Link
                                  to={`/doctor/patients?id=${appt.patient_id}`}
                                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-0.5 text-[11px] font-semibold"
                                  title="Open authorized medical dossier"
                                >
                                  <Eye className="h-3 w-3" /> Dossier
                                </Link>
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal">ID: #{appt.patient_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-medium">
                          {appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                          {appt.start_time} - {appt.end_time || appt.start_time}
                        </td>
                        <td className="py-4 px-6 text-slate-500 max-w-xs truncate">
                          {appt.reason || "General Consultation"}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              appt.status === "completed"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : appt.status === "confirmed" || appt.status === "scheduled"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : appt.status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {appt.status === "pending" && (
                              <button
                                onClick={() => handleUpdateStatus(appt.appointment_id || appt.id, "confirmed")}
                                className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
                                title="Confirm Appointment"
                              >
                                Confirm
                              </button>
                            )}
                            {appt.status !== "completed" && appt.status !== "cancelled" && (
                              <button
                                onClick={() => handleUpdateStatus(appt.appointment_id || appt.id, "completed")}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                                title="Mark Completed"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            {appt.status !== "cancelled" && appt.status !== "rejected" && (
                              <button
                                onClick={() => handleUpdateStatus(appt.appointment_id || appt.id, "cancelled")}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                                title="Cancel Appointment"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Doctor Weekly Routine Slots
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-6">Day of Week</th>
                  <th className="py-3.5 px-6">Time Window</th>
                  <th className="py-3.5 px-6">Clinical Activity</th>
                  <th className="py-3.5 px-6">Clinic Location</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {schedule.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 text-xs">
                      No routine schedule slots defined. Click "Add Availability Slot" to add one.
                    </td>
                  </tr>
                ) : (
                  schedule.map((slot) => (
                    <tr key={slot.schedule_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        {slot.day_of_week}
                      </td>
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                        {slot.start_time} - {slot.end_time}
                      </td>
                      <td className="py-4 px-6 text-slate-900 dark:text-white font-medium">
                        {slot.activity_type}
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {slot.location || "Hospital OPD"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDeleteSchedule(slot.schedule_id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                          title="Delete slot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Schedule Consultation */}
      {showApptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Schedule New Consultation
            </h2>
            <form onSubmit={handleCreateAppointment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Patient
                </label>
                <select
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  {patients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.full_name} (#{p.patient_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Visit
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Hypertension medication review"
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApptModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Schedule Slot */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Add Routine Availability Slot
            </h2>
            <form onSubmit={handleCreateSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Day of Week
                </label>
                <select
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Activity Type
                </label>
                <input
                  type="text"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  placeholder="e.g. Outpatient Clinic (OPD)"
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Room
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Room 204"
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs"
                >
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
