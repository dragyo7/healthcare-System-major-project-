import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Pill
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * SafetyAnalysisModal
 * Accessible clinical decision support dialogue displaying:
 * - Patient context & evaluated medicines (proposed vs existing)
 * - Pairwise drug-drug interactions with DailyMed rule IDs and SPL links
 * - Allergy contraindications across active ingredients
 * - Duplicate active ingredient alerts (multi-brand redundancy)
 * - Unindexed / unsupported medication notice ("no matching local rule")
 * - Deterministic evidence-backed candidate alternatives with 1-click replacement
 * - Clinical governance disclaimer & mandatory clinician override reason for major findings
 */
export default function SafetyAnalysisModal({
  isOpen,
  onClose,
  safetyData,
  onApplyAlternative,
  onAcknowledgeAndProceed,
  patientName = "Patient",
  patientId = null
}) {
  const { t, language } = useLanguage();
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !safetyData) return null;

  const {
    screen_status = "safe",
    rule_coverage = "FULL",
    interactions = [],
    contraindications = [],
    duplicate_ingredients = [],
    candidate_alternatives = [],
    evaluated_drugs = [],
    unindexed_drugs = [],
    candidate_medications = [],
    existing_active_medications = [],
    clinical_disclaimer = ""
  } = safetyData;

  const isCritical = screen_status === "critical" || contraindications.length > 0;
  const isWarning = screen_status === "warning" || interactions.length > 0 || duplicate_ingredients.length > 0;
  const isNoMatchingRule = screen_status === "no_matching_local_rule" || rule_coverage === "NO_MATCHING_LOCAL_RULE";
  const isSafe = screen_status === "safe" && !isCritical && !isWarning && !isNoMatchingRule;

  const requiresOverride = isCritical || interactions.some(i => ["major", "critical", "high"].includes(String(i.severity).toLowerCase()));

  const handleProceed = () => {
    if (requiresOverride && (!overrideReason || overrideReason.trim().length < 5)) {
      setOverrideError(
        language === "hi"
          ? "कृपया आगे बढ़ने के लिए क्लिनिकल ओवरराइड का कारण और निगरानी योजना दर्ज करें (न्यूनतम 5 अक्षर)।"
          : language === "mr"
          ? "कृपया पुढे जाण्यासाठी क्लिनिकल ओव्हरराइडचे कारण आणि देखरेख योजना नोंदवा (किमान 5 अक्षरे)."
          : language === "gu"
          ? "કૃપા કરીને આગળ વધવા માટે ક્લિનિકલ ઓવરરાઇડનું કારણ અને મોનિટરિંગ પ્લાન દાખલ કરો (ઓછામાં ઓછા 5 અક્ષરો)."
          : "Please provide a clinical override justification and monitoring plan before proceeding (minimum 5 characters)."
      );
      return;
    }
    setOverrideError("");
    onAcknowledgeAndProceed({
      overrideApplied: requiresOverride,
      overrideReason: overrideReason.trim()
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-analysis-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-colors">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            {isCritical ? (
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
            ) : isWarning ? (
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
            ) : isNoMatchingRule ? (
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                <Info className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2
                id="safety-analysis-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                {t("Clinical Safety Analysis & Screening Report") || "Clinical Safety Analysis & Screening Report"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span>{patientName} {patientId ? `(#${patientId})` : ""}</span>
                <span>•</span>
                <span className="font-medium">
                  {candidate_medications.length} {t("Proposed") || "proposed"}, {existing_active_medications.length} {t("Active") || "active"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Pill */}
            {isCritical && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                {t("Critical Risk") || "Critical Risk"}
              </span>
            )}
            {isWarning && !isCritical && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                {t("Interaction Warning") || "Interaction Warning"}
              </span>
            )}
            {isNoMatchingRule && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                {t("No Matching Local Rule") || "No Matching Local Rule"}
              </span>
            )}
            {isSafe && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                {t("Evaluated Safe") || "Evaluated Safe"}
              </span>
            )}

            <button
              onClick={onClose}
              aria-label={t("Close") || "Close"}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Context Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {t("Proposed Medications") || "Proposed Medications (Under Evaluation)"}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {candidate_medications.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium border border-blue-200 dark:border-blue-800"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                {t("Current Active Medications") || "Patient's Current Active Regimen"}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existing_active_medications.length > 0 ? (
                  existing_active_medications.map((m, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    {t("No existing active medications recorded") || "No prior active medications recorded in EHR."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Allergy Contraindications Section */}
          {contraindications.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800">
              <div className="flex items-center gap-2 mb-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <span>{t("Allergy Contraindication Alert") || "Allergy Contraindication Alert"}</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-xs text-rose-900 dark:text-rose-200">
                {contraindications.map((c, idx) => (
                  <li key={idx} className="font-medium leading-relaxed">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Active Ingredients Section */}
          {duplicate_ingredients.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-200 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>{t("Duplicate Active Ingredient Detected") || "Duplicate Active Ingredient Warning"}</span>
              </div>
              <div className="space-y-2 text-xs">
                {duplicate_ingredients.map((dup, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-amber-200 dark:border-amber-800/60">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">{dup.finding}</p>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{t("Clinical Action") || "Clinical Action"}: </span>
                      {dup.clinical_action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detected Drug-Drug Interactions Section */}
          {interactions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>{t("Detected Drug-Drug Interactions") || "Detected Drug-Drug Interactions"} ({interactions.length})</span>
              </h3>

              <div className="space-y-3">
                {interactions.map((inter, idx) => {
                  const severity = String(inter.severity).toLowerCase();
                  const isMajor = severity === "major" || severity === "critical" || severity === "high";

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-colors ${
                        isMajor
                          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              isMajor
                                ? "bg-rose-600 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {inter.severity}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {inter.drug_pair.join(" ⇄ ")}
                          </span>
                        </div>

                        {inter.rule_id && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {inter.rule_id}
                            </span>
                            {inter.source_url && (
                              <a
                                href={inter.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                title="Open DailyMed monograph source"
                              >
                                <span>{inter.source_id || "DailyMed"}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed mb-2">
                        {inter.explanation}
                      </p>

                      {inter.clinical_action && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {t("Clinical Action / Guidance") || "Clinical Action / Guidance"}:{" "}
                          </span>
                          {inter.clinical_action}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence-Backed Candidate Alternatives Section */}
          {candidate_alternatives.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>{t("Evidence-Backed Candidate Alternatives") || "Evidence-Backed Candidate Alternatives (DailyMed SPL Guidance)"}</span>
                </div>
                <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                  {t("Clinician Discretion Required") || "Clinician Discretion Required"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {candidate_alternatives.map((alt, idx) => {
                  const isExistingBaseline = alt.target_is_existing_med || alt.is_editable_proposed === false;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                    >
                      <div className="space-y-1.5 text-xs flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500 line-through font-medium">{alt.original_drug}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                            <Pill className="w-3.5 h-3.5" />
                            {alt.candidate_drug}
                          </span>
                          {alt.brand_examples && alt.brand_examples.length > 0 && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ({alt.brand_examples.slice(0, 3).join(", ")})
                            </span>
                          )}
                          {isExistingBaseline && (
                            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              {t("Existing EHR Medication") || "Existing EHR Baseline Medication"}
                            </span>
                          )}
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 font-medium">
                          <span className="text-slate-500">{t("Therapeutic Goal") || "Goal"}: </span>
                          {alt.therapeutic_intent}
                        </p>

                        {alt.unsupported_intent_caveat && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            <span className="font-semibold">{t("Intent Limitation") || "Limitation"}: </span>
                            {alt.unsupported_intent_caveat}
                          </p>
                        )}

                        {alt.eligibility_precautions && alt.eligibility_precautions.length > 0 && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{t("Eligibility Precautions") || "Precautions"}: </span>
                            {alt.eligibility_precautions.join("; ")}
                          </p>
                        )}

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                          {alt.clinical_rationale}
                        </p>

                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[10.5px] text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300">{t("Evidence Qualification") || "Qualification"}: </span>
                          <span>{alt.safety_qualification || "Candidate for clinician review — not universally safe. Clinician must assess organ function, indication, and enter new dosing regimen."}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                          <span>{t("Source") || "Source"}: {alt.evidence_source}</span>
                          {alt.source_url && (
                            <a
                              href={alt.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>DailyMed</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 pt-1">
                        {isExistingBaseline ? (
                          <div className="max-w-[200px] text-right">
                            <span className="inline-block text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {t("Cannot replace existing EHR baseline medication from prescription form") || "Cannot substitute baseline EHR med from Rx form"}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onApplyAlternative(alt.original_drug, alt.candidate_drug)}
                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{t("Apply Candidate (Clears Regimen)") || "Apply Candidate"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unindexed / Unsupported Drug Alert */}
          {unindexed_drugs.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t("Unindexed Medication Notice") || "Unindexed Medicine Notice"}:{" "}
                </span>
                <span>
                  {unindexed_drugs.join(", ")} {t("is not present in the local verified DailyMed rulebase. The system returned 'no matching local rule' and does NOT guarantee absence of clinical drug interactions. Independent clinical evaluation is required.") || "is not present in the local verified DailyMed rulebase. The system returned 'no matching local rule' and does NOT guarantee absence of clinical drug interactions. Independent clinical evaluation is required."}
                </span>
              </div>
            </div>
          )}

          {/* Evaluated Safe Message */}
          {isSafe && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">{t("No High-Risk Interactions or Contraindications Found") || "Evaluated Safe: No High-Risk Interactions or Contraindications Found"}</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {t("All proposed medications were screened against patient allergies and active medication records.") || "All proposed medications were screened against patient allergies and active medication records in the local verified DailyMed rulebase."}
                </p>
              </div>
            </div>
          )}

          {/* Clinical Governance Disclaimer Banner */}
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-300">{t("Clinical Governance Disclaimer") || "Clinical Governance Notice"}: </span>
            {clinical_disclaimer || "This automated screening provides deterministic decision-support based on verified DailyMed SPL monographs. It does not replace independent clinical judgment or specialist consultation."}
          </div>

          {/* Clinician Override Justification Box (When High-Risk Findings Exist) */}
          {requiresOverride && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-rose-300 dark:border-rose-900/60 space-y-2">
              <label htmlFor="clinician-override-reason" className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                {t("Clinician Override Justification & Monitoring Plan") || "Clinician Override Justification & Monitoring Plan (Mandatory for Major / Critical Findings)"}
                <span className="text-rose-500 ml-1">*</span>
              </label>
              <textarea
                id="clinician-override-reason"
                rows={2}
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  if (overrideError) setOverrideError("");
                }}
                placeholder={
                  language === "hi"
                    ? "उदा. रोगी की सघन निगरानी की जाएगी; INR दैनिक जांचा जाएगा..."
                    : language === "mr"
                    ? "उदा. रुग्णावर बारीक लक्ष ठेवले जाईल; रोज रक्त तपासणी केली जाईल..."
                    : language === "gu"
                    ? "દા.ત. દર્દીનું નજીકથી નિરીક્ષણ કરવામાં આવશે; દૈનિક મોનિટરિંગ કરવામાં આવશે..."
                    : "e.g. Co-administration strictly indicated by cardiology; serial INR and hemoglobin will be monitored daily..."
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {overrideError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {overrideError}
                </p>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition-colors"
          >
            {t("Revise Prescription / Close") || "Revise Prescription / Close"}
          </button>

          <button
            type="button"
            onClick={handleProceed}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-md transition-all ${
              requiresOverride
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}

          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {requiresOverride
                ? t("Acknowledge Alerts & Proceed") || "Acknowledge Alerts & Proceed with Override"
                : t("Acknowledge & Confirm") || "Acknowledge Safety Results & Proceed"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
