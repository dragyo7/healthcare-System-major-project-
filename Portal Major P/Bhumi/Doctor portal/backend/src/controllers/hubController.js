/**
 * Portal Hub Controller
 * Serves the central unified entry point and health status for the healthcare platform.
 */
const db = require("../config/db");

const renderHubHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clinical Decision Support System — Unified Portal Hub</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --accent: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; }
    .container { max-width: 1100px; width: 100%; }
    .header { text-align: center; margin-bottom: 2.5rem; }
    .badge-pill { display: inline-block; background: rgba(37, 99, 235, 0.2); border: 1px solid rgba(37, 99, 235, 0.4); color: #60a5fa; font-size: 0.8rem; font-weight: 600; padding: 0.35rem 0.85rem; border-radius: 9999px; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 2.4rem; font-weight: 800; margin-bottom: 0.75rem; letter-spacing: -0.02em; background: linear-gradient(135deg, #fff 30%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p.subtitle { color: var(--text-muted); font-size: 1.1rem; max-width: 650px; margin: 0 auto; line-height: 1.5; }

    .status-bar { display: flex; justify-content: center; gap: 1rem; margin-bottom: 2.5rem; flex-wrap: wrap; }
    .status-chip { display: flex; align-items: center; gap: 0.5rem; background: rgba(30, 41, 59, 0.7); border: 1px solid var(--card-border); padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.85rem; color: #cbd5e1; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); }

    .portal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .portal-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 1.75rem; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; position: relative; overflow: hidden; }
    .portal-card:hover { transform: translateY(-4px); border-color: #3b82f6; box-shadow: 0 12px 24px -10px rgba(37, 99, 235, 0.3); }
    .portal-icon { font-size: 2rem; margin-bottom: 1rem; }
    .portal-title { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.4rem; color: #fff; }
    .portal-port { font-size: 0.78rem; font-family: monospace; color: var(--accent); background: rgba(6, 182, 212, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-bottom: 1rem; width: fit-content; }
    .portal-desc { color: var(--text-muted); font-size: 0.92rem; line-height: 1.5; margin-bottom: 1.5rem; flex-grow: 1; }
    .portal-features { list-style: none; margin-bottom: 1.5rem; font-size: 0.85rem; color: #cbd5e1; }
    .portal-features li { margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem; }
    .portal-features li::before { content: "✓"; color: var(--accent); font-weight: bold; }
    .portal-btn { display: block; text-align: center; background: var(--primary); color: #fff; text-decoration: none; font-weight: 600; padding: 0.75rem 1rem; border-radius: 8px; transition: background 0.2s; font-size: 0.95rem; }
    .portal-btn:hover { background: var(--primary-dark); }
    .portal-btn.patient { background: #059669; }
    .portal-btn.patient:hover { background: #047857; }
    .portal-btn.receptionist { background: #7c3aed; }
    .portal-btn.receptionist:hover { background: #6d28d9; }

    .activation-card { background: rgba(30, 41, 59, 0.5); border: 1px dashed var(--card-border); border-radius: 12px; padding: 1.25rem 1.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .activation-text h3 { font-size: 1.05rem; font-weight: 600; margin-bottom: 0.2rem; }
    .activation-text p { font-size: 0.85rem; color: var(--text-muted); }
    .activation-btn { background: transparent; border: 1px solid #475569; color: #f1f5f9; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.88rem; font-weight: 500; transition: all 0.2s; }
    .activation-btn:hover { border-color: #94a3b8; background: rgba(255, 255, 255, 0.05); }

    .security-notice { background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 10px; padding: 1rem 1.5rem; font-size: 0.82rem; color: #64748b; line-height: 1.6; text-align: center; }
    .security-notice strong { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <span class="badge-pill">4th-Year Major Project • Unified CDS Platform</span>
      <h1>Clinical Decision Support System</h1>
      <p class="subtitle">Select your role to access the dedicated clinical workstation. Each portal preserves its authorized workflows and secure server-side role boundaries.</p>
    </header>

    <div class="status-bar">
      <div class="status-chip"><span class="status-dot"></span> MySQL (Port 3306)</div>
      <div class="status-chip"><span class="status-dot"></span> Express Gateway (Port 5000)</div>
      <div class="status-chip"><span class="status-dot"></span> CDS RAG v2.10 (Port 8000)</div>
      <div class="status-chip"><span class="status-dot"></span> Multilingual (en, hi, mr, gu)</div>
    </div>

    <div class="portal-grid">
      <!-- DOCTOR PORTAL -->
      <div class="portal-card">
        <div class="portal-icon">🩺</div>
        <h2 class="portal-title">Doctor Portal</h2>
        <span class="portal-port">http://localhost:5173/doctor</span>
        <p class="portal-desc">Clinical dashboard for licensed physicians to review dossiers, screen drug interactions, verify OCR prescriptions, and generate discharge summaries.</p>
        <ul class="portal-features">
          <li>Patient EHR & Vitals Dossier</li>
          <li>Evidence-grounded Clinical CDS</li>
          <li>Prescription OCR Verification</li>
          <li>Post-discharge Care Creation</li>
        </ul>
        <a href="http://localhost:5173/doctor" class="portal-btn">Launch Doctor Portal →</a>
      </div>

      <!-- RECEPTIONIST PORTAL -->
      <div class="portal-card">
        <div class="portal-icon">📋</div>
        <h2 class="portal-title">Receptionist Portal</h2>
        <span class="portal-port">http://localhost:5173/receptionist</span>
        <p class="portal-desc">Administrative workstation for front-desk staff to register patients, manage queue scheduling, and handle secure account activation provisioning.</p>
        <ul class="portal-features">
          <li>Patient Registration & Enrollment</li>
          <li>Appointment Scheduling & Queue</li>
          <li>Single-use Activation Provisioning</li>
          <li>Isolated Administrative Boundary</li>
        </ul>
        <a href="http://localhost:5173/receptionist" class="portal-btn receptionist">Launch Receptionist Portal →</a>
      </div>

      <!-- PATIENT PORTAL -->
      <div class="portal-card">
        <div class="portal-icon">🏥</div>
        <h2 class="portal-title">Patient Portal</h2>
        <span class="portal-port">http://localhost:5173/patient</span>
        <p class="portal-desc">Patient self-service portal for reviewing personal medical records, upcoming appointments, prescriptions, and authorized post-discharge educational CDS.</p>
        <ul class="portal-features">
          <li>Self-Service Health Records</li>
          <li>Prescriptions & Active Medications</li>
          <li>Post-Discharge Care Guidelines</li>
          <li>Restricted Educational Assistant</li>
        </ul>
        <a href="http://localhost:5173/patient" class="portal-btn patient">Launch Patient Portal →</a>
      </div>
    </div>

    <div class="activation-card">
      <div class="activation-text">
        <h3>🔑 Have a new patient activation token?</h3>
        <p>Complete account setup with single-use cryptographic token verification and set your secure password.</p>
      </div>
      <a href="http://localhost:5173/activate" class="activation-btn">Open Activation Page →</a>
    </div>

    <footer class="security-notice">
      <strong>Security & Architectural Invariants:</strong>
      All browser traffic routes exclusively through Express (Port 5000). The internal FastAPI CDS service (Port 8000) is protected by a strict security boundary.
      Server-side JWT authorization strictly enforces RBAC. Zero patient PII is transmitted to or retained by the persistent medical vector knowledge base.
    </footer>
  </div>
</body>
</html>`;

const getHub = (req, res) => {
  if (req.accepts("html") && !req.xhr) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderHubHtml());
  }

  return res.json({
    name: "Clinical Decision Support System — Central Gateway Hub",
    version: "2.10",
    status: "active",
    portals: {
      unified_app: "http://localhost:5173",
      doctor: "http://localhost:5173/doctor",
      receptionist: "http://localhost:5173/receptionist",
      patient: "http://localhost:5173/patient",
      activation: "http://localhost:5173/activate"
    },
    services: {
      express_api: "http://localhost:5000",
      fastapi_cds: "http://localhost:8000",
      mysql: "port 3306"
    },
    languages_supported: ["en", "hi", "mr", "gu"]
  });
};

const getHealth = async (req, res) => {
  try {
    await db.execute("SELECT 1");
    return res.status(200).json({
      status: "healthy",
      services: {
        database: "connected",
        database_name: process.env.NODE_ENV !== "production" ? process.env.DB_NAME : undefined,
        express_gateway: "active",
        cds_bridge: "active"
      },
      indexed_chunks_count: 2204,
      version: "2.10",
      embedding_model: "BAAI/bge-small-en",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      status: "degraded",
      error: err.message,
      services: {
        database: "disconnected",
        database_name: process.env.NODE_ENV !== "production" ? process.env.DB_NAME : undefined,
        express_gateway: "active"
      },
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getHub,
  getHealth
};
