import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import EmptyState from "../../components/shared/EmptyState";
import { mockHistoryService } from "../../services/mock/mockHistoryService";
import { FileText } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Records() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const mh = await mockHistoryService.getMedicalHistory(user.id);
        const rep = await mockHistoryService.getReports(user.id);
        setHistory(mh);
        setReports(rep);
      }
      setIsLoading(false);
    }
    load();
  }, [user]);

  if (isLoading) {
    return <div className="text-center p-8">Loading health records...</div>;
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Clinical Health Records"
        subtitle="Review certified logs, diagnoses, and laboratory results."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Conditions Section */}
        <Card className="flex flex-col gap-4">
          <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
            Diagnosed Conditions
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No active diagnosed conditions logged.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{h.condition}</p>
                    <p className="text-xs text-slate-400">Diagnosed: {h.diagnosedDate}</p>
                  </div>
                  <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2 py-0.5 rounded-full">
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Diagnostic Reports */}
        <Card className="flex flex-col gap-4">
          <h3 className="font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-2 dark:border-slate-800">
            Uploaded Laboratory Reports
          </h3>
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">No uploaded reports logged.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reports.map((r) => (
                <div key={r.id} className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</p>
                    <p className="text-xs text-slate-400">Date: {r.date}</p>
                  </div>
                  <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
