import React, { useState, useEffect } from "react";
import { receptionistApi } from "../../api/receptionistApi";
import { useLanguage } from "../../contexts/LanguageContext";
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
  Plus,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  UserPlus
} from "lucide-react";

export default function ReceptionistDoctors() {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdDoctorInfo, setCreatedDoctorInfo] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    specialization: "General Medicine",
    qualification: "MBBS, MD",
    license_number: "",
    experience_years: "5",
    bio: "Consultation Chamber 101, Main OPD Wing"
  });

  const loadDoctors = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await receptionistApi.getDoctors();
      setDoctors(list);
    } catch (err) {
      setError(err.message || "Failed to load physician directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
    setFormError("");
  };

  const handleOpenModal = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      password: "",
      specialization: "General Medicine",
      qualification: "MBBS, MD",
      license_number: "",
      experience_years: "5",
      bio: "Consultation Chamber 101, Main OPD Wing"
    });
    setFormError("");
    setFieldErrors({});
    setCreatedDoctorInfo(null);
    setCopiedLink(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreatedDoctorInfo(null);
  };

  const handleSubmitDoctor = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Client-side validation
    const errs = {};
    if (!formData.full_name.trim()) errs.full_name = "Physician full name is required.";
    if (!formData.email.trim()) errs.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = "Please enter a valid email format.";
    }
    if (!formData.phone.trim()) errs.phone = "Phone number is required.";
    else if (formData.phone.trim().length < 7 || formData.phone.trim().length > 20) {
      errs.phone = "Phone must be between 7 and 20 digits.";
    }
    if (!formData.password || formData.password.trim().length < 8) {
      errs.password = "Initial password must be at least 8 characters long.";
    }
    if (!formData.specialization.trim()) errs.specialization = "Specialization is required.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.registerDoctor({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password.trim(),
        specialization: formData.specialization.trim(),
        qualification: formData.qualification.trim(),
        license_number: formData.license_number.trim(),
        experience_years: parseInt(formData.experience_years, 10) || 0,
        bio: formData.bio.trim()
      });

      setCreatedDoctorInfo(res);
      // Refresh directory
      await loadDoctors();
    } catch (err) {
      setFormError(err.message || "Failed to register physician");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyActivationUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const filtered = doctors.filter((d) => {
    const term = searchTerm.toLowerCase();
    const name = (d.full_name || d.name || "").toLowerCase();
    const spec = (d.specialization || "").toLowerCase();
    const lic = (d.license_number || "").toLowerCase();
    return name.includes(term) || spec.includes(term) || lic.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            {t("Physician Directory")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Administrative roster of registered clinicians, credentialing records, and consultation chambers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 transition shadow-xs cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t("Add New Physician")}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-xs max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by physician name, specialty, or license..."
          className="w-full bg-transparent text-sm text-foreground focus:outline-hidden placeholder:text-muted-foreground"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
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
          {filtered.map((doc) => {
            const displayName = doc.full_name || doc.name || "Physician";
            const initial = displayName.replace(/^Dr\.\s*/i, "").charAt(0) || "D";
            return (
              <div
                key={doc.doctor_id}
                className="rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 transition space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
                    {initial}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                    Active Clinical Roster
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-foreground text-base">
                    {displayName.startsWith("Dr.") ? displayName : `Dr. ${displayName}`}
                  </h3>
                  <p className="text-xs font-semibold text-primary mt-0.5">{doc.specialization || "Clinical Specialist"}</p>
                  {doc.qualification && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{doc.qualification}</p>
                  )}
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
                    <span>License: {doc.license_number || "Documented On-File"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      {doc.experience_years ? `${doc.experience_years} Years Exp.` : "Senior Consultant"} • OPD Hours: 09:00 - 17:00
                    </span>
                  </div>
                  {doc.bio && (
                    <div className="pt-1 text-[11px] text-muted-foreground/80 italic">
                      Chamber: {doc.bio}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Physician Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground animate-in fade-in-50 zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Add New Hospital Physician</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Created Success Display with Activation Link */}
            {createdDoctorInfo ? (
              <div className="py-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Physician Account Provisioned Successfully!</span>
                  </div>
                  <p className="text-xs">
                    Dr. {createdDoctorInfo.doctor?.full_name} has been enrolled in the active medical roster (#{createdDoctorInfo.doctor?.doctor_id}).
                  </p>
                </div>

                {createdDoctorInfo.activation_url ? (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Single-Use Cryptographic Activation Link
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">Expires in 72h</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No default plaintext password was assigned. Please share this secure activation link with the clinician to set their password:
                    </p>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border text-xs font-mono break-all">
                      <span className="select-all flex-1 text-foreground truncate">{createdDoctorInfo.activation_url}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyActivationUrl(createdDoctorInfo.activation_url)}
                        className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                    Direct physician account activated. The physician may sign in immediately using their email (<strong>{createdDoctorInfo.doctor?.email}</strong>) and assigned initial password.
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-primary/90 cursor-pointer"
                  >
                    Done & Return to Directory
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitDoctor} className="py-4 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t("Physician Full Name")} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    placeholder="e.g. Dr. Priya Deshmukh"
                    className={`w-full px-3 py-2 text-xs sm:text-sm rounded-xl border bg-background text-foreground focus:outline-hidden ${
                      fieldErrors.full_name ? "border-destructive ring-1 ring-destructive" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.full_name && <p className="text-[11px] text-destructive mt-1">{fieldErrors.full_name}</p>}
                </div>

                {/* Email, Phone & Initial Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Email Address")} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="e.g. priya.deshmukh@hospital.org"
                      className={`w-full px-3 py-2 text-xs sm:text-sm rounded-xl border bg-background text-foreground focus:outline-hidden ${
                        fieldErrors.email ? "border-destructive ring-1 ring-destructive" : "border-border focus:border-primary"
                      }`}
                    />
                    {fieldErrors.email && <p className="text-[11px] text-destructive mt-1">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Phone Number")} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="e.g. +91 98201 54321"
                      className={`w-full px-3 py-2 text-xs sm:text-sm rounded-xl border bg-background text-foreground focus:outline-hidden ${
                        fieldErrors.phone ? "border-destructive ring-1 ring-destructive" : "border-border focus:border-primary"
                      }`}
                    />
                    {fieldErrors.phone && <p className="text-[11px] text-destructive mt-1">{fieldErrors.phone}</p>}
                  </div>
                </div>

                {/* Initial Account Password */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t("Initial Account Password")} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={`w-full px-3 py-2 text-xs sm:text-sm rounded-xl border bg-background text-foreground focus:outline-hidden ${
                      fieldErrors.password ? "border-destructive ring-1 ring-destructive" : "border-border focus:border-primary"
                    }`}
                  />
                  {fieldErrors.password && <p className="text-[11px] text-destructive mt-1">{fieldErrors.password}</p>}
                </div>

                {/* Specialization & Qualification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Specialization")} <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.specialization}
                      onChange={(e) => handleInputChange("specialization", e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:border-primary cursor-pointer"
                    >
                      <option value="General Medicine">General Medicine</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Endocrinology">Endocrinology</option>
                      <option value="Pulmonology">Pulmonology</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Academic Qualification")}
                    </label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => handleInputChange("qualification", e.target.value)}
                      placeholder="e.g. MBBS, MD, DM"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:border-primary"
                    />
                  </div>
                </div>

                {/* License Number & Years Exp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Medical License Number")}
                    </label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={(e) => handleInputChange("license_number", e.target.value)}
                      placeholder="e.g. MCI-2022-78912"
                      className={`w-full px-3 py-2 text-xs sm:text-sm rounded-xl border bg-background text-foreground focus:outline-hidden ${
                        fieldErrors.license_number ? "border-destructive ring-1 ring-destructive" : "border-border focus:border-primary"
                      }`}
                    />
                    {fieldErrors.license_number && (
                      <p className="text-[11px] text-destructive mt-1">{fieldErrors.license_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {t("Years of Experience")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.experience_years}
                      onChange={(e) => handleInputChange("experience_years", e.target.value)}
                      placeholder="e.g. 8"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:border-primary"
                    />
                  </div>
                </div>

                {/* Bio / Chamber */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t("Consultation Chamber / Bio")}
                  </label>
                  <input
                    type="text"
                    value={formData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    placeholder="e.g. OPD Wing B, Room 204"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:border-primary"
                  />
                </div>

                {/* Modal Actions */}
                <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl border border-border text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                    <span>{submitting ? "Enrolling..." : t("Save")}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
