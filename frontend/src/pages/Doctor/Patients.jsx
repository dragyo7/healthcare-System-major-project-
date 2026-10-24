import React, { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Search, User, FileText, Pill, AlertTriangle, Sparkles, ArrowLeft, Calendar, Activity, ShieldCheck, Heart } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DoctorPatients() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPatients() {
      try {
        const list = await doctorApi.getPatients();
        setPatients(list);

        const params = new URLSearchParams(location.search);
        const urlId = params.get("id");
        if (urlId) {
          setSelectedPatientId(parseInt(urlId, 10));
        }
      } catch (err) {
        setError(err.message || "Failed to load patients");
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, [location]);

  useEffect(() => {
    async function loadDossier() {
      if (!selectedPatientId) {
        setDossier(null);
        return;
      }
      setDossierLoading(true);
      try {
        const details = await doctorApi.getPatientDetails(selectedPatientId);
        setDossier(details);
      } catch (err) {
        setError(`Failed to load patient dossier: ${err.message}`);
      } finally {
        setDossierLoading(false);
      }
    }
    loadDossier();
  }, [selectedPatientId]);

  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">{t("Loading Patient Directory...")}</p>
        </div>
      </div>
    );
  }

  // If a patient is selected, display their complete clinical dossier
  if (selectedPatientId && dossier) {
    const patient = dossier.patient || {};
    const symptoms = dossier.symptoms || [];
    const history = dossier.medical_history || [];
    const prescriptions = dossier.prescriptions || [];
    const reports = dossier.reports || [];
    const discharge = dossier.discharge || null;

    return (
      <div className="space-y-6">
        {/* Dossier Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedPatientId(null);
                navigate("/doctor/patients");
              }}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title={t("Back to Patient Directory")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {patient.full_name}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300">
                  ID: #{patient.patient_id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient.gender} • DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : "—"} • Blood Group: <strong className="text-slate-800 dark:text-slate-200">{patient.blood_group || "—"}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/doctor/cds?patient_id=${patient.patient_id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-primary-500/20 hover:from-primary-500 hover:to-indigo-500 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t("Launch CDS Assistant")}</span>
            </Link>
            <Link
              to={`/doctor/prescriptions?patient_id=${patient.patient_id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              <Pill className="h-4 w-4" />
              <span>{t("New Prescription")}</span>
            </Link>
            <Link
              to={`/doctor/discharge?patient_id=${patient.patient_id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              <span>{t("Discharge Summary")}</span>
            </Link>
          </div>
        </div>

        {/* Clinical Dossier Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Demographics & Symptoms */}
          <div className="space-y-6">
            {/* Demographics Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User className="h-4 w-4 text-primary-600" />
                <span>{t("Patient Demographics")}</span>
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t("Phone")}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t("Email")}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.email || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t("Address")}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.address || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">{t("Emergency Contact")}:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.emergency_contact || "—"}</span>
                </div>
              </div>
            </div>

            {/* Recorded Symptoms */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                <span>{t("Recorded Symptoms")}</span>
              </h2>
              {symptoms.length === 0 ? (
                <p className="text-xs text-slate-400">{t("No active symptoms on file.")}</p>
              ) : (
                <div className="space-y-2">
                  {symptoms.map((s, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                      <div className="font-bold text-amber-900 dark:text-amber-300">{s.symptom_name}</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">
                        {t("Severity")}: {s.severity || "Moderate"} • {t("Started")}: {s.onset_date ? new Date(s.onset_date).toLocaleDateString() : "Recent"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medical History */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <span>{t("Allergies & Contraindications")}</span>
              </h2>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">{t("No known contraindications recorded.")}</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-xs">
                      <div className="font-bold text-rose-900 dark:text-rose-300">{h.condition_name || h.diagnosis}</div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">
                        {h.notes || h.allergies || "Documented clinical condition"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Two Columns: Prescriptions & Care History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prescriptions Dossier */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary-600" />
                  <span>{t("Verified Prescriptions & Active Regimens")}</span>
                </h2>
                <Link
                  to={`/doctor/prescriptions?patient_id=${patient.patient_id}`}
                  className="text-xs font-bold text-primary-600 hover:underline"
                >
                  {t("+ Add Prescription")}
                </Link>
              </div>

              {prescriptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {t("No previous prescriptions recorded for this patient.")}
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((rx) => (
                    <div key={rx.prescription_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{t("Prescription")} #{rx.prescription_id}</span>
                          <span className="text-slate-400 ml-2">({new Date(rx.created_at).toLocaleDateString()})</span>
                        </div>
                        <a
                          href={`http://localhost:5000/api/doctor/prescriptions/${rx.prescription_id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-primary-600 hover:underline"
                        >
                          📄 {t("Download PDF")}
                        </a>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <strong>{t("Diagnosis")}:</strong> {rx.diagnosis || "Clinical assessment"}
                      </div>

                      {rx.medicines && rx.medicines.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                                <th className="pb-1.5 font-bold">{t("Medicine")}</th>
                                <th className="pb-1.5 font-bold">{t("Dosage")}</th>
                                <th className="pb-1.5 font-bold">{t("Frequency")}</th>
                                <th className="pb-1.5 font-bold">{t("Duration")}</th>
                                <th className="pb-1.5 font-bold">{t("Instructions")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {rx.medicines.map((m, mIdx) => (
                                <tr key={mIdx}>
                                  <td className="py-2 font-bold text-slate-900 dark:text-white">{m.medicine_name}</td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300">{m.dosage}</td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300">{m.frequency}</td>
                                  <td className="py-2 text-slate-600 dark:text-slate-300">{m.duration}</td>
                                  <td className="py-2 text-slate-500">{m.instructions || "—"}</td>
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

            {/* Post-Discharge Care Summary */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span>{t("Post-Discharge Care Guidelines")}</span>
                </h2>
                <Link
                  to={`/doctor/discharge?patient_id=${patient.patient_id}`}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  {discharge ? t("Edit Discharge Summary") : t("+ Create Discharge")}
                </Link>
              </div>

              {!discharge ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {t("No post-discharge care record has been generated for this patient yet.")}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 text-xs">
                  <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-300">
                    <span>{t("Discharged")}: {new Date(discharge.discharge_date).toLocaleDateString()}</span>
                    <span>{t("Condition")}: {discharge.condition_at_discharge || "Stable"}</span>
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">{t("Discharge Instructions")}:</strong>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{discharge.discharge_instructions}</p>
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200">{t("Dietary & Lifestyle Guidelines")}:</strong>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{discharge.dietary_guidelines || "Standard post-operative diet"}</p>
                  </div>
                  <div>
                    <strong className="text-rose-700 dark:text-rose-400">{t("Red-Flag Warning Signs")}:</strong>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{discharge.warning_signs || "Seek immediate medical attention if experiencing high fever or chest pain."}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Patient Directory List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t("Patient Directory & Clinical Dossiers")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t("Search authorized patient records to inspect symptoms, diagnoses, prescriptions, and launch CDS.")}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search by name, email, or phone...")}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-primary-500 shadow-xs"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Patients Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-6">{t("Patient")}</th>
                <th className="py-3.5 px-6">{t("Demographics")}</th>
                <th className="py-3.5 px-6">{t("Blood Group")}</th>
                <th className="py-3.5 px-6">{t("Contact")}</th>
                <th className="py-3.5 px-6">{t("Email")}</th>
                <th className="py-3.5 px-6 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                    {t("No results found")}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((pat) => (
                  <tr
                    key={pat.patient_id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {pat.full_name?.charAt(0) || "P"}
                        </div>
                        <div>
                          <div>{pat.full_name}</div>
                          <span className="text-[10px] text-slate-400 font-normal">ID: #{pat.patient_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                      {pat.gender || "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-block px-2 py-0.5 rounded-md font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {pat.blood_group || "—"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                      {pat.phone || "—"}
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {pat.email || "—"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setSelectedPatientId(pat.patient_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors cursor-pointer"
                        >
                          {t("View Dossier")}
                        </button>
                        <Link
                          to={`/doctor/cds?patient_id=${pat.patient_id}`}
                          className="p-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                          title={t("Launch CDS Assistant")}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
