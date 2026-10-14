import { useState, useEffect } from "react";
import { getPatients, getDoctors, getAppointments } from "../services/api";

function Dashboard({ setActivePage }) {
  const [stats, setStats] = useState({
    patients: 0,
    doctors: 0,
    appointments: 0,
    scheduledToday: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [patList, docList, apptList] = await Promise.all([
          getPatients(),
          getDoctors(),
          getAppointments()
        ]);
        const scheduled = apptList.filter(a => a.status === "scheduled").length;
        setStats({
          patients: patList.length,
          doctors: docList.length,
          appointments: apptList.length,
          scheduledToday: scheduled
        });
      } catch (err) {
        console.error("Dashboard metrics load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="dashboard">
      <h1>Front Desk Operations Dashboard</h1>
      <p style={{ color: "#64748b", marginBottom: "24px" }}>
        Administrative coordination, patient intake, physician schedules, and appointment bookings.
      </p>

      <div className="dashboard-cards">
        <div className="dashboard-card" onClick={() => setActivePage("Patients")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>👤</div>
          <h3>Registered Patients</h3>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#2563eb", margin: "8px 0" }}>
            {loading ? "..." : stats.patients}
          </p>
          <small style={{ color: "#64748b" }}>Manage demographics & intake</small>
        </div>

        <div className="dashboard-card" onClick={() => setActivePage("Doctors")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>👨‍⚕️</div>
          <h3>Active Physicians</h3>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#059669", margin: "8px 0" }}>
            {loading ? "..." : stats.doctors}
          </p>
          <small style={{ color: "#64748b" }}>View specializations & contacts</small>
        </div>

        <div className="dashboard-card" onClick={() => setActivePage("Appointments")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📅</div>
          <h3>Total Bookings</h3>
          <p style={{ fontSize: "28px", fontWeight: "700", color: "#d97706", margin: "8px 0" }}>
            {loading ? "..." : stats.appointments}
          </p>
          <small style={{ color: "#64748b" }}>{stats.scheduledToday} pending scheduled</small>
        </div>

        <div className="dashboard-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛡️</div>
          <h3>Role Boundary</h3>
          <p style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b", margin: "8px 0" }}>
            Administrative Only
          </p>
          <small style={{ color: "#64748b" }}>Clinical CDS & Prescriptions strictly restricted to Doctors</small>
        </div>
      </div>

      <div style={{ marginTop: "36px", display: "flex", gap: "16px" }}>
        <button
          id="btn-quick-register"
          onClick={() => setActivePage("Patients")}
          style={{
            padding: "12px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          + Register New Patient
        </button>
        <button
          onClick={() => setActivePage("Appointments")}
          style={{
            padding: "12px 20px",
            background: "#059669",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          + Schedule Appointment
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
