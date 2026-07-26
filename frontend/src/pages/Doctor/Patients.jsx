import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import EmptyState from "../../components/shared/EmptyState";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Modal from "../../components/shared/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { mockPatientService } from "../../services/mock/mockPatientService";
import { mockHistoryService } from "../../services/mock/mockHistoryService";
import { mockPrescriptionService } from "../../services/mock/mockPrescriptionService";
import { Users, Search, MessageSquare, PlusCircle } from "lucide-react";

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientReports, setPatientReports] = useState([]);
  
  const [isPrescOpen, setIsPrescOpen] = useState(false);
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [refills, setRefills] = useState(0);

  useEffect(() => {
    async function load() {
      const data = await mockPatientService.searchPatients(query);
      setPatients(data);
      setIsLoading(false);
    }
    load();
  }, [query]);

  const handleSelectPatient = async (pat) => {
    setSelectedPatient(pat);
    const history = await mockHistoryService.getMedicalHistory(pat.id);
    const reports = await mockHistoryService.getReports(pat.id);
    setPatientHistory(history);
    setPatientReports(reports);
  };

  const handleIssuePrescription = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !medication) return;

    await mockPrescriptionService.addPrescription({
      patientId: selectedPatient.id,
      doctorId: user.id,
      doctorName: user.name,
      medication,
      dosage,
      refills,
    });

    setMedication("");
    setDosage("");
    setRefills(0);
    setIsPrescOpen(false);
    alert(`Prescription for ${medication} issued successfully!`);
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Patient Directory"
        subtitle="Manage assigned patient medical records and diagnostic files."
      />

      <div className="relative max-w-md">
        <Input
          id="search-patients"
          type="text"
          placeholder="Search patient by name..."
          icon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center p-8">Loading patients...</div>
      ) : patients.length === 0 ? (
        <EmptyState
          title="No Patients Found"
          description="There are no patients matching your query inside the database."
          icon={Users}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patients.map((pat) => (
            <Card key={pat.id} className="flex flex-col gap-4 cursor-pointer hover:border-primary-500 transition-colors" onClick={() => handleSelectPatient(pat)}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400 font-bold">
                  {pat.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{pat.name}</h4>
                  <p className="text-xs text-slate-500">{pat.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Age</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{pat.age || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Gender</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{pat.gender || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Blood Group</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{pat.bloodGroup || "N/A"}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Patient Details Modal */}
      <Modal isOpen={!!selectedPatient} onClose={() => setSelectedPatient(null)} title={selectedPatient?.name || "Patient Record"}>
        <div className="flex flex-col gap-5">
          <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400">Contact Email</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedPatient?.email}</p>
              <p className="text-xs text-slate-400 mt-2">Phone Number</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedPatient?.phone || "Not provided"}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate("/doctor/chat", { state: { patientId: selectedPatient.id } })} className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" /> Chat
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsPrescOpen(true)} className="flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4" /> Prescribe
              </Button>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Medical History</h5>
            {patientHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No medical history logged.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {patientHistory.map((h) => (
                  <div key={h.id} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5 dark:border-slate-800">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{h.condition}</p>
                      <p className="text-[10px] text-slate-400">Diagnosed: {h.diagnosedDate}</p>
                    </div>
                    <span className="bg-primary-50 text-primary-700 font-semibold px-2 py-0.5 rounded-full">
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Diagnostic Reports</h5>
            {patientReports.length === 0 ? (
              <p className="text-xs text-slate-500">No reports uploaded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {patientReports.map((r) => (
                  <div key={r.id} className="text-xs border-b border-slate-100 pb-2 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</p>
                    <p className="text-[10px] text-slate-400">{r.date} - {r.status}</p>
                    {r.notes && <p className="text-[11px] text-slate-500 mt-1 italic">Notes: {r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Prescription Issue Modal */}
      <Modal isOpen={isPrescOpen} onClose={() => setIsPrescOpen(false)} title={`Issue Prescription for ${selectedPatient?.name}`}>
        <form onSubmit={handleIssuePrescription} className="flex flex-col gap-4">
          <Input id="med-name" label="Medication Name" placeholder="e.g. Amoxicillin 500mg" value={medication} onChange={(e) => setMedication(e.target.value)} required />
          <Input id="med-dosage" label="Dosage Instruction" placeholder="e.g. Thrice daily after meals" value={dosage} onChange={(e) => setDosage(e.target.value)} required />
          <Input id="med-refills" label="Refills Count" type="number" value={refills} onChange={(e) => setRefills(e.target.value)} required />
          <Button type="submit" className="w-full mt-2">Confirm Prescription</Button>
        </form>
      </Modal>
    </div>
  );
}
