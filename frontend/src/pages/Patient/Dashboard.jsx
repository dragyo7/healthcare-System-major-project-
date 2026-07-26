import React, { useState, useEffect } from "react";
import { Heart, Activity, Flame, Calendar, ArrowRight, Clipboard, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../components/shared/PageHeader";
import StatCard from "../../components/shared/StatCard";
import Card from "../../components/shared/Card";
import SectionTitle from "../../components/shared/SectionTitle";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { mockDashboardService } from "../../services/mock/mockDashboardService";
import { mockHistoryService } from "../../services/mock/mockHistoryService";
import { mockAppointmentService } from "../../services/mock/mockAppointmentService";
import { mockPrescriptionService } from "../../services/mock/mockPrescriptionService";

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [history, setHistory] = useState([]);
  const [nextApt, setNextApt] = useState(null);
  const [latestPresc, setLatestPresc] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const statsData = await mockDashboardService.getPatientStats(user.id);
        setStats(statsData);

        const histData = await mockHistoryService.getMedicalHistory(user.id);
        setHistory(histData.slice(0, 3));

        const apts = await mockAppointmentService.getAppointments("patient", user.id);
        const scheduled = apts.filter((a) => a.status === "scheduled");
        if (scheduled.length > 0) {
          setNextApt(scheduled[0]);
        }

        const prescs = await mockPrescriptionService.getPrescriptions(user.id);
        if (prescs.length > 0) {
          setLatestPresc(prescs[0]);
        }

        const reports = await mockHistoryService.getReports(user.id);
        if (reports.length > 0) {
          setLatestReport(reports[0]);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [user]);

  const iconMap = [Heart, Activity, Flame];

  if (isLoading) {
    return <div className="text-center p-8">Loading Personal Health Index...</div>;
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Personal Health Index"
        subtitle="Review your biometric telemetry logs, diagnostic records, and prescriptions."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={iconMap[index % iconMap.length]}
            description={stat.description}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Next Consultation Slot</SectionTitle>
              <Link to="/patient/appointments" className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                Manage Calendar <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {nextApt ? (
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/20 text-primary-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{nextApt.doctorName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{nextApt.date} at {nextApt.time} - {nextApt.reason}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/patient/chat")}>
                  Ask Doctor
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No appointments scheduled currently.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Latest Diagnostic File</SectionTitle>
              <Link to="/patient/records" className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View All Records <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {latestReport ? (
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" /> {latestReport.title}
                  </h4>
                  <span className="text-[10px] bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                    {latestReport.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Logged on {latestReport.date}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic border-t border-slate-100/50 pt-2 dark:border-slate-800/50">
                  {latestReport.notes}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No diagnostic reports uploaded yet.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionTitle>Recent Medication</SectionTitle>
              <Link to="/patient/prescriptions" className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {latestPresc ? (
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{latestPresc.medication}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{latestPresc.dosage}</p>
                <p className="text-[10px] text-slate-400 mt-2">Dr. {latestPresc.doctorName}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No prescriptions issued.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Clinical History</SectionTitle>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No health history log.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((hist) => (
                  <div key={hist.id} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{hist.condition}</p>
                      <p className="text-[10px] text-slate-400">Diagnosed: {hist.diagnosedDate}</p>
                    </div>
                    <span className="bg-primary-50 text-primary-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                      {hist.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
