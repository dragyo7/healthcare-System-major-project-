# DEPLOYMENT SPECIFICATION & RELEASE GATES

> **Environment Separation, Network Topology & Production Blockers**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Scope**: Local Demo vs. Staging vs. Cloud Production vs. Real Clinical Use  

---

## 1. Deployment Topology & Boundaries

```text
               [PUBLIC / CLIENT INGRESS]
                           │
                           ▼
          TLS REVERSE PROXY (Port 443 / HTTPS)
          [Required for Staging & Cloud Deployments]
                           │
                           ▼
             EXPRESS EHR / CDS GATEWAY
          (Port 5000 — Sole Application Boundary)
          • Security Headers & Strict CORS
          • Bounded Request Limits (2MB)
          • Server-Side RBAC & BOLA Guards
          • PII Stripping Boundary (Zero identifiers to CDS)
                           │
   ┌───────────────────────┴───────────────────────┐
   │ (Internal TCP only)                           │ (Loopback HTTP)
   ▼                                               ▼
MySQL DATABASE                            FASTAPI CDS ENGINE
(Port 3306 - rag_healthcare)             (Port 8000 - 127.0.0.1)
• Strictly private network               • Strictly private loopback
• Non-root application user              • Frozen RAG V2.10 Core
• Encrypted connection                   • Fail-closed grounding
```

---

## 2. Environment Comparison Matrix

| Security / Operational Control | Local Synthetic Demo | Staging Environment | Public Cloud Production |
| :--- | :---: | :---: | :---: |
| **Port 5000 (Express Gateway)** | Bound to localhost | Proxied via Nginx / TLS | Proxied via Cloud Load Balancer / WAF |
| **Port 8000 (FastAPI CDS)** | Bound to `127.0.0.1` | Private internal VPC network | Private Kubernetes / Service Mesh |
| **Port 3306 (MySQL Database)** | Localhost | Managed Cloud SQL (Private IP) | Multi-AZ Managed DB with PITR |
| **Transport Layer Security** | HTTP (Local dev) | HTTPS / Let's Encrypt | Managed ACM / Cloud Certificate |
| **Secret Management** | Local `.env` | Environment injection / Vault | AWS Secrets Manager / GCP Secret Manager |
| **Patient Activation Delivery** | Displayed in Receptionist UI | Blocked / Out-of-band Email/SMS | Verified Transactional Provider (SES/Twilio) |
| **Database Credentials** | Root / Local user | Least-privilege application user | Rotated IAM / Secrets Manager user |

---

## 3. Explicit Deployment Blockers

### 3.1 Staging Environment Blockers
1. **Edge TLS Termination**: Staging requires a reverse proxy terminating HTTPS on port 443 with HSTS and redirecting plain HTTP to HTTPS.
2. **Transactional Messaging Provider**: Patient activation tokens must not be returned via front-desk UI in staging. An approved transactional provider (AWS SES, SendGrid, or internal hospital SMTP) must be configured.
3. **Dedicated Least-Privilege DB User**: Application must connect via a dedicated user granted only `SELECT, INSERT, UPDATE, DELETE` on `rag_healthcare`, without root privileges.

### 3.2 Public Internet & Cloud Production Blockers
1. **Private Network Isolation**: FastAPI (port 8000) and MySQL (port 3306) must remain strictly unreachable from the internet.
2. **Secrets Management**: No plaintext credentials in `.env` files. Keys must be injected via a cloud secret manager at container runtime.
3. **WAF & Cloud Rate Limiting**: Ingress rate limiting on `/api/auth/` and `/api/doctor/cds/evaluate` to prevent denial-of-service against the neural model.

### 3.3 Clinical Real-Patient Use Blockers
1. **Lack of Prospective Clinical Trials**: The CDS engine is an academic research prototype. No institutional review board (IRB) trials or board-certified clinical evaluations have been performed.
2. **Handwritten Prescription OCR**: OCR has been tested on synthetic digital prescription images and has not been validated on real handwritten clinician prescriptions.
3. **Medical Device Governance**: Not cleared or approved by CDSCO, US FDA, or CE as Software as a Medical Device (SaMD). Must never be deployed for autonomous clinical decision-making.
