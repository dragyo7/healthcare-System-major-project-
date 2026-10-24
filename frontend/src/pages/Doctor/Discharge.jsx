import React, { useState, useEffect } from "react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  FileText,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export default function DoctorDischarge() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDischarge, setLoadingDischarge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    admission_date: new Date().toISOString().split("T")[0],
    discharge_date: new Date().toISOString().split("T")[0],
    diagnosis: "",
    discharge_summary: "",
    discharge_instructions: "",
    follow_up_instructions: "",
    follow_up_date: "",
    warning_signs: "",
  });

  useEffect(() => {
    async function loadPatients() {
      try {
        const list = await doctorApi.getPatients();
        setPatients(list);
        if (list.length > 0) {
          setSelectedPatientId(list[0].patient_id);
        }
      } catch (err) {
        setErrorMsg("Failed to load patient roster: " + err.message);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    async function loadPatientDischarge() {
      setLoadingDischarge(true);
      setErrorMsg("");
      setSuccessMsg("");
      try {
        const res = await doctorApi.getPatientDischarge(selectedPatientId);
        if (res && res.discharge) {
          const d = res.discharge;
          setFormData({
            admission_date: d.admission_date ? d.admission_date.split("T")[0] : "",
            discharge_date: d.discharge_date ? d.discharge_date.split("T")[0] : "",
            diagnosis: d.diagnosis || "",
            discharge_summary: d.discharge_summary || "",
            discharge_instructions: d.discharge_instructions || "",
            follow_up_instructions: d.follow_up_instructions || "",
            follow_up_date: d.follow_up_date ? d.follow_up_date.split("T")[0] : "",
            warning_signs: d.warning_signs || "",
          });
        } else {
          setFormData({
            admission_date: new Date().toISOString().split("T")[0],
            discharge_date: new Date().toISOString().split("T")[0],
            diagnosis: "",
            discharge_summary: "",
            discharge_instructions: "",
            follow_up_instructions: "",
            follow_up_date: "",
            warning_signs: "",
          });
        }
      } catch (err) {
        // Not fatal, might be no discharge record yet
        setFormData({
          admission_date: new Date().toISOString().split("T")[0],
          discharge_date: new Date().toISOString().split("T")[0],
          diagnosis: "",
          discharge_summary: "",
          discharge_instructions: "",
          follow_up_instructions: "",
          follow_up_date: "",
          warning_signs: "",
        });
      } finally {
        setLoadingDischarge(false);
      }
    }
    loadPatientDischarge();
  }, [selectedPatientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMsg("Please select an authorized patient.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await doctorApi.createDischarge({
        patient_id: parseInt(selectedPatientId),
        ...formData,
      });
      setSuccessMsg("Post-discharge summary and care instructions saved to EHR successfully.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to record post-discharge care.");
    } finally {
      setSaving(false);
    }
  };

  const selectedPatient = patients.find((p) => String(p.patient_id) === String(selectedPatientId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {t("Post-Discharge Care Summary Authoring") || "Post-Discharge Care Summary Authoring"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Formulate clinical discharge directives, recovery guidance, warning signs, and follow-up schedules.") || "Formulate clinical discharge directives, recovery guidance, warning signs, and follow-up schedules."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground">{t("Select Patient:") || "Select Patient:"}</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={loadingPatients || saving}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20"
          >
            {patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.full_name || p.name || "Patient"} (ID: #{p.patient_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {selectedPatient && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
              {(selectedPatient.full_name || selectedPatient.name || "P").charAt(0)}
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{selectedPatient.full_name || selectedPatient.name || "Patient"}</p>
              <p className="text-muted-foreground">
                {t("Age:") || "Age:"} {selectedPatient.age || "N/A"} | {t("Gender:") || "Gender:"} {selectedPatient.gender || "N/A"} | {t("Blood Group:") || "Blood Group:"} {selectedPatient.blood_group || "N/A"}
              </p>
            </div>
          </div>
          <div className="text-muted-foreground">
            EHR ID: <strong className="text-foreground">#{selectedPatient.patient_id}</strong>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Episode Dates & Diagnosis */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {t("Admission & Episode Details") || "Admission & Episode Details"}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{t("Admission Date") || "Admission Date"}</label>
              <input
                type="date"
                required
                value={formData.admission_date}
                onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{t("Discharge Date") || "Discharge Date"}</label>
              <input
                type="date"
                required
                value={formData.discharge_date}
                onChange={(e) => setFormData({ ...formData, discharge_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{t("Discharge Primary Diagnosis") || "Discharge Primary Diagnosis"}</label>
              <input
                type="text"
                required
                placeholder={t("e.g., Essential Hypertension, Acute Bronchitis") || "e.g., Essential Hypertension, Acute Bronchitis"}
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{t("Recommended Follow-up Date") || "Recommended Follow-up Date"}</label>
              <input
                type="date"
                value={formData.follow_up_date}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>
          </div>

          {/* Clinical Instructions & Warning Signs */}
          <div className="md:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t("Care Directives & Warning Escalations") || "Care Directives & Warning Escalations"}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("Clinical Discharge Summary (Inpatient Course & Outcome)") || "Clinical Discharge Summary (Inpatient Course & Outcome)"}
              </label>
              <textarea
                rows={3}
                required
                placeholder="Patient presented with elevated BP. Stabilized on Amlodipine 5mg. Vitals stable on discharge."
                value={formData.discharge_summary}
                onChange={(e) => setFormData({ ...formData, discharge_summary: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("Patient Discharge Instructions (Diet, Activity & Recovery)") || "Patient Discharge Instructions (Diet, Activity & Recovery)"}
              </label>
              <textarea
                rows={3}
                required
                placeholder="Maintain low sodium diet (<2g/day). Avoid heavy lifting for 7 days. Monitor BP daily."
                value={formData.discharge_instructions}
                onChange={(e) => setFormData({ ...formData, discharge_instructions: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t("Follow-up Instructions & Tests") || "Follow-up Instructions & Tests"}
                </label>
                <textarea
                  rows={2}
                  placeholder="Repeat serum creatinine and lipid panel prior to OPD appointment."
                  value={formData.follow_up_instructions}
                  onChange={(e) => setFormData({ ...formData, follow_up_instructions: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {t("Red-Flag Warning Signs (Urgent ER Escalation)") || "Red-Flag Warning Signs (Urgent ER Escalation)"}
                </label>
                <textarea
                  rows={2}
                  placeholder="Severe chest tightness, sudden shortness of breath, systolic BP > 180 mmHg."
                  value={formData.warning_signs}
                  onChange={(e) => setFormData({ ...formData, warning_signs: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-amber-500/30 bg-amber-500/5 text-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || loadingDischarge}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("Persisting to EHR...") || "Persisting to EHR..."}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t("Commit Discharge Directives") || "Commit Discharge Directives"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
