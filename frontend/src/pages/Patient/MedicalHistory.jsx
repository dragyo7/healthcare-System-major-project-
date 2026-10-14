import React, { useState, useEffect } from "react";
import { patientApi } from "../../api/patientApi";
import {
  Activity,
  HeartPulse,
  FileCheck,
  AlertTriangle,
  Loader2,
  Calendar,
  CheckCircle2,
} from "lucide-react";

export default function PatientMedicalHistory() {
  const [history, setHistory] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await patientApi.getMedicalHistory();
        setHistory(data.medical_history || []);
        setSymptoms(data.symptoms || []);
        setReports(data.reports || []);
      } catch (err) {
        setError(err.message || "Failed to load medical history.");
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading medical records and history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Medical History & Clinical Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Authoritative health conditions, reported symptoms, and diagnostic laboratory records.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chronic Conditions */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-primary" />
              Diagnosed Conditions
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {history.length}
            </span>
          </div>

          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((h, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1 text-xs">
                  <p className="font-bold text-foreground text-sm">{h.condition_name}</p>
                  <p className="text-muted-foreground">Diagnosis: {h.diagnosis}</p>
                  {h.diagnosed_date && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      Diagnosed: {new Date(h.diagnosed_date).toLocaleDateString()}
                    </p>
                  )}
                  {h.notes && (
                    <p className="p-2 rounded bg-background border border-border/60 text-muted-foreground mt-1">
                      {h.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No chronic conditions recorded.
            </p>
          )}
        </div>

        {/* Symptoms */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Reported Symptoms
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {symptoms.length}
            </span>
          </div>

          {symptoms.length > 0 ? (
            <div className="space-y-3">
              {symptoms.map((s, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{s.symptom_name}</p>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600">
                      Severity: {s.severity || "Reported"}
                    </span>
                  </div>
                  {s.recorded_date && (
                    <p className="text-[11px] text-muted-foreground">
                      Reported on: {new Date(s.recorded_date).toLocaleDateString()}
                    </p>
                  )}
                  {s.notes && <p className="text-muted-foreground">{s.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No recent symptoms reported.
            </p>
          )}
        </div>

        {/* Lab Reports */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              Diagnostic Lab Reports
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {reports.length}
            </span>
          </div>

          {reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((r, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1 text-xs">
                  <p className="font-bold text-foreground">{r.report_type || "Lab Investigation"}</p>
                  <p className="text-muted-foreground">{r.description || "Routine diagnostic evaluation"}</p>
                  {r.report_date && (
                    <p className="text-[11px] text-muted-foreground">
                      Date: {new Date(r.report_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No diagnostic reports on record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
