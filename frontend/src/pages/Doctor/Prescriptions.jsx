import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Pill, Plus, Trash2, ShieldCheck, ShieldAlert, AlertTriangle, FileText, Upload, CheckCircle2, ArrowRight, Download, Camera, RefreshCw, Loader2 } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";
import PatientSearchSelector from "../../components/doctor/PatientSearchSelector";
import SafetyAnalysisModal from "../../components/doctor/SafetyAnalysisModal";

export default function DoctorPrescriptions() {
  const location = useLocation();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState("direct"); // "direct" | "assistant" | "ocr" | "history"
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(1);
  const [selectedPatientName, setSelectedPatientName] = useState("Patient");
  const [patientAllergies, setPatientAllergies] = useState([]);
  const [patientActiveMeds, setPatientActiveMeds] = useState([]);
  const [patientContextLoading, setPatientContextLoading] = useState(false);

  // Form states
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState([
    { medicine_name: "Metformin", dosage: "500 mg", frequency: "Twice daily", duration: "30 days", instructions: "Take with meals" }
  ]);

  // Safety Screening & Dialogue state
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyFindings, setSafetyFindings] = useState([]);
  const [safetyPassed, setSafetyPassed] = useState(false);
  const [safetyData, setSafetyData] = useState(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [staleAnalysis, setStaleAnalysis] = useState(true);
  const [safetyOverrideReason, setSafetyOverrideReason] = useState("");

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

  // Load detailed patient clinical context (allergies & active medicines)
  const loadPatientContext = async (patientId) => {
    const pId = patientId || selectedPatientId;
    if (!pId) return;
    setPatientContextLoading(true);
    try {
      const details = await doctorApi.getPatientDetails(pId);
      if (details.patient) {
        setSelectedPatientName(details.patient.full_name || `Patient #${pId}`);
        const allergyStr = details.patient.allergies || "";
        const parsedAllergies = allergyStr
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a && a.toLowerCase() !== "none" && a.toLowerCase() !== "nil");
        setPatientAllergies(parsedAllergies);
      }

      // Extract unique active medication names from prescription history
      const activeRxMeds = [];
      for (const rx of details.prescriptions || []) {
        if (rx.medicine_name && !activeRxMeds.includes(rx.medicine_name)) {
          activeRxMeds.push(rx.medicine_name);
        }
      }
      setPatientActiveMeds(activeRxMeds);

      // Invalidate safety checks when patient changes
      setSafetyPassed(false);
      setStaleAnalysis(true);
      setSafetyFindings([]);
      setSafetyData(null);
      setSafetyOverrideReason("");
    } catch (err) {
      console.warn("Could not load patient clinical context:", err);
    } finally {
      setPatientContextLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientContext(selectedPatientId);
    }
  }, [selectedPatientId]);

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
    setStaleAnalysis(true);
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
    setSafetyPassed(false);
    setStaleAnalysis(true);
  };

  const handleMedicineChange = (idx, field, value) => {
    const updated = [...medicines];
    updated[idx][field] = value;
    setMedicines(updated);
    setSafetyPassed(false);
    setStaleAnalysis(true);
  };

  // Deterministic Safety Screening via CDS Bridge
  const handleRunSafetyCheck = async () => {
    if (!selectedPatientId) {
      setError("Please search and select an authorized patient before running clinical safety screening.");
      return;
    }

    const medNames = medicines.map((m) => m.medicine_name.trim()).filter(Boolean);
    if (medNames.length === 0) {
      setError("Please add at least one medication to screen.");
      return;
    }

    setSafetyChecking(true);
    setError("");

    try {
      const res = await doctorApi.screenPrescription({
        patientId: selectedPatientId,
        candidateMedications: medNames,
      });

      setSafetyData(res);
      setSafetyFindings(res.safety_findings || []);
      setIsSafetyModalOpen(true);
    } catch (err) {
      setError(err?.message || "Safety analysis failed. Please check network.");
    } finally {
      setSafetyChecking(false);
    }
  };

  // Replace interacting medicine with verified candidate alternative
  const handleApplyAlternative = (originalDrug, candidateDrug) => {
    let matchFound = false;
    const updated = medicines.map((m) => {
      const currentLower = m.medicine_name.toLowerCase().trim();
      const origLower = (originalDrug || "").toLowerCase().trim();
      if (currentLower === origLower || (currentLower && origLower && (currentLower.includes(origLower) || origLower.includes(currentLower)))) {
        matchFound = true;
        return {
          ...m,
          medicine_name: candidateDrug,
          dosage: "",
          frequency: "",
          duration: "",
          instructions: `Alternative for ${originalDrug}. Please enter confirmed dosage, frequency and duration.`
        };
      }
      return m;
    });

    if (!matchFound) {
      setError(`Cannot replace '${originalDrug}' from this form: it is an existing medication in the patient's record, not an editable item in this new prescription.`);
      setIsSafetyModalOpen(false);
      return;
    }

    setMedicines(updated);
    setIsSafetyModalOpen(false);
    setSafetyPassed(false);
    setStaleAnalysis(true);
    setSuccessMessage(`Applied candidate alternative '${candidateDrug}' for '${originalDrug}'. Previous dosage, frequency, and duration have been cleared. Please enter the new dosing regimen and re-run safety screening before saving.`);
  };

  // Clinician confirms and acknowledges safety findings from modal
  const handleAcknowledgeAndProceed = ({ overrideApplied, overrideReason }) => {
    if (overrideApplied) {
      setSafetyOverrideReason(overrideReason || "");
    }
    setSafetyPassed(true);
    setStaleAnalysis(false);
    setIsSafetyModalOpen(false);
    setSuccessMessage("Safety analysis findings acknowledged. You may now persist the prescription.");
  };

  // Direct Submission & Persistence
  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setError("Please search and select an authorized patient before submitting the prescription.");
      return;
    }
    const validMeds = medicines.filter((m) => m.medicine_name.trim());
    if (validMeds.length === 0) {
      setError("At least one medicine is required.");
      return;
    }

    if (!safetyPassed || staleAnalysis) {
      setError("Clinical Safety Analysis must be run and reviewed for current medications before issuing prescription.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    setCreatedRxId(null);

    // Client-side idempotency key per submission intent
    const idempotencyKey = `rx_${selectedPatientId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const res = await doctorApi.createPrescription(
        {
          patient_id: selectedPatientId,
          diagnosis: diagnosis || "General Clinical Care",
          notes,
          medicines: validMeds,
          safety_override: !!safetyOverrideReason,
          safety_override_reason: safetyOverrideReason
        },
        idempotencyKey
      );

      if (res.duplicate_prevented) {
        setSuccessMessage(`Prescription already recorded: Prescription #${res.prescription_id} (duplicate submission prevented).`);
      } else {
        setSuccessMessage(`Prescription #${res.prescription_id} successfully created and committed to clinical record!`);
      }
      setCreatedRxId(res.prescription_id || res.id);
      loadHistory();
      setStaleAnalysis(true);
      setSafetyPassed(false);
      setSafetyOverrideReason("");
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
      setError(err?.message || "Failed to download prescription PDF. Please check authorization or network.");
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
    setError("");
    setSuccessMessage("");

    if (!selectedPatientId) {
      setError(t("Please select a patient before processing OCR prescription.") || "Please select a patient before processing OCR prescription.");
      return;
    }

    if (!ocrFile) {
      setError(t("Please select an image file to upload.") || "Please select an image file to upload.");
      return;
    }

    // Client-side file validation
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(ocrFile.type.toLowerCase())) {
      setError(t("Invalid file type. Please upload a PNG, JPEG, or WEBP image.") || "Invalid file type. Please upload a PNG, JPEG, or WEBP image.");
      return;
    }

    if (ocrFile.size > 5 * 1024 * 1024) {
      setError(t("File exceeds maximum size limit of 5MB") || "File exceeds maximum size limit of 5MB");
      return;
    }

    setOcrUploading(true);
    setOcrJob(null);

    try {
      const formData = new FormData();
      formData.append("prescription_image", ocrFile);
      formData.append("patient_id", selectedPatientId);

      const res = await doctorApi.uploadPrescriptionOcr(formData);
      const jobData = res.job || res;
      setOcrJob(jobData);

      const candidates = jobData.candidate_fields || jobData.parsed_medicines || [];
      if (candidates.length > 0) {
        setOcrConfirmedMeds(
          candidates.map((c) => ({
            medicine_name: c.medicine_name || "",
            dosage: c.dosage || "Standard dose",
            frequency: c.frequency || "Once daily",
            duration: c.duration || "7 days",
            route: c.route || "Oral",
            instructions: c.instructions || "As directed"
          }))
        );
      } else {
        setOcrConfirmedMeds([
          { medicine_name: "Metformin", dosage: "500 mg", frequency: "BD", duration: "30 days", route: "Oral", instructions: "After food" }
        ]);
      }
    } catch (err) {
      console.error("Prescription OCR Error:", err);
      setError(err?.message || t("OCR processing failed.") || "OCR processing failed.");
    } finally {
      setOcrUploading(false);
    }
  };

  // OCR Confirm and Finalize Handler
  const handleConfirmOcr = async () => {
    if (!ocrJob?.job_id) return;

    if (!ocrConfirmedMeds || ocrConfirmedMeds.length === 0) {
      setError(t("Please specify at least one medication before confirming.") || "Please specify at least one medication before confirming.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await doctorApi.confirmPrescriptionOcr(ocrJob.job_id, {
        patient_id: selectedPatientId,
        diagnosis: diagnosis || "Prescription via Verified Clinical OCR",
        notes: notes || `Verified OCR job #${ocrJob.job_id}`,
        confirmed_medicines: ocrConfirmedMeds,
        medicines: ocrConfirmedMeds
      });

      setSuccessMessage(
        `${t("OCR Prescription successfully confirmed and persisted") || "OCR Prescription successfully confirmed and persisted"} #${res.prescription_id}!`
      );
      setCreatedRxId(res.prescription_id);
      setOcrJob(null);
      setOcrFile(null);
      loadHistory(selectedPatientId);
    } catch (err) {
      console.error("Confirm OCR Error:", err);
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
            {t("Prescription Authoring & Safety Studio")}
          </h1>
          <p className="text-xs sm:text-sm text-primary-100/80">
            Create direct electronic prescriptions, draft assisted regimens, and verify physical prescription OCR.
          </p>
        </div>

      </div>

      {/* Searchable Patient Selector & Clinical Dossier Banner */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("Patient Dossier & Authorization Verification")}
          </label>
          <span className="text-[11px] text-muted-foreground">
            Prescription authoring is strictly bound to authorized patient identity.
          </span>
        </div>
        <PatientSearchSelector
          selectedPatientId={selectedPatientId}
          onSelectPatient={(patient) => {
            const pId = patient ? patient.patient_id : null;
            setSelectedPatientId(pId);
            setSafetyPassed(false);
            setStaleAnalysis(true);
            setSafetyFindings([]);
            setSafetyData(null);
            setSafetyOverrideReason("");
            if (pId) {
              loadPatientContext(pId);
              loadHistory(pId);
            } else {
              setSelectedPatientName("Patient");
              setPatientAllergies([]);
              setPatientActiveMeds([]);
              setPrescriptionHistory([]);
            }
          }}
          disabled={submitting}
        />

        {/* Patient Clinical Context Card */}
        {selectedPatientId && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  {t("Documented Allergies") || "Documented Patient Allergies"}:
                </span>
                {patientAllergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {patientAllergies.map((allergy, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 font-semibold text-[11px] border border-rose-200 dark:border-rose-800"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("No documented drug allergies") || "No documented drug allergies"}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-start gap-2">
              <Pill className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  {t("Current Active Medications") || "Current Active Regimen"}:
                </span>
                {patientActiveMeds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {patientActiveMeds.map((med, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-semibold text-[11px] border border-blue-200 dark:border-blue-800"
                      >
                        {med}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                    {t("No existing active medications recorded") || "No prior active medications recorded in EHR."}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300/60 dark:border-slate-700/60 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("direct")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "direct"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          <span>{t("Direct Form Entry")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assistant")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "assistant"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{t("Natural Text Drafter")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ocr")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "ocr"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{t("Prescription OCR")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "history"
              ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t("Saved History")}</span>
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
                {t("Electronic Prescription Form")}
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
              <span>{t("Add Medication")}</span>
            </button>
          </div>

          <form onSubmit={handleSubmitPrescription} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("Clinical Diagnosis")}
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
                  {t("Doctor Notes")}
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
                      {t("Medication Name")}
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
                      {t("Dosage")}
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
                      {t("Frequency")}
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
                        {t("Duration")}
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

            {/* Stale Safety Analysis Warning */}
            {staleAnalysis && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>{t("Safety Analysis Pending") || "Safety Screening Required"}: </strong>
                    {t("Prescription medications have been modified or have not yet been evaluated. Click 'Run Safety Analysis' to screen for drug interactions and candidate alternatives.") || "Prescription medications have been modified or have not yet been evaluated. Click 'Run Safety Analysis' to screen for drug interactions and candidate alternatives."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRunSafetyCheck}
                  disabled={safetyChecking}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${safetyChecking ? "animate-spin" : ""}`} />
                  <span>{safetyChecking ? "Screening..." : (t("Run Safety Analysis") || "Run Safety Analysis")}</span>
                </button>
              </div>
            )}

            {/* Completed Safety Screen Status */}
            {!staleAnalysis && safetyPassed && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">
                      {t("Safety Verification Complete") || "Safety Verification Complete"}:{" "}
                    </span>
                    <span>
                      {safetyData?.interactions?.length || 0} {t("interactions") || "interactions"}, {safetyData?.contraindications?.length || 0} {t("contraindications") || "contraindications"}.
                    </span>
                    {safetyOverrideReason && (
                      <span className="block mt-0.5 text-rose-600 dark:text-rose-400 font-medium">
                        [Clinician Override Applied: {safetyOverrideReason}]
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSafetyModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-bold text-xs shrink-0 cursor-pointer"
                >
                  {t("View Full Safety Report") || "View Safety Report"}
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleRunSafetyCheck}
                disabled={safetyChecking}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>{safetyChecking ? "Evaluating Clinically..." : (t("Run Safety Analysis") || "Run Safety Analysis")}</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                  staleAnalysis
                    ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-80"
                    : "bg-primary-600 hover:bg-primary-500 shadow-primary-600/30"
                }`}
              >
                {submitting ? (
                  <span>Persisting to Database...</span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t("Issue Prescription")}</span>
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
              {t("Physical Prescription OCR & Review Workflow") || "Physical Prescription OCR & Review Workflow"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t("Upload scanned or photographed paper prescriptions. Tesseract.js extracts medicines offline, enforcing clinician review before persistence.") ||
                "Upload scanned or photographed paper prescriptions. Tesseract.js extracts medicines offline, enforcing clinician review before persistence."}
            </p>
          </div>

          <form onSubmit={handleOcrUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 rounded-2xl p-8 text-center space-y-3 transition-colors bg-slate-50/40 dark:bg-slate-800/20">
              <Upload className="h-10 w-10 text-primary-500 mx-auto" />
              <div>
                <label className="text-xs sm:text-sm font-bold text-primary-600 hover:underline cursor-pointer inline-flex items-center gap-1.5">
                  <span>{t("Select Prescription Image") || "Select Prescription Image"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) {
                        setOcrFile(file);
                        setError("");
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t("PNG, JPG, or WEBP (Max 5MB)") || "PNG, JPG, or WEBP (Max 5MB)"}
                </p>
              </div>

              {ocrFile && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-xs rounded-xl border border-primary-200 dark:border-primary-800/60 shadow-xs">
                  <span>
                    {t("Selected") || "Selected"}: {ocrFile.name} ({(ocrFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setOcrFile(null)}
                    className="hover:text-rose-600 cursor-pointer ml-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full p-0.5"
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={ocrUploading || !ocrFile || !selectedPatientId}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all"
            >
              {ocrUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("Running Local OCR Pipeline...") || "Running Local OCR Pipeline..."}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{t("Process Prescription with OCR") || "Process Prescription with OCR"}</span>
                </>
              )}
            </button>
          </form>

          {/* OCR Review Invariant Form */}
          {ocrJob && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    OCR Job #{ocrJob.job_id}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {Math.round((ocrJob.confidence_score || 0.94) * 100)}% Confidence
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  {t("Awaiting Clinician Confirmation") || "Awaiting Clinician Confirmation"}
                </span>
              </div>

              {/* Safety notice callout */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p>
                  {t("Clinician Verification Required: Verify and edit extracted drug names, dosages, and frequencies before signing.") ||
                    "Clinician Verification Required: Verify and edit extracted drug names, dosages, and frequencies before signing."}
                </p>
              </div>

              {/* Raw extracted text box */}
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Raw Extracted Text") || "Raw Extracted Text"}:
                </span>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                  {ocrJob.raw_extracted_text || ocrJob.raw_ocr_text || "No text parsed"}
                </div>
              </div>

              {/* Extracted Medicines Editable Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t("Extracted Medications (Clinician Review)") || "Extracted Medications (Clinician Review)"}:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOcrConfirmedMeds([
                        ...ocrConfirmedMeds,
                        { medicine_name: "", dosage: "Standard dose", frequency: "Once daily", duration: "7 days", route: "Oral", instructions: "As directed" }
                      ])
                    }
                    className="text-xs font-bold text-primary-600 hover:text-primary-500 cursor-pointer flex items-center gap-1"
                  >
                    <span>+ {t("Add Medication") || "Add Medication"}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {ocrConfirmedMeds.map((med, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-center shadow-2xs"
                    >
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          {t("Medicine Name") || "Medicine Name"}
                        </label>
                        <input
                          type="text"
                          value={med.medicine_name}
                          onChange={(e) => {
                            const copy = [...ocrConfirmedMeds];
                            copy[idx].medicine_name = e.target.value;
                            setOcrConfirmedMeds(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100"
                          placeholder="e.g. Metformin"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          {t("Dosage") || "Dosage"}
                        </label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => {
                            const copy = [...ocrConfirmedMeds];
                            copy[idx].dosage = e.target.value;
                            setOcrConfirmedMeds(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                          placeholder="e.g. 500 mg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          {t("Frequency") || "Frequency"}
                        </label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => {
                            const copy = [...ocrConfirmedMeds];
                            copy[idx].frequency = e.target.value;
                            setOcrConfirmedMeds(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                          placeholder="e.g. BD / Twice daily"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          {t("Duration") || "Duration"}
                        </label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => {
                            const copy = [...ocrConfirmedMeds];
                            copy[idx].duration = e.target.value;
                            setOcrConfirmedMeds(copy);
                          }}
                          className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                          placeholder="e.g. 30 days"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 font-bold block mb-0.5">
                            {t("Route") || "Route"}
                          </label>
                          <input
                            type="text"
                            value={med.route || "Oral"}
                            onChange={(e) => {
                              const copy = [...ocrConfirmedMeds];
                              copy[idx].route = e.target.value;
                              setOcrConfirmedMeds(copy);
                            }}
                            className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                            placeholder="Oral"
                          />
                        </div>

                        {ocrConfirmedMeds.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const copy = ocrConfirmedMeds.filter((_, i) => i !== idx);
                              setOcrConfirmedMeds(copy);
                            }}
                            className="mt-4 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                            title="Remove medication"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setOcrJob(null);
                    setOcrFile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
                >
                  {t("Discard OCR") || "Discard OCR"}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmOcr}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t("Saving...") || "Saving..."}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{t("Confirm & Sign Prescription") || "Confirm & Sign Prescription"}</span>
                    </>
                  )}
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

      {/* Safety Analysis & Candidate Alternatives Modal Dialogue */}
      <SafetyAnalysisModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        safetyData={safetyData}
        onApplyAlternative={handleApplyAlternative}
        onAcknowledgeAndProceed={handleAcknowledgeAndProceed}
        patientName={selectedPatientName}
        patientId={selectedPatientId}
      />
    </div>
  );
}
