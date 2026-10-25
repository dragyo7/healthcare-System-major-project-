import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, User, AlertTriangle, ShieldCheck, Pill, ArrowRight, Send, CheckCircle2, AlertOctagon, BookOpen, Globe2 } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DoctorCDS() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language: globalLanguage, setLanguage: setGlobalLanguage } = useLanguage();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(1);
  const [patientDossier, setPatientDossier] = useState(null);
  const [clinicalQuery, setClinicalQuery] = useState("");
  const [candidateMeds, setCandidateMeds] = useState("");
  const [language, setLanguage] = useState(globalLanguage && globalLanguage !== "en" ? globalLanguage : "auto");

  useEffect(() => {
    if (globalLanguage && globalLanguage !== "en") {
      setLanguage(globalLanguage);
    }
  }, [globalLanguage]);

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");

  // Preset demo queries
  const demoQueries = [
    {
      label: "Metformin Adult Dosage",
      query: "What is the recommended starting dose of Metformin for adults with type 2 diabetes?",
      meds: "Metformin"
    },
    {
      label: "Lisinopril + Potassium Interaction",
      query: "What is the clinical interaction between Lisinopril and Potassium Chloride supplements?",
      meds: "Lisinopril, Potassium Chloride"
    },
    {
      label: "Atorvastatin Contraindications",
      query: "What are the contraindications and warnings for Atorvastatin?",
      meds: "Atorvastatin"
    },
    {
      label: "Emergency Chest Pain Check",
      query: "Patient reports severe crushing chest pain, diaphoresis, and shortness of breath.",
      meds: ""
    }
  ];

  // Load patients list and URL patient_id if present
  useEffect(() => {
    async function init() {
      try {
        const list = await doctorApi.getPatients();
        setPatients(list);

        const params = new URLSearchParams(location.search);
        const urlId = params.get("patient_id");
        if (urlId) {
          setSelectedPatientId(parseInt(urlId, 10));
        } else if (list.length > 0) {
          setSelectedPatientId(list[0].patient_id);
        }
      } catch (err) {
        console.error("Failed to load patients for CDS:", err);
      }
    }
    init();
  }, [location]);

  // Load patient dossier whenever selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId) return;

    // Isolate context: switching patients clears previous chat and in-flight responses
    setResponse(null);
    setError("");
    setClinicalQuery("");
    setCandidateMeds("");
    setPatientDossier(null);

    async function loadDossier() {
      try {
        const details = await doctorApi.getPatientDetails(selectedPatientId);
        setPatientDossier(details);
      } catch (err) {
        console.warn("Could not fetch dossier for CDS context:", err);
      }
    }
    loadDossier();
  }, [selectedPatientId]);

  const handleEvaluate = async (e) => {
    if (e) e.preventDefault();
    if (!clinicalQuery.trim()) {
      setError("Please enter a clinical query.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const candidateList = candidateMeds
        ? candidateMeds.split(",").map((m) => m.trim()).filter(Boolean)
        : [];

      const res = await doctorApi.evaluateCDS({
        patientId: selectedPatientId,
        clinicalQuery: clinicalQuery.trim(),
        candidateMedications: candidateList,
        language,
      });

      setResponse(res);
    } catch (err) {
      setError(err?.message || "Failed to evaluate clinical query through CDS gateway.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDemo = (item) => {
    setClinicalQuery(item.query);
    setCandidateMeds(item.meds);
    setError("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-indigo-950 text-white shadow-xl relative overflow-hidden border border-primary-800/40">
        <div className="space-y-1 z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 text-primary-200 text-xs font-semibold backdrop-blur-xs border border-primary-400/20">
            <Sparkles className="h-3.5 w-3.5 text-primary-300" />
            <span>Evidence-Grounded Clinical Guidance • Safety Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Clinical Decision Support (CDS) Assistant
          </h1>
          <p className="text-xs sm:text-sm text-primary-100/80">
            Query DailyMed FDA monographs, drug-drug safety rules, and patient context with fail-closed verifier enforcement.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <div className="flex flex-col">
            <label className="text-[11px] font-bold uppercase tracking-wider text-primary-300 mb-1">
              Active Patient Context
            </label>
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(parseInt(e.target.value, 10))}
              className="bg-primary-900/80 border border-primary-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-hidden focus:border-white cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id} className="text-slate-900">
                  {p.full_name} (#{p.patient_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Query Console & Patient Dossier Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Clinical Query Workspace */}
        <div className="lg:col-span-2 space-y-6">
          {/* Query Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Quick Clinical Benchmarks
              </span>
              <div className="flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="auto">🌐 Auto Detect</option>
                  <option value="en">English (en)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="gu">ગુજરાતી (Gujarati)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {demoQueries.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyDemo(item)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleEvaluate} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Clinical Inquiry or Diagnostic Question
                </label>
                <textarea
                  rows={3}
                  value={clinicalQuery}
                  onChange={(e) => setClinicalQuery(e.target.value)}
                  placeholder="Enter medical question, dosing inquiry, or symptoms..."
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Candidate Medications to Screen (Optional)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Comma-separated active ingredients</span>
                </label>
                <input
                  type="text"
                  value={candidateMeds}
                  onChange={(e) => setCandidateMeds(e.target.value)}
                  placeholder="e.g. Lisinopril, Potassium Chloride, Metformin"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span>Synthesizing Evidence & Verifying Safety...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Run Clinical Decision Support Evaluation</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Display */}
          {response && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5 animate-fadeIn">
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Verification Status:
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      response.verification_status === "grounded"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : response.verification_status === "partially_grounded"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                        : response.verification_status === "emergency_intercept"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                    }`}
                  >
                    {response.verification_status || "evaluating"}
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  Execution Mode: <strong>{response.execution_mode || "doctor"}</strong>
                </div>
              </div>

              {/* Emergency Warning */}
              {response.is_emergency && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-start gap-3">
                  <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-sm">Emergency Triage Interception</h3>
                    <p className="text-xs mt-1">
                      {response.emergency_advice || "Potential life-threatening clinical symptoms detected. Initiate emergency protocols immediately."}
                    </p>
                  </div>
                </div>
              )}

              {/* Synthesized Clinical Answer */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Grounded Clinical Assessment
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap font-sans">
                  {response.answer || response.withheld_explanation || "No answer generated by policy."}
                </div>
              </div>

              {/* Drug-Drug Safety Findings */}
              {response.safety_findings && response.safety_findings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Deterministic Drug Safety Alerts ({response.safety_findings.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {response.safety_findings.map((f, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs ${
                          f.severity === "high" || f.severity === "severe"
                            ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                            : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>
                            {f.drugs
                              ? (Array.isArray(f.drugs) ? f.drugs.join(" ⇄ ") : f.drugs)
                              : (Array.isArray(f.drug_pair) ? f.drug_pair.join(" ⇄ ") : (f.rule_id || "Drug Interaction"))}
                          </span>
                          <span className="uppercase text-[10px] px-2 py-0.5 rounded font-black">
                            {f.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-90">{f.description || f.clinical_consequence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations & Evidence Chunks */}
              {response.citations && response.citations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary-600" />
                    <span>Evidence Citations ({response.citations.length})</span>
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {response.citations.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                      >
                        <div className="flex justify-between items-center text-[11px] font-bold text-primary-600 dark:text-primary-400">
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline font-semibold"
                            >
                              {c.title || c.source_name || c.source || `Evidence Reference #${idx + 1}`}
                            </a>
                          ) : (
                            <span>{c.title || c.source_name || c.source || `Evidence Reference #${idx + 1}`}</span>
                          )}
                          <span>Score: {typeof c.score === "number" ? c.score.toFixed(3) : "Verified"}</span>
                        </div>
                        {c.publisher && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Publisher: {c.publisher}</div>
                        )}
                        {(c.text || c.chunk_text) && (
                          <p className="mt-1 text-slate-600 dark:text-slate-300 text-[11px] italic">
                            "{c.text || c.chunk_text}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Ready to draft a prescription based on these findings?
                </span>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/doctor/prescriptions?patient_id=${selectedPatientId}&meds=${encodeURIComponent(
                        candidateMeds
                      )}&diagnosis=${encodeURIComponent(clinicalQuery)}`
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
                >
                  <Pill className="h-3.5 w-3.5" />
                  <span>Draft Prescription in Authoring Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Active Patient Dossier Summary */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-600" />
              <span>Patient Clinical Dossier</span>
            </h2>

            {patientDossier?.patient ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-100 dark:border-primary-900">
                  <div className="font-extrabold text-sm text-primary-950 dark:text-primary-100">
                    {patientDossier.patient.full_name}
                  </div>
                  <div className="text-primary-700 dark:text-primary-300 text-[11px] mt-0.5">
                    ID #{patientDossier.patient.patient_id} • Blood: {patientDossier.patient.blood_group || "—"} • Gender: {patientDossier.patient.gender}
                  </div>
                </div>

                {/* Known Conditions */}
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                    Documented Diagnoses
                  </span>
                  {patientDossier.medical_history?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {patientDossier.medical_history.map((h, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          {h.condition_name || h.diagnosis}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">None on record</span>
                  )}
                </div>

                {/* Active Prescriptions */}
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                    Active Medications
                  </span>
                  {patientDossier.prescriptions?.length > 0 ? (
                    <div className="space-y-1.5">
                      {patientDossier.prescriptions.slice(0, 3).map((rx) =>
                        rx.medicines?.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]"
                          >
                            <span className="font-bold text-slate-900 dark:text-white">{m.medicine_name}</span>
                            <span className="text-slate-500">{m.dosage}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">No active prescriptions</span>
                  )}
                </div>

                {/* Symptoms */}
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">
                    Current Symptoms
                  </span>
                  {patientDossier.symptoms?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {patientDossier.symptoms.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                        >
                          {s.symptom_name} ({s.severity || "Moderate"})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">No active symptoms</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Loading patient summary...</p>
            )}
          </div>

          {/* Safety Invariant Notice */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Strict Fail-Closed Architecture</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Every clinical query is filtered by the <strong>AnswerGroundingVerifier</strong>. If medical claims diverge from retrieved DailyMed FDA monographs, responses are safely withheld to prevent confabulation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
