import { useState } from "react";
import { loginReceptionist } from "../services/api";

function Login({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState("receptionist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    setError("");
    if (newRole === "doctor") {
      window.location.href = "http://localhost:5173";
    } else if (newRole === "patient") {
      window.location.href = "http://localhost:5175";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginReceptionist(email.trim(), password);
      localStorage.setItem("receptionist_token", data.token);
      localStorage.setItem("receptionist_user", JSON.stringify(data.receptionist));
      onLoginSuccess(data.receptionist);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "#f8fafc",
      fontFamily: "Inter, system-ui, sans-serif"
    }}>
      <div style={{
        background: "rgba(30, 41, 59, 0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "36px",
        width: "100%",
        maxWidth: "440px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)"
      }}>
        {/* Role Selection Tabs */}
        <div style={{ marginBottom: "22px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: "600",
            color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em"
          }}>
            Select Portal Role
          </label>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px",
            background: "#0f172a", padding: "4px", borderRadius: "10px", border: "1px solid #334155"
          }}>
            <button
              type="button"
              onClick={() => handleRoleChange("doctor")}
              style={{
                padding: "8px 4px", fontSize: "13px", fontWeight: "600", borderRadius: "8px",
                border: "none", cursor: "pointer", transition: "all 0.15s ease",
                background: selectedRole === "doctor" ? "#2563eb" : "transparent",
                color: selectedRole === "doctor" ? "#fff" : "#94a3b8"
              }}
            >
              👨‍⚕️ Doctor
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("patient")}
              style={{
                padding: "8px 4px", fontSize: "13px", fontWeight: "600", borderRadius: "8px",
                border: "none", cursor: "pointer", transition: "all 0.15s ease",
                background: selectedRole === "patient" ? "#2563eb" : "transparent",
                color: selectedRole === "patient" ? "#fff" : "#94a3b8"
              }}
            >
              🏥 Patient
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange("receptionist")}
              style={{
                padding: "8px 4px", fontSize: "13px", fontWeight: "600", borderRadius: "8px",
                border: "none", cursor: "pointer", transition: "all 0.15s ease",
                background: selectedRole === "receptionist" ? "#2563eb" : "transparent",
                color: selectedRole === "receptionist" ? "#fff" : "#94a3b8"
              }}
            >
              📋 Receptionist
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            borderRadius: "12px",
            background: "#2563eb",
            color: "#fff",
            fontSize: "26px",
            marginBottom: "12px"
          }}>
            ✚
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 6px 0" }}>Receptionist Sign In</h1>
          <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
            HealthCare Management System — Front Desk Desk Access
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "14px",
            marginBottom: "20px"
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label htmlFor="receptionist-email" style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
              Staff Email
            </label>
            <input
              id="receptionist-email"
              type="email"
              placeholder="e.g. receptionist@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: "22px" }}>
            <label htmlFor="receptionist-password" style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
              Password
            </label>
            <input
              id="receptionist-password"
              type="password"
              placeholder="Enter staff password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
            }}
          >
            {loading ? "Authenticating..." : "Sign In to Front Desk"}
          </button>
        </form>

        <div style={{ marginTop: "22px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
          Protected by Server-Side JWT & RBAC Boundary (Port 5000)
        </div>
      </div>
    </div>
  );
}

export default Login;
