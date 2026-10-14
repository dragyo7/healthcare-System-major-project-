import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { User, Mail, Shield, Award, Phone, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function DoctorProfile() {
  const { user } = useAuth();
  const [phone, setPhone] = useState("+91 98765 43210");
  const [department, setDepartment] = useState("Internal Medicine / Cardiology");
  const [room, setRoom] = useState("OPD-304");
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clinician Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your verified clinical credentials, licensing, and practice details
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit">
          <Shield className="w-3.5 h-3.5" />
          Verified Practitioner (RBAC: Doctor)
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
              <span>License: <strong className="text-foreground">MCI-2018-849201</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 text-primary" />
              <span className="truncate">{user?.email || "doctor@hospital.org"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>Roster: Mon - Fri (09:00 - 17:00)</span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-base font-semibold text-foreground mb-4">Practice Details & Availability</h3>
          
          {saved && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Profile and contact settings updated successfully.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Legal Name</label>
                <input
                  type="text"
                  readOnly
                  value={`Dr. ${user?.name || "Practitioner"}`}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Medical Registration No.</label>
                <input
                  type="text"
                  readOnly
                  value="MCI-2018-849201"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Clinical Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Clinic / OPD Chamber</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Hospital Emergency Ext. / Phone</label>
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
                className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm"
              >
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
