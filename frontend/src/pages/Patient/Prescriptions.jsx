import React, { useState, useEffect } from "react";
import { patientApi } from "../../api/patientApi";
import {
  Pill,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  Download,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [activeTab, setActiveTab] = useState("prescriptions"); // 'prescriptions' | 'regimens'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [rxList, medList] = await Promise.all([
          patientApi.getPrescriptions(),
          patientApi.getMedications(),
        ]);
        setPrescriptions(rxList);
        setMedications(medList);
        if (rxList.length > 0) {
          setExpandedId(rxList[0].prescription_id);
        }
      } catch (err) {
        setError(err.message || "Failed to load prescription history.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your prescription records...</p>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Pill className="w-6 h-6 text-primary" />
            My Prescriptions & Regimens
          </h1>
          <p className="text-sm text-muted-foreground">
            View authorized clinical prescription records, dosage instructions, and active medications.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-lg border border-border bg-muted/40 p-1 w-fit">
          <button
            onClick={() => setActiveTab("prescriptions")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === "prescriptions"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Prescriptions ({prescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab("regimens")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === "regimens"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active Regimens ({medications.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Prescriptions List */}
      {activeTab === "prescriptions" && (
        <div className="space-y-4">
          {prescriptions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
              No electronic prescriptions found for your patient account.
            </div>
          ) : (
            prescriptions.map((rx) => {
              const isExpanded = expandedId === rx.prescription_id;
              const meds = rx.medicines || [];

              return (
                <div
                  key={rx.prescription_id}
                  className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition"
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(rx.prescription_id)}
                    className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition select-none"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                          Rx #{rx.prescription_id}
                        </span>
                        <h3 className="text-base font-bold text-foreground">
                          {rx.diagnosis || "Medical Consultation"}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-primary" />
                          Dr. {rx.doctor_name || "Treating Physician"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : "Recent"}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          {meds.length} Medicine{meds.length !== 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const blob = await patientApi.downloadPrescriptionPDF(rx.prescription_id);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `prescription-${rx.prescription_id}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (err) {
                            alert(err.message || "Failed to download prescription PDF");
                          }
                        }}
                        className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download official PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.print();
                        }}
                        className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Print prescription"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Medicine Details */}
                  {isExpanded && (
                    <div className="border-t border-border/80 bg-muted/20 p-5 space-y-4">
                      {rx.notes && (
                        <div className="p-3 rounded-lg bg-background border border-border text-xs text-foreground">
                          <strong>Physician's Clinical Notes:</strong> {rx.notes}
                        </div>
                      )}

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Prescribed Medication Table
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {meds.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="rounded-lg border border-border bg-card p-4 shadow-2xs space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                  <Pill className="w-4 h-4 text-primary" />
                                  {m.medicine_name || m.name}
                                </div>
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
                                  {m.dosage || "As directed"}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
                                <div>
                                  <span className="font-medium">Frequency:</span>{" "}
                                  <strong className="text-foreground">{m.frequency || "Daily"}</strong>
                                </div>
                                <div>
                                  <span className="font-medium">Duration:</span>{" "}
                                  <strong className="text-foreground">{m.duration || "7 days"}</strong>
                                </div>
                                <div>
                                  <span className="font-medium">Route:</span>{" "}
                                  <strong className="text-foreground">{m.route || "Oral"}</strong>
                                </div>
                              </div>

                              {m.instructions && (
                                <div className="pt-2 border-t border-border/60 text-muted-foreground">
                                  <strong>Directions:</strong> {m.instructions}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Active Regimens List */}
      {activeTab === "regimens" && (
        <div className="space-y-4">
          {medications.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
              No active medication regimens recorded.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {medications.map((med, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-primary" />
                      {med.medicine_name || med.name}
                    </p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                      Active
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Dosage: <strong className="text-foreground">{med.dosage || "Standard"}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Frequency: <strong className="text-foreground">{med.frequency || "Once daily"}</strong>
                  </p>
                  {med.instructions && (
                    <p className="p-2 rounded bg-muted/50 text-muted-foreground mt-2 border border-border/60">
                      {med.instructions}
                    </p>
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
