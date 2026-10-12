import { useEffect, useState } from "react";
import { getAppointments, getPatients, getDoctors, scheduleAppointment, updateAppointmentStatus } from "../services/api";

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    patient_id: "",
    doctor_id: "",
    appointment_date: new Date().toISOString().split("T")[0],
    start_time: "10:00:00",
    reason: "General Consultation"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apptList, patList, docList] = await Promise.all([
        getAppointments(),
        getPatients(),
        getDoctors()
      ]);
      setAppointments(apptList);
      setPatients(patList);
      setDoctors(docList);
      if (patList.length > 0) formData.patient_id = patList[0].patient_id;
      if (docList.length > 0) formData.doctor_id = docList[0].doctor_id;
    } catch (err) {
      console.error("Error loading appointments data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await updateAppointmentStatus(appointmentId, newStatus);
      setAppointments(appointments.map(a =>
        a.appointment_id === appointmentId ? { ...a, status: newStatus } : a
      ));
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await scheduleAppointment(formData);
      setShowModal(false);
      loadData();
      alert("Appointment scheduled successfully!");
    } catch (err) {
      setError(err.message || "Failed to schedule appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "completed") {
      return <span style={{ background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>Completed</span>;
    }
    if (s === "cancelled") {
      return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>Cancelled</span>;
    }
    return <span style={{ background: "#eff6ff", color: "#1e40af", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>Scheduled</span>;
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Appointment Scheduling</h2>
          <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
            Book and coordinate clinical consultations between patients and doctors.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          + Book Appointment
        </button>
      </div>

      {loading ? (
        <p>Loading appointments...</p>
      ) : appointments.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
          <p style={{ color: "#64748b" }}>No scheduled appointments found.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "12px 16px" }}>Appt ID</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Time Slot</th>
                <th style={{ padding: "12px 16px" }}>Patient Name</th>
                <th style={{ padding: "12px 16px" }}>Assigned Doctor</th>
                <th style={{ padding: "12px 16px" }}>Consultation Reason</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.appointment_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#2563eb" }}>APP#{a.appointment_id}</td>
                  <td style={{ padding: "12px 16px" }}>{new Date(a.appointment_date).toLocaleDateString()}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{a.start_time} - {a.end_time || "—"}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "500" }}>{a.patient_name}</td>
                  <td style={{ padding: "12px 16px", color: "#065f46", fontWeight: "500" }}>{a.doctor_name}</td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{a.reason || "General consultation"}</td>
                  <td style={{ padding: "12px 16px" }}>{getStatusBadge(a.status)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={a.status}
                      onChange={(e) => handleStatusChange(a.appointment_id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50
        }}>
          <div style={{ background: "#fff", padding: "28px", borderRadius: "12px", width: "90%", maxWidth: "480px" }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Schedule Clinical Appointment</h3>
            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
                ⚠️ {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Select Patient *</label>
                <select
                  required
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: Number(e.target.value) })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  {patients.map(p => (
                    <option key={p.patient_id} value={p.patient_id}>{p.full_name} (#{p.patient_id}) - {p.phone}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Assign Doctor *</label>
                <select
                  required
                  value={formData.doctor_id}
                  onChange={(e) => setFormData({ ...formData, doctor_id: Number(e.target.value) })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  {doctors.map(d => (
                    <option key={d.doctor_id} value={d.doctor_id}>{d.full_name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Start Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Reason for Visit</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Booking..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Appointments;
