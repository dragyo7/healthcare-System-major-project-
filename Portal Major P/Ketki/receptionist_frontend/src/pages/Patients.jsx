import { useEffect, useState } from "react";
import { getPatients, registerPatient } from "../services/api";

function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activationBanner, setActivationBanner] = useState(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "Male",
    blood_group: "O+",
    address: "",
    emergency_contact: "",
    allergies: "No known allergies"
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await getPatients();
      setPatients(data);
    } catch (err) {
      console.error("Error fetching patients:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const created = await registerPatient(formData);
      setPatients([created, ...patients]);
      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        date_of_birth: "",
        gender: "Male",
        blood_group: "O+",
        address: "",
        emergency_contact: "",
        allergies: "No known allergies"
      });
      setActivationBanner({
        name: created.full_name,
        id: created.patient_id,
        activation_url: created.activation_url
      });
    } catch (err) {
      setFormError(err.message || "Failed to register patient");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = patients.filter((p) =>
    (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone || "").includes(searchTerm) ||
    (p.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "8px 0" }}>
      {activationBanner && (
        <div style={{
          padding: "16px 20px",
          background: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: "10px",
          marginBottom: "20px",
          color: "#065f46"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>✓ Patient {activationBanner.name} registered successfully! (ID: {activationBanner.id})</strong>
              {activationBanner.activation_url ? (
                <div style={{ marginTop: "8px", fontSize: "14px" }}>
                  <span>Dev Account Activation Link: </span>
                  <a
                    id="dev-activation-link"
                    href={activationBanner.activation_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#047857", fontWeight: "bold", textDecoration: "underline" }}
                  >
                    {activationBanner.activation_url}
                  </a>
                </div>
              ) : (
                <div style={{ marginTop: "4px", fontSize: "13px", color: "#6b7280" }}>
                  Account activation link suppressed (production security mode).
                </div>
              )}
            </div>
            <button
              onClick={() => setActivationBanner(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#065f46", fontSize: "18px", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Patient Intake & Directory</h2>
          <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
            Register new patients and manage demographic records.
          </p>
        </div>
        <button
          id="btn-register-patient"
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
          + Register Patient
        </button>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by patient name, phone, or email..."
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
        <p>Loading patient directory...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
          <p style={{ color: "#64748b" }}>No matching patients found.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "12px 16px" }}>ID</th>
                <th style={{ padding: "12px 16px" }}>Full Name</th>
                <th style={{ padding: "12px 16px" }}>Phone</th>
                <th style={{ padding: "12px 16px" }}>Email</th>
                <th style={{ padding: "12px 16px" }}>Gender</th>
                <th style={{ padding: "12px 16px" }}>Blood Group</th>
                <th style={{ padding: "12px 16px" }}>City / Address</th>
                <th style={{ padding: "12px 16px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.patient_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#2563eb" }}>#{p.patient_id}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "500" }}>{p.full_name}</td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{p.phone}</td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{p.email}</td>
                  <td style={{ padding: "12px 16px" }}>{p.gender || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>
                      {p.blood_group || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#64748b" }}>{p.address || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => setSelectedPatient(p)}
                      style={{
                        padding: "6px 12px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "500"
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50
        }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "500px" }}>
            <h3>Patient #{selectedPatient.patient_id} — {selectedPatient.full_name}</h3>
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.8", color: "#334155" }}>
              <p><strong>Email:</strong> {selectedPatient.email}</p>
              <p><strong>Phone:</strong> {selectedPatient.phone}</p>
              <p><strong>Date of Birth:</strong> {selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toLocaleDateString() : "—"}</p>
              <p><strong>Gender:</strong> {selectedPatient.gender}</p>
              <p><strong>Blood Group:</strong> {selectedPatient.blood_group}</p>
              <p><strong>Emergency Contact:</strong> {selectedPatient.emergency_contact || "—"}</p>
              <p><strong>Address:</strong> {selectedPatient.address || "—"}</p>
              <p><strong>Recorded Allergies:</strong> {selectedPatient.allergies || "None"}</p>
            </div>
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                onClick={() => setSelectedPatient(null)}
                style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
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
          <div style={{ background: "#fff", padding: "28px", borderRadius: "12px", width: "90%", maxWidth: "550px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Register New Patient</h3>
            {formError && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
                ⚠️ {formError}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Full Name *</label>
                  <input id="patient-full-name" type="text" name="full_name" required value={formData.full_name} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Email *</label>
                  <input id="patient-email" type="email" name="email" required value={formData.email} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Phone *</label>
                  <input id="patient-phone" type="text" name="phone" required value={formData.phone} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Date of Birth</label>
                  <input id="patient-dob" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Gender</label>
                  <select id="patient-gender" name="gender" value={formData.gender} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Blood Group</label>
                  <select id="patient-blood-group" name="blood_group" value={formData.blood_group} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Address / City</label>
                <input id="patient-address" type="text" name="address" value={formData.address} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Emergency Contact</label>
                <input id="patient-emergency" type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>Recorded Allergies</label>
                <input id="patient-allergies" type="text" name="allergies" value={formData.allergies} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>

              <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-patient-register"
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Registering..." : "Submit Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Patients;
