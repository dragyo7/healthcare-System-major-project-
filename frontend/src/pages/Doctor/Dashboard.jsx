import React, { useState, useEffect } from "react";
import { Users, Calendar, AlertCircle, ArrowRight, Activity, MessageSquare } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import PageHeader from "../../components/shared/PageHeader";
import StatCard from "../../components/shared/StatCard";
import Card from "../../components/shared/Card";
import SectionTitle from "../../components/shared/SectionTitle";
import Button from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { mockDashboardService } from "../../services/mock/mockDashboardService";
import { mockAppointmentService } from "../../services/mock/mockAppointmentService";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [activities, setActivities] = useState([]);
  const [todayApts, setTodayApts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const statsData = await mockDashboardService.getDoctorStats(user.id);
        setStats(statsData);

        const activityData = await mockDashboardService.getRecentActivity("doctor", user.id);
        setActivities(activityData);

        const allApts = await mockAppointmentService.getAppointments("doctor", user.id);
        setTodayApts(allApts.filter(a => a.status === "scheduled").slice(0, 3));
      }
      setIsLoading(false);
    }
    load();
  }, [user]);

  const iconMap = [Users, Calendar, AlertCircle];

  if (isLoading) {
    return <div className="text-center p-8">Loading Clinician Workspace...</div>;
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Clinician Workspace"
        subtitle={`Welcome, Dr. ${user?.name || ""}. Access automated patient diagnostic tools and record indexes.`}
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
        {/* Today's Queue */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Clinical Queue Overview</SectionTitle>
            <Link to="/doctor/appointments" className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View Calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {todayApts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No active diagnostic requests or upcoming consultations in queue today.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {todayApts.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{apt.patientName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{apt.date} at {apt.time} - {apt.reason}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/doctor/chat", { state: { patientId: apt.patientId } })}
                    className="flex items-center gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" /> Message
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col gap-4">
          <SectionTitle>Recent Activity</SectionTitle>
          {activities.length === 0 ? (
            <p className="text-xs text-slate-500">No recent updates logged.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{act.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{act.description}</p>
                    <span className="text-[9px] text-slate-400">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
