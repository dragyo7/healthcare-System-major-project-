import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Activity,
  BookOpen,
  AlertTriangle,
  Lock,
  FileText,
  Users,
  Scale,
  HeartHandshake,
  ArrowLeft,
  ExternalLink,
  Info,
  CheckCircle2,
  FileCheck2,
  Eye,
  Mail,
  HelpCircle,
  Database,
  Cpu,
  PhoneCall
} from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/shared/Card";

export default function About() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased overflow-x-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 select-none">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold shadow-md shadow-primary-500/20 text-base">
              CDSS
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                CDSS Healthcare
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Academic Research Prototype
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login">
            <Button size="sm" variant="outline" className="text-xs">
              Sign In
            </Button>
          </Link>
          <Link to="/">
            <Button size="sm" variant="ghost" className="text-xs flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back to</span> Portal
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10">

        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 text-xs font-bold uppercase tracking-wider">
            <Scale className="h-3.5 w-3.5" /> Academic Transparency & Privacy Governance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            About CDSS, Clinical Safety & Data Ethics
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            This platform is an academic 4th-Year Major Project engineered at
            <strong> St. Vincent Pallotti College of Engineering and Technology, Nagpur</strong>.
            It evaluates evidence-grounded Retrieval-Augmented Generation (RAG), deterministic medication safety checks,
            and ethical privacy governance within clinical decision support architectures.
          </p>
        </div>

        {/* SECTION 1: CRUCIAL CLINICAL SAFETY DISCLAIMER */}
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5 p-5 sm:p-6 space-y-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-400 font-bold text-base">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Crucial Medical Disclaimer & Academic Prototype Boundary</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              • <strong>Not an Autonomous Doctor or Diagnostic Device</strong>: This system does not diagnose clinical conditions, prescribe medications, or replace human medical judgment. It is designed strictly as an assistive clinical decision support (CDS) reference tool.
            </p>
            <p>
              • <strong>Mandatory Registered Medical Practitioner (RMP) Oversight</strong>: Under Indian National Medical Commission (NMC) regulations, licensed physicians retain complete legal and professional accountability for patient care. Every draft prescription, interaction warning, and AI suggestion must be independently reviewed and authorized by an RMP before any clinical action.
            </p>
            <p>
              • <strong>Emergency Guidance & Triage Limitations</strong>: In life-threatening emergencies (e.g., severe chest pain, shortness of breath, acute stroke signs, poisoning, or severe trauma), <strong>do not use this application</strong>. Immediately contact national emergency services:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white">
                <PhoneCall className="h-3.5 w-3.5" /> 112 — National Unified Emergency Services
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white">
                <PhoneCall className="h-3.5 w-3.5" /> 108 — Emergency Medical & Ambulance Service
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 text-white">
                <PhoneCall className="h-3.5 w-3.5" /> 102 — Free Maternal & Child Ambulance
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
              Note: Automated emergency triage keywords divert emergency queries safely, but keyword detection cannot substitute for professional emergency triage.
            </p>
          </div>
        </div>

        {/* SECTION 2: 4-COLUMN ARCHITECTURAL INVARIANTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card className="p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-sm">
              <Lock className="h-4 w-4" /> Zero Egress for Health & Clinical Data (100% Local Inference)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All natural language generation (TinyLlama-1.1B), dense vector search (BAAI/bge-small-en), lexical search (BM25Okapi), reranking (cross-encoder/ms-marco-MiniLM-L-6-v2), and prescription OCR (Tesseract.js) execute strictly within 127.0.0.1. Zero patient records, clinical prompts, or medical images leave the host machine. Frontend assets are bundled locally with system fonts, avoiding runtime external CDN dependencies.
            </p>
          </Card>

          <Card className="p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" /> Synthetic Data Demonstration
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All electronic health records, medication lists, allergy profiles, and prescription test images in this repository are synthetic demonstration artifacts. No real patient personal health information (PHI) has been collected, stored, or processed.
            </p>
          </Card>

          <Card className="p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Users className="h-4 w-4" /> Role-Based Access Isolation (RBAC)
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Access is segregated into three distinct roles: Doctors (full CDS & prescription authoring), Patients (restricted educational inquiries), and Receptionists (front-desk registration & scheduling only, strictly blocked from clinical CDS with HTTP 403).
            </p>
          </Card>

          <Card className="p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
              <ShieldCheck className="h-4 w-4" /> Fail-Closed Grounding Verifier
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              The proprietary grounding verifier verifies atomic claims against 2,204 DailyMed SPL chunks. Unverified claims, entity mismatches, or unsupported queries trigger immediate fail-closed withholding (`withheld_verification_failure`).
            </p>
          </Card>
        </div>

        {/* SECTION 3: PRESCRIPTION OCR & MANDATORY CLINICIAN REVIEW */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <FileCheck2 className="h-5 w-5 text-primary-600" />
            <span>Prescription OCR Limitations & Human Review Invariant</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              The optical character recognition (OCR) engine utilizes offline Tesseract.js with auto-orientation and magic-byte header validation (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `%PDF` for PDF).
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <strong>OCR Error Rates & Handwriting Uncertainty</strong>: Clinical prescription handwriting varies significantly in legibility. Extracted medication names, dosages, and frequencies are suggestions with calculated confidence metrics.
              </li>
              <li>
                <strong>Clinician Review Invariant</strong>: Unreviewed OCR output is held in `prescription_ocr_jobs` with status `pending_review`. The system strictly prohibits committing OCR extractions directly to patient medical records without explicit confirmation by the treating physician.
              </li>
            </ul>
          </div>
        </div>

        {/* SECTION 4: DATA PRIVACY, RETENTION, AND CONSENT BEHAVIOR */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <Lock className="h-5 w-5 text-emerald-600" />
            <span>Data Collection, Storage, Retention & Consent Practices</span>
          </div>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 space-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">Data Collected & Minimization</span>
                <p className="text-slate-600 dark:text-slate-400">
                  Only minimal account identifiers (Full Name, Email, Phone, Role) and clinical mock metadata (Allergies, synthetic Prescriptions, Discharges) are stored. Zero unnecessary telemetry, behavioral cookies, or tracking pixels exist.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 space-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">Purpose Limitation</span>
                <p className="text-slate-600 dark:text-slate-400">
                  Data processing is restricted exclusively to academic simulation and decision support evaluation. Stored information is never monetized, profiled, or shared with third parties.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 space-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">Storage & Retention</span>
                <p className="text-slate-600 dark:text-slate-400">
                  Data resides in a local MySQL instance (`rag_healthcare` / `rag_healthcare_test`). As an academic demonstration platform, automated data purging schedules are not implemented; accounts persist until manual database teardown.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 space-y-1 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">Consent & User Rights</span>
                <p className="text-slate-600 dark:text-slate-400">
                  Registration requires affirmative acknowledgment of the academic disclaimer. In accordance with DPDP principles, users have the right to inspect their records and request account deletion via the designated academic contact.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: INDIAN HEALTHCARE LEGAL & ETHICS FRAMEWORK */}
        <div className="space-y-6 pt-2">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary-600" />
              Indian Healthcare Legal & Regulatory Framework
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Authoritative statutory baselines and academic compliance boundaries
            </p>
          </div>

          <div className="space-y-4">
            {/* DPDP Act Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Digital Personal Data Protection Act, 2023 & DPDP Rules, 2025
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full w-fit">
                  Statute Enacted (Rules Notified: 13 Nov 2025 • Phased Commencement)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                The Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023) governs digital personal data processing. The final <strong>Digital Personal Data Protection Rules, 2025</strong> were formally notified by MeitY on <strong>13 November 2025</strong> with a phased commencement schedule establishing concrete compliance milestones:
              </p>
              <div className="text-[11px] text-slate-500 pt-1 space-y-1.5">
                <div>
                  <strong>• In Force on Current Audit Date (October 2026):</strong> Framework provisions under Section 1(2), constitution and preliminary procedural rules for the Data Protection Board of India (DPBI), and adjudication governance under Section 18.
                </div>
                <div>
                  <strong>• Scheduled to Commence Later (Phased Timelines):</strong> The 12-month general compliance window for Data Fiduciaries (Section 5 notice standards, consent architecture under Section 6, and grievance redressal under Section 8(9)) concludes in mid-November 2026. The extended 18-to-24-month transition for Significant Data Fiduciaries (mandatory DPIA, annual independent data audits, and algorithmic transparency under Section 10) extends into 2027.
                </div>
                <div>
                  <strong>• Legal DPO Applicability:</strong> Under Section 10(2)(a), mandatory appointment of a statutory Data Protection Officer applies <em>exclusively to notified Significant Data Fiduciaries (SDF)</em>. Standard fiduciaries designate an internal Grievance Officer under Section 8(9). For an academic research prototype running locally with synthetic data, <strong>no statutory DPO is legally required or appointed</strong>. An internal Academic Grievance Officer is designated for inquiries.
                </div>
                <div>
                  <strong>• Legal Requirements vs. Good-Practice Recommendations:</strong> Requiring informed consent prior to personal data processing is a statutory requirement (Section 6(1)). Operating 100% on-premise without third-party cloud LLM egress and using synthetic demonstration data are good-practice engineering safeguards adopted for privacy preservation.
                </div>
                <div>
                  <strong>• Academic Prototype Disclaimer:</strong> Architectural controls (BOLA protection, RBAC, least privilege) are demonstrated for educational evaluation at SVPCET Nagpur. This system does not claim commercial certification or governmental accreditation.
                </div>
                <div className="pt-0.5">
                  <a href="https://www.meity.gov.in/content/digital-personal-data-protection-act-2023" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 font-medium">
                    Official Gazette Publication (DPDP Act & Rules) <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* NMC Telemedicine Guidelines */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  2. National Medical Commission (NMC) Telemedicine Practice Guidelines, 2020
                </span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full w-fit">
                  Binding Clinical Regulation
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Adopted under the National Medical Commission Act, 2019 (March 25, 2020). Explicitly establishes that Registered Medical Practitioners (RMPs) retain complete professional and legal accountability for clinical decisions and prescriptions. AI systems and software aids cannot issue autonomous prescriptions.
              </p>
              <div className="text-[11px] text-slate-500 pt-1 space-y-1">
                <div><strong>System Boundary:</strong> Architected around mandatory human clinician sign-off. All prescription authoring, interaction warnings, and OCR candidates function strictly as non-binding decision support and require explicit RMP review and authorization.</div>
                <div className="pt-0.5">
                  <a href="https://www.nmc.org.in/rules-regulations/telemedicine-practice-guidelines/" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 font-medium">
                    NMC Telemedicine Guidelines Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* ABDM Health Data Management Policy */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Ayushman Bharat Digital Mission (ABDM) Health Data Management Policy
                </span>
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full w-fit">
                  National Digital Health Policy (Voluntary Framework)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Published by the National Health Authority (NHA), April 2022. Establishes federated digital health architecture, interoperability standards (FHIR), Ayushman Bharat Health Account (ABHA) integration, electronic consent management, and data privacy principles.
              </p>
              <div className="text-[11px] text-slate-500 pt-1 space-y-1">
                <div><strong>Implementation Status:</strong> Standalone academic demonstration prototype. It is NOT integrated with or certified by the ABDM Sandbox (M1, M2, or M3 milestone verification).</div>
                <div className="pt-0.5">
                  <a href="https://abdm.gov.in/home/policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 font-medium">
                    NHA ABDM Policy Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* IT Act 2000 & SPDI Rules */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  4. Information Technology Act, 2000 & SPDI Rules, 2011
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full w-fit">
                  Currently Prevailing Statutory Baseline
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Section 43A and the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 categorize medical records as Sensitive Personal Data (SPDI). Under Section 44(2) of the DPDP Act 2023, Section 43A will be omitted upon notification; until that commencement, SPDI Rules 2011 remain the governing law.
              </p>
              <div className="text-[11px] text-slate-500 pt-1 space-y-1">
                <div><strong>Technical Safeguards:</strong> Implements standard engineering controls (bcrypt hashing, JWT stateless authentication, MySQL advisory locks, cryptographic single-use activation tokens) without claiming statutory SPDI certification or ISO/IEC 27001 audit compliance.</div>
                <div className="pt-0.5">
                  <a href="https://www.meity.gov.in/content/information-technology-act-2000" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 font-medium">
                    MeitY IT Act Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* CDSCO SaMD Guidance */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-5 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  5. CDSCO Medical Device Rules, 2017 & Software as a Medical Device (SaMD)
                </span>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full w-fit">
                  Regulatory Assessment Required
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Central Drugs Standard Control Organization (CDSCO) guidelines regulate clinical software. Determining whether clinical decision support software qualifies as low-moderate risk (Class A/B) or requires Class C/D licensing depends on whether it drives clinical management vs. serving as an informational reference aid.
              </p>
              <div className="text-[11px] text-slate-500 pt-1 space-y-1">
                <div><strong>Regulatory Status:</strong> Unclassified academic research prototype. Has not undergone CDSCO classification assessment, clinical trials, or Central Licensing Authority approval. Strictly uncertified for clinical deployment.</div>
                <div className="pt-0.5">
                  <a href="https://cdsco.gov.in/opencms/opencms/en/Medical-Device/Medical-Device/" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 font-medium">
                    CDSCO Medical Device Regulatory Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6: RESEARCH DATASETS & CLINICAL REFERENCES */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <span>Research Datasets & Authoritative Clinical References</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
            <p>
              The Clinical Decision Support and RAG knowledge base are grounded in publicly available authoritative scientific corpora:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <th className="py-2 pr-3 font-bold">Source Name</th>
                    <th className="py-2 px-3 font-bold">Authority / Institution</th>
                    <th className="py-2 px-3 font-bold">Clinical Purpose in CDSS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">DailyMed Structured Product Labels (SPL)</td>
                    <td className="py-2 px-3">U.S. National Library of Medicine (NLM / NIH)</td>
                    <td className="py-2 px-3">2,176 indexed chunks providing FDA package insert indications, contraindications, and boxed warnings.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">MedlinePlus Health Summaries</td>
                    <td className="py-2 px-3">U.S. National Library of Medicine (NLM)</td>
                    <td className="py-2 px-3">16 indexed chunks for patient-directed medication and lifestyle guidance.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">ICMR Standard Treatment Workflows</td>
                    <td className="py-2 px-3">Indian Council of Medical Research (ICMR)</td>
                    <td className="py-2 px-3">8 indexed clinical workflow chunks for diabetes and cardiovascular protocols in India.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">MoHFW National Treatment Guidelines</td>
                    <td className="py-2 px-3">Ministry of Health and Family Welfare (India)</td>
                    <td className="py-2 px-3">4 indexed clinical guidance chunks (Total Knowledge Corpus: 2,204 FAISS Chunks).</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">DrugBank Open Data</td>
                    <td className="py-2 px-3">OMx Health Inc. / University of Alberta</td>
                    <td className="py-2 px-3">8 verified bidirectional drug-drug interaction (DDI) rules and severity classifications.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">SIDER 4.1 Side Effect Resource</td>
                    <td className="py-2 px-3">European Molecular Biology Laboratory (EMBL)</td>
                    <td className="py-2 px-3">Adverse drug reaction (ADR) profiles and frequencies for 20 primary medications.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">BAAI/bge-small-en & ms-marco-MiniLM</td>
                    <td className="py-2 px-3">Beijing Academy of AI & Microsoft</td>
                    <td className="py-2 px-3">Dense embedding generation (384 dims) and cross-encoder second-stage reranking.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-200">TinyLlama-1.1B-Chat-v1.0</td>
                    <td className="py-2 px-3">Singapore University of Technology and Design (SUTD)</td>
                    <td className="py-2 px-3">Compact local natural language generation governed by fail-closed verifier.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION 7: HONEST DISCLOSURE OF GAPS & GRIEVANCE REDRESSAL */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Info className="h-4 w-4 text-primary-600" />
            <span>Honest Institutional Disclosures & Academic Grievance Redressal</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
            <p>
              To maintain academic integrity and transparent compliance boundaries, the following operational realities are explicitly disclosed:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>No Live Hospital Affiliation</strong>: This project is an engineering thesis prototype developed for academic demonstration. It is not affiliated with an operating hospital, clinical trial, or healthcare provider network.
              </li>
              <li>
                <strong>No Designated Data Protection Officer (DPO)</strong>: As an academic project running on a local workstation, no statutory DPO has been appointed under Section 10(2)(a) of the DPDP Act 2023.
              </li>
              <li>
                <strong>Synthetic Test Data Only</strong>: The database contains synthetic accounts created for automated testing. No automated data deletion or long-term retention schedule is active.
              </li>
              <li>
                <strong>Readiness Determination</strong>: The software is verified as <strong>Ready for Academic Demonstration</strong> and <strong>Ready for Controlled Testing with Synthetic Data</strong>. It is <strong>NOT Certified for Real Patient Data or Live Clinical Deployment</strong> until clinical validation trials, security penetration testing, and CDSCO/DPDP regulatory filings are completed.
              </li>
            </ul>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white block">Academic Project Grievance & Issue Reporting:</span>
                <span className="text-[11px] text-slate-500">For academic inquiries, ethical questions, bug reports, or synthetic record deletion requests:</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-mono text-xs font-semibold">
                <Mail className="h-3.5 w-3.5" /> cdss.project.audit@gmail.com
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/50 dark:border-slate-800/80 dark:bg-slate-900/50 py-6 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          Department of Computer Engineering • St. Vincent Pallotti College of Engineering and Technology, Nagpur
        </p>
        <p className="mt-1">
          Modular AI-Powered Clinical Decision Support System (CDSS) • Academic Major Project (2026)
        </p>
      </footer>
    </div>
  );
}
