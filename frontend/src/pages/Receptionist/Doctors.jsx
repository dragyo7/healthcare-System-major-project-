import React, { useState, useEffect } from "react";
import { receptionistApi } from "../../api/receptionistApi";
import {
  Activity,
  Search,
  Mail,
  Phone,
  Award,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function ReceptionistDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDoctors() {
      try {
        const list = await receptionistApi.getDoctors();
        setDoctors(list);
      } catch (err) {
        setError(err.message || "Failed to load physician directory.");
      } finally {
        setLoading(false);
      }
    }
    loadDoctors();
  }, []);

  const filtered = doctors.filter((d) => {
    const term = searchTerm.toLowerCase();
    const name = (d.full_name || d.name || "").toLowerCase();
    const spec = (d.specialization || "").toLowerCase();
    return name.includes(term) || spec.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Physician Directory & OPD Schedules
          </h1>
          <p className="text-sm text-muted-foreground">
            Registered hospital clinicians, specialties, licensing, and consultation chambers.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by physician name or specialty..."
          className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground ml-2">Loading physician directory...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          No physicians found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((doc) => (
            <div
              key={doc.doctor_id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
                  {doc.name ? doc.name.charAt(0) : "D"}
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                  Available
                </span>
              </div>

              <div>
                <h3 className="font-bold text-foreground text-base">Dr. {doc.name || doc.full_name}</h3>
                <p className="text-xs font-semibold text-primary mt-0.5">{doc.specialization || "Clinical Specialist"}</p>
              </div>

              <div className="space-y-2 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{doc.email || "doctor@hospital.org"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{doc.phone || "+91 98765 43210"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>License: MCI-2018-849201</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>OPD Hours: 09:00 - 17:00</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
