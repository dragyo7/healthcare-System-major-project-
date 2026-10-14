import { useEffect, useState } from "react";
import { getDoctors } from "../services/api";

function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const data = await getDoctors();
      setDoctors(data);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = doctors.filter((d) =>
    (d.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.specialization || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2>Physician Directory</h2>
        <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
          Registered hospital clinicians, specialties, and clinical licensing details.
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by physician name or specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "10px 14px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "14px",
            outline: "none"
          }}
        />
      </div>

      {loading ? (
        <p>Loading physician directory...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
          <p style={{ color: "#64748b" }}>No matching physicians found.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "12px 16px" }}>ID</th>
                <th style={{ padding: "12px 16px" }}>Doctor Name</th>
                <th style={{ padding: "12px 16px" }}>Specialization</th>
                <th style={{ padding: "12px 16px" }}>Qualifications</th>
                <th style={{ padding: "12px 16px" }}>License No.</th>
                <th style={{ padding: "12px 16px" }}>Experience</th>
                <th style={{ padding: "12px 16px" }}>Contact Phone</th>
                <th style={{ padding: "12px 16px" }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.doctor_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#059669" }}>DOC#{d.doctor_id}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "600" }}>{d.full_name}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>
                      {d.specialization}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{d.qualification || "MBBS"}</td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace" }}>{d.license_number}</td>
                  <td style={{ padding: "12px 16px" }}>{d.experience_years ? `${d.experience_years} years` : "—"}</td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{d.phone}</td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{d.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Doctors;
