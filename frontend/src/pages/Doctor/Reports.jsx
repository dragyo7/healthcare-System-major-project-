import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import EmptyState from "../../components/shared/EmptyState";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/shared/Modal";
import { FileText, PlusCircle } from "lucide-react";
import { mockHistoryService } from "../../services/mock/mockHistoryService";
import { mockPatientService } from "../../services/mock/mockPatientService";
import { getDB } from "../../services/mock/db";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportNotes, setReportNotes] = useState("");

  async function loadData() {
    setIsLoading(true);
    const db = getDB();
    // Fetch all reports
    setReports(db.reports || []);
    // Fetch all patients
    const patientList = await mockPatientService.searchPatients("");
    setPatients(patientList);
    if (patientList.length > 0) {
      setSelectedPatientId(patientList[0].id);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !reportTitle) return;

    await mockHistoryService.addReport({
      patientId: selectedPatientId,
      title: reportTitle,
      status: "Reviewed",
      notes: reportNotes,
    });

    // Reset and reload
    setReportTitle("");
    setReportNotes("");
    setIsModalOpen(false);
    loadData();
  };

  const getPatientName = (patientId) => {
    const db = getDB();
    return db.profiles[patientId]?.name || "Unknown Patient";
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Diagnostic Reports"
        subtitle="Review clinical summaries, lab outputs, and scan reports."
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Upload Report
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center p-8">Loading reports...</div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports logged"
          description="Upload patient diagnostics summaries to make them accessible."
          icon={FileText}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{report.title}</h4>
                  <span className="text-xs text-slate-500 font-medium">Patient: {getPatientName(report.patientId)}</span>
                </div>
                <span className="text-xs bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 font-semibold px-2.5 py-0.5 rounded-full">
                  {report.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">Date Logged: {report.date}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 pt-2 dark:border-slate-800">
                {report.notes}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Upload Patient Report">
        <form onSubmit={handleUploadReport} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Patient</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl text-sm focus:outline-hidden"
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="report-title"
            label="Report Title"
            type="text"
            placeholder="e.g. ECG Summary Report"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diagnostic Notes</label>
            <textarea
              placeholder="Enter notes and observations..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              className="w-full min-h-[100px] p-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl text-sm focus:outline-hidden resize-none"
              required
            />
          </div>

          <Button type="submit" className="w-full mt-2">
            Submit Report
          </Button>
        </form>
      </Modal>
    </div>
  );
}
