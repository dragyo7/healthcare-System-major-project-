import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import EmptyState from "../../components/shared/EmptyState";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/shared/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { mockAppointmentService } from "../../services/mock/mockAppointmentService";
import { mockDoctorService } from "../../services/mock/mockDoctorService";
import { Calendar, User, Clock, PlusCircle } from "lucide-react";

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Scheduling Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    setIsLoading(true);
    if (user?.id) {
      const data = await mockAppointmentService.getAppointments(user.role, user.id);
      setAppointments(data);

      if (user.role === "patient") {
        const docs = await mockDoctorService.getDoctorList();
        setDoctors(docs);
        if (docs.length > 0) {
          setSelectedDoctorId(docs[0].id);
        }
      }
    }
    setIsLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  const handleCancel = async (id) => {
    await mockAppointmentService.cancelAppointment(id);
    load();
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !date || !time || !reason) return;

    const doc = doctors.find((d) => d.id === selectedDoctorId);
    if (!doc) return;

    await mockAppointmentService.scheduleAppointment({
      patientId: user.id,
      patientName: user.name,
      doctorId: doc.id,
      doctorName: doc.name,
      date,
      time,
      reason,
    });

    setDate("");
    setTime("");
    setReason("");
    setIsModalOpen(false);
    load();
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Consultation Calendar"
        subtitle="Manage upcoming appointments and consultation slots."
        action={
          user?.role === "patient" && (
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" /> Book Consultation
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="text-center p-8">Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No Appointments Scheduled"
          description="Schedule a consultation with your medical professional to log vital reviews."
          icon={Calendar}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {appointments.map((apt) => (
            <Card key={apt.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {apt.date} at {apt.time}
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
                    apt.status === "scheduled"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                      : apt.status === "completed"
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                      : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  }`}
                >
                  {apt.status}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {user?.role === "doctor" ? apt.patientName : apt.doctorName}
                  </h4>
                  <p className="text-xs text-slate-500">Reason: {apt.reason}</p>
                </div>
              </div>

              {apt.status === "scheduled" && (
                <div className="flex justify-end mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => handleCancel(apt.id)}
                  >
                    Cancel Consultation
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Medical Consultation">
        <form onSubmit={handleBookAppointment} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Choose Specialist</label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl text-sm focus:outline-hidden"
              required
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="apt-date"
              label="Consultation Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              id="apt-time"
              label="Preferred Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <Input
            id="apt-reason"
            label="Reason for Visit"
            type="text"
            placeholder="e.g. Annual Cardio Review"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <Button type="submit" className="w-full mt-2">
            Confirm Booking
          </Button>
        </form>
      </Modal>
    </div>
  );
}
