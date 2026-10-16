import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Pill, Plus, Trash2, ShieldCheck, AlertTriangle, FileText, Upload, CheckCircle2, ArrowRight, Download, Camera } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";

export default function DoctorPrescriptions() {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("direct"); // "direct" | "assistant" | "ocr" | "history"
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(1);

  // Form states
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState([
    { medicine_name: "Metformin", dosage: "500 mg", frequency: "Twice daily", duration: "30 days", instructions: "Take with meals" }
  ]);

  // Safety Screening state
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyFindings, setSafetyFindings] = useState([]);
  const [safetyPassed, setSafetyPassed] = useState(false);

  // Assistant drafter state
  const [naturalText, setNaturalText] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  // OCR state
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrUploading, setOcrUploading] = useState(false);
  const [ocrJob, setOcrJob] = useState(null);
  const [ocrConfirmedMeds, setOcrConfirmedMeds] = useState([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [createdRxId, setCreatedRxId] = useState(null);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // History state
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Parse URL parameters if arriving from CDS or dossier
  useEffect(() => {
    async function init() {
      try {
        const list = await doctorApi.getPatients();
        setPatients(list);

        const params = new URLSearchParams(location.search);
        const urlPatientId = params.get("patient_id");
        if (urlPatientId) {
          setSelectedPatientId(parseInt(urlPatientId, 10));
        } else if (list.length > 0) {
          setSelectedPatientId(list[0].patient_id);
        }

        const urlDiagnosis = params.get("diagnosis");
        if (urlDiagnosis) {
          setDiagnosis(urlDiagnosis);
        }

        const urlMeds = params.get("meds");
        if (urlMeds) {
          const medNames = urlMeds.split(",").map((m) => m.trim()).filter(Boolean);
          if (medNames.length > 0) {
            setMedicines(
              medNames.map((name) => ({
                medicine_name: name,
                dosage: "Standard dose",
                frequency: "Once daily",
                duration: "30 days",
                instructions: "As directed"
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    }
    init();
  }, [location]);

  // Load prescription history
  const loadHistory = async (patientId) => {
    const pId = patientId || selectedPatientId;
    if (!pId) return;
    setHistoryLoading(true);
    try {
      const history = await doctorApi.getPatientPrescriptions(pId);
      setPrescriptionHistory(history);
    } catch (err) {
      console.warn("Could not load prescription history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, selectedPatientId]);

  // Direct medicine row handlers
  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      { medicine_name: "", dosage: "", frequency: "Once daily", duration: "7 days", instructions: "" }
    ]);
    setSafetyPassed(false);
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
    setSafetyPassed(false);
  };

  const handleMedicineChange = (idx, field, value) => {
    const updated = [...medicines];
    updated[idx][field] = value;
    setMedicines(updated);
    setSafetyPassed(false);
  };

  // Deterministic Safety Screening via CDS Bridge
  const handleRunSafetyCheck = async () => {
    const medNames = medicines.map((m) => m.medicine_name.trim()).filter(Boolean);
    if (medNames.length === 0) {
      setError("Please add at least one medication to screen.");
      return;
    }

    setSafetyChecking(true);
    setError("");
    setSafetyFindings([]);

    try {
      const res = await doctorApi.screenPrescription({
        patientId: selectedPatientId,
        candidateMedications: medNames,
      });

      const findings = res.safety_findings || [];
      setSafetyFindings(findings);
      setSafetyPassed(true);
    } catch (err) {
      setError(err?.message || "Safety analysis failed. Please check network.");
    } finally {
      setSafetyChecking(false);
    }
  };

  // Direct Submission & Persistence
  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    const validMeds = medicines.filter((m) => m.medicine_name.trim());
    if (validMeds.length === 0) {
      setError("At least one medicine is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    setCreatedRxId(null);

    try {
      const res = await doctorApi.createPrescription({
        patient_id: selectedPatientId,
        diagnosis: diagnosis || "General Clinical Care",
        notes,
        medicines: validMeds
      });

      if (res.duplicate_prevented) {
        setSuccessMessage(`Prescription already recorded: Prescription #${res.prescription_id} (duplicate submission prevented).`);
      } else {
        setSuccessMessage("Prescription verified, finalized, and saved to hospital database!");
      }
      setCreatedRxId(res.prescription_id || res.id);
      loadHistory();
    } catch (err) {
      const contraMsg =
        err?.contraindications?.join(" ") ||
        err?.response?.data?.contraindications?.join(" ") ||
        "";
      setError(
        contraMsg
          ? `${err.message || "Safety Failure"}: ${contraMsg}`
          : (err?.message || "Failed to persist prescription.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Authenticated PDF Blob Downloader
  const handleDownloadPDF = async (prescriptionId) => {
    if (!prescriptionId) return;
    setDownloadingId(prescriptionId);
    try {
      const blob = await doctorApi.downloadPrescriptionPDF(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prescription-${prescriptionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || "Failed to download prescription PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  // CDS-Assisted Natural Text Parser
  const handleParseAssistantDraft = () => {
    if (!naturalText.trim()) return;
    setAssistantLoading(true);

    try {
      // Rule-based structured extraction from free-text
      const lines = naturalText.split(/[,;\n]+/).map((l) => l.trim()).filter(Boolean);
      const extracted = [];

      for (const line of lines) {
        const doseMatch = line.match(/(\d+\s*(?:mg|g|ml|mcg|tablets?|capsules?))/i);
        const freqMatch = line.match(/(once\s*daily|twice\s*daily|thrice\s*daily|bd|tds|od|qds|bedtime|every\s*\d+\s*hours?)/i);
        const durMatch = line.match(/(\d+\s*(?:days?|weeks?|months?))/i);

        let medName = line;
        if (doseMatch) medName = medName.replace(doseMatch[0], "");
        if (freqMatch) medName = medName.replace(freqMatch[0], "");
        if (durMatch) medName = medName.replace(durMatch[0], "");
        medName = medName.replace(/\b(?:take|for|tab|tablet|cap|rx|capsule)\b/gi, "").trim();

        if (medName) {
          extracted.push({
            medicine_name: medName,
            dosage: doseMatch ? doseMatch[0] : "As directed",
            frequency: freqMatch ? freqMatch[0] : "Once daily",
            duration: durMatch ? durMatch[0] : "14 days",
            instructions: "Take after meals"
          });
        }
      }

      if (extracted.length > 0) {
        setMedicines(extracted);
        setActiveTab("direct");
        setSafetyPassed(false);
        setSuccessMessage("Extracted structured prescription medicines! Please review and run safety check.");
      } else {
        setError("Could not extract structured medicines. Please enter them directly.");
      }
    } catch (err) {
      setError("Failed to parse prescription text.");
    } finally {
      setAssistantLoading(false);
    }
  };

  // OCR Upload Handler
  const handleOcrUpload = async (e) => {
    e.preventDefault();
    if (!ocrFile) {
      setError("Please select an image file to upload.");
      return;
    }

    setOcrUploading(true);
    setError("");
    setOcrJob(null);

    try {
      const formData = new FormData();
      formData.append("prescription_image", ocrFile);
      formData.append("patient_id", selectedPatientId);

      const res = await doctorApi.uploadPrescriptionOcr(formData);
      setOcrJob(res.job);
      const parsedMeds = res.job?.parsed_medicines || [];
      setOcrConfirmedMeds(
        parsedMeds.length > 0
          ? parsedMeds
          : [{ medicine_name: "Extracted Med", dosage: "500 mg", frequency: "Once daily", duration: "7 days" }]
      );
    } catch (err) {
      setError(err?.message || "OCR processing failed.");
    } finally {
      setOcrUploading(false);
    }
  };

  // OCR Confirm and Finalize Handler
  const handleConfirmOcr = async () => {
    if (!ocrJob?.job_id) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await doctorApi.confirmPrescriptionOcr(ocrJob.job_id, {
        patient_id: selectedPatientId,
        diagnosis: diagnosis || "Prescription OCR Review",
        notes: `Verified OCR job #${ocrJob.job_id}`,
        medicines: ocrConfirmedMeds
      });

      setSuccessMessage(`OCR Prescription successfully confirmed and persisted as Prescription #${res.prescription_id}!`);
      setCreatedRxId(res.prescription_id);
      setOcrJob(null);
      setOcrFile(null);
      loadHistory();
    } catch (err) {
      setError(err?.message || "Failed to confirm OCR prescription.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-indigo-950 text-white shadow-xl relative overflow-hidden border border-primary-800/40">
        <div className="space-y-1 z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 text-primary-200 text-xs font-semibold backdrop-blur-xs border border-primary-400/20">
            <ShieldCheck className="h-3.5 w-3.5 text-primary-300" />
            <span>Deterministic Safety Verification • Doctor-in-the-Loop</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Prescription Authoring & Safety Studio
          </h1>
          <p className="text-xs sm:text-sm text-primary-100/80">
            Create direct electronic prescriptions, draft assisted regimens, and verify physical prescription OCR.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <div className="flex flex-col">
            <label className="text-[11px] font-bold uppercase tracking-wider text-primary-300 mb-1">
              Select Patient
            </label>
            <select
              value={selectedPatientId || ""}
              onChange={(e) => {
                setSelectedPatientId(parseInt(e.target.value, 10));
                setSafetyPassed(false);
              }}
              className="bg-primary-900/80 border border-primary-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-hidden focus:border-white cursor-pointer"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id} className="text-slate-900">
                  {p.full_name} (#{p.patient_id})
                </option>
              ))}
            </select>
            {(() => {
              const activePat = patients.find((p) => p.patient_id === selectedPatientId);
              if (!activePat) return null;
              return (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-primary-200">
                    {activePat.gender || "Patient"} • Blood: {activePat.blood_group || "—"}
                  </span>
                  {activePat.allergies ? (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold border border-rose-400/30">
                      Allergy: {activePat.allergies}
                    </span>
                  ) : (
                    <span className="text-primary-300/80">No documented allergies</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300/60 dark:border-slate-700/60 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("direct")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "direct"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          <span>Direct Form Entry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assistant")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "assistant"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Natural Text Drafter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ocr")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "ocr"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Prescription OCR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "history"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Saved History</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs sm:text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          {createdRxId && (
            <button
              type="button"
              onClick={() => handleDownloadPDF(createdRxId)}
              disabled={downloadingId === createdRxId}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{downloadingId === createdRxId ? "Downloading..." : "Download PDF →"}</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: DIRECT FORM ENTRY */}
      {activeTab === "direct" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Electronic Prescription Form
              </h2>
              <p className="text-xs text-slate-500">
                Author and confirm structured regimens with automated drug interaction screening.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddMedicine}
              className="px-3.5 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 hover:bg-primary-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Medication</span>
            </button>
          </div>

          <form onSubmit={handleSubmitPrescription} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Clinical Diagnosis
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes Mellitus with Essential Hypertension"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Clinical Notes / Special Precautions
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Monitor serum potassium in 2 weeks"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500"
                />
              </div>
            </div>

            {/* Medicines List */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Prescribed Medications
              </span>

              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Medication Name
                    </label>
                    <input
                      type="text"
                      value={med.medicine_name}
                      onChange={(e) => handleMedicineChange(idx, "medicine_name", e.target.value)}
                      placeholder="e.g. Lisinopril"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => handleMedicineChange(idx, "dosage", e.target.value)}
                      placeholder="e.g. 10 mg"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Frequency
                    </label>
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => handleMedicineChange(idx, "frequency", e.target.value)}
                      placeholder="Once daily"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(idx, "duration", e.target.value)}
                        placeholder="30 days"
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(idx)}
                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Remove medicine"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Safety Findings Display */}
            {safetyFindings.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Deterministic Drug Safety Alert Detected</span>
                </div>
                {safetyFindings.map((f, i) => (
                  <div key={i} className="text-xs text-rose-900 dark:text-rose-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      {f.rule_id && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-[10px] font-mono tracking-wide text-rose-950 dark:text-rose-100">
                          {f.rule_id}
                        </span>
                      )}
                      {f.severity && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] uppercase font-bold">
                          {f.severity}
                        </span>
                      )}
                      <span>{f.drugs && f.drugs.length > 0 ? f.drugs.join(" ⇄ ") : (f.rule_id || "Allergy Rule")}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-900/90 dark:text-rose-200/90">
                      {f.description || f.clinical_consequence}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Clean Safety Screen Confirmation */}
            {safetyPassed && safetyFindings.length === 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Deterministic Screening Cleared:</strong> No known drug-drug interactions or documented patient allergies detected for candidate medications. Clinical evaluation remains the prescribing clinician's responsibility.
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleRunSafetyCheck}
                disabled={safetyChecking}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>{safetyChecking ? "Checking Interactions..." : "Run Safety Analysis"}</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-500 shadow-md shadow-primary-600/30 flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span>Persisting to Database...</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm & Persist Prescription</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: NATURAL TEXT DRAFTER */}
      {activeTab === "assistant" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Natural Language Prescription Drafter
            </h2>
            <p className="text-xs text-slate-500">
              Type or dictate clinical prescription instructions. The system parses structured medicines, routes, and frequencies into the review form.
            </p>
          </div>

          <textarea
            rows={4}
            value={naturalText}
            onChange={(e) => setNaturalText(e.target.value)}
            placeholder="e.g. Rx: Metformin 500mg twice daily with meals for 30 days, Lisinopril 10mg once daily in the morning for 30 days"
            className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleParseAssistantDraft}
              disabled={assistantLoading}
              className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>Parse into Prescription Form</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PRESCRIPTION OCR UPLOAD */}
      {activeTab === "ocr" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Physical Prescription OCR & Review Workflow
            </h2>
            <p className="text-xs text-slate-500">
              Upload scanned or photographed paper prescriptions. Tesseract.js extracts medicines offline, enforcing clinician review before persistence.
            </p>
          </div>

          <form onSubmit={handleOcrUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3">
              <Upload className="h-10 w-10 text-slate-400 mx-auto" />
              <div>
                <label className="text-xs sm:text-sm font-bold text-primary-600 hover:underline cursor-pointer">
                  <span>Select Prescription Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setOcrFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, or WEBP (Max 5MB)</p>
              </div>
              {ocrFile && (
                <div className="inline-block px-3 py-1 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-xs rounded-lg">
                  Selected: {ocrFile.name}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={ocrUploading || !ocrFile}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {ocrUploading ? <span>Running Local OCR Pipeline...</span> : <span>Process Prescription with OCR</span>}
            </button>
          </form>

          {/* OCR Review Invariant Form */}
          {ocrJob && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  OCR Job #{ocrJob.job_id} • Raw Text & Review
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Awaiting Clinician Confirmation
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                {ocrJob.raw_ocr_text || "No text parsed"}
              </div>

              {/* Extracted Medicines Editable Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Extracted Medications (Clinician Review):
                </span>
                {ocrConfirmedMeds.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 text-xs">
                    <input
                      type="text"
                      value={med.medicine_name}
                      onChange={(e) => {
                        const copy = [...ocrConfirmedMeds];
                        copy[idx].medicine_name = e.target.value;
                        setOcrConfirmedMeds(copy);
                      }}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                      placeholder="Med Name"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => {
                        const copy = [...ocrConfirmedMeds];
                        copy[idx].dosage = e.target.value;
                        setOcrConfirmedMeds(copy);
                      }}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      placeholder="Dosage"
                    />
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => {
                        const copy = [...ocrConfirmedMeds];
                        copy[idx].frequency = e.target.value;
                        setOcrConfirmedMeds(copy);
                      }}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      placeholder="Frequency"
                    />
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => {
                        const copy = [...ocrConfirmedMeds];
                        copy[idx].duration = e.target.value;
                        setOcrConfirmedMeds(copy);
                      }}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      placeholder="Duration"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleConfirmOcr}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve & Finalize OCR Prescription</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAVED PRESCRIPTIONS HISTORY */}
      {activeTab === "history" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Prescription History for Selected Patient
            </h2>
            <button
              onClick={() => loadHistory()}
              className="text-xs font-bold text-primary-600 hover:underline cursor-pointer"
            >
              Refresh ↻
            </button>
          </div>

          {historyLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading prescription history...</div>
          ) : prescriptionHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No previous prescriptions found for this patient.
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptionHistory.map((rx) => (
                <div
                  key={rx.prescription_id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Prescription #{rx.prescription_id}
                      </span>
                      <span className="text-slate-400 ml-2">
                        ({new Date(rx.created_at).toLocaleDateString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(rx.prescription_id)}
                      disabled={downloadingId === rx.prescription_id}
                      className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{downloadingId === rx.prescription_id ? "Downloading..." : "Download PDF"}</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Diagnosis:</strong> {rx.diagnosis || "Clinical assessment"}
                  </div>

                  {rx.medicines && rx.medicines.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                            <th className="pb-1 font-bold">Medicine</th>
                            <th className="pb-1 font-bold">Dosage</th>
                            <th className="pb-1 font-bold">Frequency</th>
                            <th className="pb-1 font-bold">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {rx.medicines.map((m, i) => (
                            <tr key={i}>
                              <td className="py-1.5 font-bold text-slate-900 dark:text-white">{m.medicine_name}</td>
                              <td className="py-1.5 text-slate-600 dark:text-slate-300">{m.dosage}</td>
                              <td className="py-1.5 text-slate-600 dark:text-slate-300">{m.frequency}</td>
                              <td className="py-1.5 text-slate-600 dark:text-slate-300">{m.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
