import React, { useState, useEffect } from "react";
import { patientApi } from "../../api/patientApi";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Heart,
  AlertCircle,
  Home,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export default function PatientProfile() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await patientApi.getProfile();
        setProfile(res.patient || res);
      } catch (err) {
        setError(err.message || "Failed to load profile details.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading patient demographics...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        {error || "Patient demographic profile unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            {t("Patient Health Profile & Demographics") || "Patient Health Profile & Demographics"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Verified identity, clinical emergency contacts, and recorded physiological indicators.") || "Verified identity, clinical emergency contacts, and recorded physiological indicators."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit">
          <ShieldCheck className="w-3.5 h-3.5" />
          {t("Activated EHR Profile (RBAC: Patient)") || "Activated EHR Profile (RBAC: Patient)"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Avatar Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold border-2 border-primary/20 shadow-inner">
            {profile.name || profile.full_name ? (profile.name || profile.full_name).charAt(0).toUpperCase() : "P"}
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">{profile.name || profile.full_name || "Patient"}</h2>
          <p className="text-xs text-muted-foreground">{profile.email || "patient@gmail.com"}</p>
          <div className="mt-4 inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <Heart className="w-3.5 h-3.5" />
            {t("Blood Group:") || "Blood Group:"} {profile.blood_group || "Unknown"}
          </div>
        </div>

        {/* Demographics Detail Card */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-foreground border-b border-border/60 pb-3">
            {t("Identity & Contact Information") || "Identity & Contact Information"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Full Legal Name") || "Full Legal Name"}</span>
              <p className="text-foreground font-bold mt-0.5">{profile.name || profile.full_name || "N/A"}</p>
            </div>

            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Registered Email") || "Registered Email"}</span>
              <p className="text-foreground font-bold mt-0.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {profile.email || "N/A"}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Contact Telephone") || "Contact Telephone"}</span>
              <p className="text-foreground font-bold mt-0.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-primary" />
                {profile.phone || "N/A"}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Date of Birth / Age") || "Date of Birth / Age"}</span>
              <p className="text-foreground font-bold mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : `${profile.age || "N/A"} years`}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Biological Sex") || "Biological Sex"}</span>
              <p className="text-foreground font-bold mt-0.5">{profile.gender || "N/A"}</p>
            </div>

            <div>
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Documented Drug Allergies") || "Documented Drug Allergies"}</span>
              <p className="text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {profile.allergies || "No documented contraindications"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Residential Address") || "Residential Address"}</span>
              <p className="text-foreground font-bold mt-0.5 flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-primary" />
                {profile.address || "123 Medical Center Way, Sector 4"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-muted-foreground font-semibold uppercase text-[11px]">{t("Emergency Contact Person") || "Emergency Contact Person"}</span>
              <p className="text-foreground font-bold mt-0.5">
                {profile.emergency_contact || "Primary Caregiver (+91 98765 43210)"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
