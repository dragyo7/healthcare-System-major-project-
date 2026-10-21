import React, { useState, useEffect, useRef, useId } from "react";
import { Search, X, User, AlertCircle, Check, Loader2, ChevronDown } from "lucide-react";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PatientSearchSelector({
  selectedPatientId,
  onSelectPatient,
  disabled = false,
  className = ""
}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();

  // Load initial patient list and sync with selectedPatientId
  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      setLoading(true);
      setError("");
      try {
        const list = await doctorApi.getPatients();
        if (isMounted) {
          setAllPatients(list);
          setPatients(list);
          if (selectedPatientId) {
            const found = list.find((p) => p.patient_id === Number(selectedPatientId));
            if (found) {
              setSelectedPatient(found);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load patient roster");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync selectedPatient when selectedPatientId changes externally
  useEffect(() => {
    if (selectedPatientId) {
      const match = allPatients.find((p) => p.patient_id === Number(selectedPatientId));
      if (match) {
        setSelectedPatient(match);
      }
    } else {
      setSelectedPatient(null);
    }
  }, [selectedPatientId, allPatients]);

  // Debounced search (server-side query with local fallback)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setPatients(allPatients);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const results = await doctorApi.getPatients(searchTerm.trim());
        setPatients(results);
        setHighlightedIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        // Fallback to local filter if network error
        const term = searchTerm.toLowerCase().trim();
        const local = allPatients.filter((p) => {
          const name = (p.full_name || "").toLowerCase();
          const id = String(p.patient_id || "");
          const phone = (p.phone || "").toLowerCase();
          return name.includes(term) || id.includes(term) || phone.includes(term);
        });
        setPatients(local);
        setHighlightedIndex(local.length > 0 ? 0 : -1);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, allPatients]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < patients.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : patients.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < patients.length) {
          handleSelect(patients[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleSelect = (patient) => {
    setSelectedPatient(patient);
    setIsOpen(false);
    setSearchTerm("");
    if (onSelectPatient) {
      onSelectPatient(patient);
    }
  };

  const handleClearSelection = () => {
    setSelectedPatient(null);
    setSearchTerm("");
    setIsOpen(true);
    if (onSelectPatient) {
      onSelectPatient(null);
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div ref={containerRef} className={`relative space-y-2 ${className}`}>
      {/* Search Input Box */}
      <div className="relative">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-card text-foreground transition-all shadow-xs ${
            isOpen ? "ring-2 ring-primary border-primary" : "border-border hover:border-border/80"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls={listboxId}
            disabled={disabled}
            value={searchTerm}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedPatient
                ? `Selected: ${selectedPatient.full_name} (#${selectedPatient.patient_id}) — type to search other...`
                : t("Search patient by name or ID")
            }
            className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
          />

          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}

          {searchTerm && !loading && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              title="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            title="Toggle patient list"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Dropdown Results Menu */}
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl p-1 animate-in fade-in-50 zoom-in-95"
          >
            {error ? (
              <div className="p-3 text-xs text-destructive flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setSearchTerm((s) => s + " ")}
                  className="underline hover:text-destructive/80 font-semibold cursor-pointer"
                >
                  {t("Retry")}
                </button>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <p>{t("No results found")} matching "{searchTerm}".</p>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="mt-2 text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Show all authorized patients
                  </button>
                )}
              </div>
            ) : (
              patients.map((p, idx) => {
                const isSelected = selectedPatient?.patient_id === p.patient_id;
                const isHighlighted = highlightedIndex === idx;
                const hasAllergy = Boolean(p.allergies && p.allergies.toLowerCase() !== "none" && p.allergies.toLowerCase() !== "nil");

                return (
                  <div
                    key={p.patient_id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isHighlighted ? "bg-primary/10 text-primary-900 dark:text-primary-100" : "hover:bg-muted"
                    } ${isSelected ? "font-bold bg-primary/15" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {p.full_name ? p.full_name.charAt(0) : "P"}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground truncate">{p.full_name}</span>
                          <span className="text-[10px] text-muted-foreground">#{p.patient_id}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span>{p.gender || "Patient"}</span>
                          {p.blood_group && <span>• {p.blood_group}</span>}
                          {p.phone && <span>• {p.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {hasAllergy && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30">
                          {t("Documented Allergy")}: {p.allergies}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected Patient Dossier Badge Card */}
      {selectedPatient ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5 text-foreground text-xs shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{selectedPatient.full_name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">Patient ID: #{selectedPatient.patient_id}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({selectedPatient.gender || "Unspecified"}, {selectedPatient.blood_group || "Blood group —"})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px]">
                {selectedPatient.allergies &&
                selectedPatient.allergies.toLowerCase() !== "none" &&
                selectedPatient.allergies.toLowerCase() !== "nil" ? (
                  <span className="px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-500" />
                    {t("Documented Allergy")}: {selectedPatient.allergies}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ {t("No documented drug allergies")}
                  </span>
                )}
                {selectedPatient.phone && (
                  <span className="text-muted-foreground">• Contact: {selectedPatient.phone}</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearSelection}
            disabled={disabled}
            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer shrink-0"
          >
            {t("Clear")}
          </button>
        </div>
      ) : (
        <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>No patient selected. Please search and select a patient before submitting or screening a prescription.</span>
        </div>
      )}
    </div>
  );
}
