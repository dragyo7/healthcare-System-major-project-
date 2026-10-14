import React, { useState, useEffect } from "react";
import { receptionistApi } from "../../api/receptionistApi";
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Heart,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export default function ReceptionistPatients() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [activationAlert, setActivationAlert] = useState(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "Male",
    blood_group: "O+",
    address: "",
    emergency_contact: "",
    allergies: "No known drug allergies",
  });

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await receptionistApi.getPatients();
      setPatients(list);
    } catch (err) {
      setError(err.message || "Failed to load patient records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const created = await receptionistApi.registerPatient(formData);
      
      // Compute the canonical frontend activation link
      let actUrl = created.activation_url;
      if (created.activation_token) {
        actUrl = `${window.location.origin}/activate?token=${created.activation_token}`;
      } else if (actUrl && actUrl.includes(":5175")) {
        actUrl = actUrl.replace(":5175", ":5173");
      }

      setActivationAlert({
        name: created.full_name || formData.full_name,
        patient_id: created.patient_id,
        email: formData.email,
        activation_url: actUrl,
      });

      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        date_of_birth: "",
        gender: "Male",
        blood_group: "O+",
        address: "",
        emergency_contact: "",
        allergies: "No known drug allergies",
      });
      loadPatients();
    } catch (err) {
      setFormError(err.message || "Registration failed. Check if email already exists.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyActivationLink = () => {
    if (!activationAlert?.activation_url) return;
    navigator.clipboard.writeText(activationAlert.activation_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const filtered = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    const name = (p.full_name || p.name || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const phone = (p.phone || "").toLowerCase();
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Patient Directory & Administrative Intake
          </h1>
          <p className="text-sm text-muted-foreground">
            Search patient records, register new admissions, and issue secure cryptographic account activation credentials.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm w-fit"
        >
          <UserPlus className="w-4 h-4" />
          Intake New Patient
        </button>
      </div>

      {/* Cryptographic Account Activation Banner */}
      {activationAlert && (
        <div className="p-5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-foreground space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Patient Registered Successfully — Single-Use Activation Token Generated
            </div>
            <button
              onClick={() => setActivationAlert(null)}
              className="text-muted-foreground hover:text-foreground text-xs p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs space-y-1 text-muted-foreground">
            <p>
              Patient: <strong className="text-foreground">{activationAlert.name}</strong> (EHR ID: #{activationAlert.patient_id})
            </p>
            <p>
              Registered Email: <strong className="text-foreground">{activationAlert.email}</strong>
            </p>
            <p className="text-emerald-700 dark:text-emerald-300">
              Provide this cryptographic activation URL to the patient to complete password setup:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={activationAlert.activation_url}
              className="flex-1 min-w-[280px] px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground"
            />
            <button
              onClick={copyActivationLink}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied Link!" : "Copy Link"}
            </button>
            <a
              href={activationAlert.activation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Activation Flow
            </a>
          </div>
        </div>
      )}

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
          placeholder="Search by patient name, phone, or email..."
          className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      {/* Patients Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground ml-2">Loading directory...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No patient records found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">EHR ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">DOB / Age</th>
                  <th className="py-3 px-4">Sex / Blood</th>
                  <th className="py-3 px-4">Known Allergies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((p) => (
                  <tr key={p.patient_id} className="hover:bg-muted/20 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-primary">#{p.patient_id}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {p.full_name || p.name}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{p.phone || "No phone"}</span>
                        <span className="text-[11px] opacity-80">{p.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : `${p.age || "N/A"} yrs`}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="font-medium text-foreground">{p.gender}</span> /{" "}
                      <span className="font-bold text-rose-600">{p.blood_group}</span>
                    </td>
                    <td className="py-3 px-4 text-amber-600 font-medium">
                      {p.allergies || "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Intake Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-2xl border border-border bg-card shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Patient Intake & Account Registration
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    name="full_name"
                    placeholder="e.g. Rahul Sharma"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    name="email"
                    placeholder="e.g. rahul@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    name="phone"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Biological Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Blood Group</label>
                  <select
                    name="blood_group"
                    value={formData.blood_group}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">Residential Address</label>
                  <input
                    type="text"
                    name="address"
                    placeholder="House/Street, City, State"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">Emergency Contact & Phone</label>
                  <input
                    type="text"
                    name="emergency_contact"
                    placeholder="Name & Relationship (Phone Number)"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">Known Drug Allergies</label>
                  <input
                    type="text"
                    name="allergies"
                    placeholder="e.g. Penicillin, Sulfa, Aspirin (or 'No known drug allergies')"
                    value={formData.allergies}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Provisioning Patient...
                    </>
                  ) : (
                    "Register & Generate Token"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
