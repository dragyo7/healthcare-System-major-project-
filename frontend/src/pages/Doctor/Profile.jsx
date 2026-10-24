import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { doctorApi } from "../../api/doctorApi";
import { useLanguage } from "../../contexts/LanguageContext";
import { User, Mail, Shield, Award, Phone, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function DoctorProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [phone, setPhone] = useState("+91 98765 43210");
  const [department, setDepartment] = useState("Internal Medicine / Cardiology");
  const [room, setRoom] = useState("OPD-304");
  const [license, setLicense] = useState("MCI-2018-849201");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDoctorProfile() {
      try {
        setLoading(true);
        const data = await doctorApi.getProfile();
        if (isMounted && data?.doctor) {
          if (data.doctor.phone) setPhone(data.doctor.phone);
          if (data.doctor.specialization) setDepartment(data.doctor.specialization);
          if (data.doctor.license_number) setLicense(data.doctor.license_number);
          if (data.doctor.bio) setRoom(data.doctor.bio);
        }
      } catch (err) {
        // Fallback gracefully to default state if profile fetch fails
        console.warn("Could not load backend doctor profile:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadDoctorProfile();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await doctorApi.updateProfile({
        full_name: user?.name || "Doctor",
        phone: phone,
        specialization: department,
        bio: room
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save profile error:", err);
      setError(err.message || "Failed to save profile changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Clinician Profile") || "Clinician Profile"}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Manage your verified clinical credentials, licensing, and practice details") || "Manage your verified clinical credentials, licensing, and practice details"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit">
          <Shield className="w-3.5 h-3.5" />
          {t("Verified Practitioner (RBAC: Doctor)") || "Verified Practitioner (RBAC: Doctor)"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-1 rounded-xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold border-2 border-primary/20 shadow-inner">
            {user?.name ? user.name.charAt(0).toUpperCase() : "D"}
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">Dr. {user?.name || "Clinical Specialist"}</h2>
          <p className="text-xs text-muted-foreground">{user?.email || "doctor@gmail.com"}</p>

          <div className="mt-6 pt-6 border-t border-border/60 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="w-4 h-4 text-primary" />
              <span>{t("License:") || "License:"} <strong className="text-foreground">{license}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 text-primary" />
              <span className="truncate">{user?.email || "doctor@hospital.org"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>{t("Roster: Mon - Fri (09:00 - 17:00)") || "Roster: Mon - Fri (09:00 - 17:00)"}</span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground mb-4">{t("Practice Details & Availability") || "Practice Details & Availability"}</h3>

          {saved && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {t("Profile and contact settings updated successfully.") || "Profile and contact settings updated successfully."}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Full Legal Name") || "Full Legal Name"}</label>
                <input
                  type="text"
                  readOnly
                  value={`Dr. ${user?.name || "Practitioner"}`}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Medical Registration No.") || "Medical Registration No."}</label>
                <input
                  type="text"
                  readOnly
                  value={license}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">{t("Clinical Department") || "Clinical Department"}</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">{t("Clinic / OPD Chamber") || "Clinic / OPD Chamber"}</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{t("Hospital Emergency Ext. / Phone") || "Hospital Emergency Ext. / Phone"}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? (t("Saving...") || "Saving Changes...") : (t("Save Profile Changes") || "Save Profile Changes")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
