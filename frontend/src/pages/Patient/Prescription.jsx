import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import EmptyState from "../../components/shared/EmptyState";
import { mockPrescriptionService } from "../../services/mock/mockPrescriptionService";
import { FileText } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Prescription() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const data = await mockPrescriptionService.getPrescriptions(user.id);
        setPrescriptions(data);
      }
      setIsLoading(false);
    }
    load();
  }, [user]);

  if (isLoading) {
    return <div className="text-center p-8">Loading prescriptions...</div>;
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Active Prescriptions"
        subtitle="Review active medical orders and dosage instructions."
      />

      {prescriptions.length === 0 ? (
        <EmptyState
          title="No Prescriptions Issued"
          description="Your medical consultant hasn't registered any prescription orders."
          icon={FileText}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prescriptions.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white">{p.medication}</h4>
                <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2.5 py-0.5 rounded-full">
                  {p.refills} Refills Left
                </span>
              </div>
              <p className="text-xs text-slate-500">Issued by: {p.doctorName} on {p.date}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                <span className="font-bold">Dosage:</span> {p.dosage}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
