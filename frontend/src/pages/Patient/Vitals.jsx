import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import StatCard from "../../components/shared/StatCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/shared/Modal";
import { Heart, Activity, Thermometer, PlusCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { mockPatientService } from "../../services/mock/mockPatientService";

export default function Vitals() {
  const { user } = useAuth();
  const [vitals, setVitals] = useState({
    heartRate: "72 BPM",
    oxygenSaturation: "98%",
    bodyTemperature: "98.6 °F",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [hr, setHr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temp, setTemp] = useState("");

  async function load() {
    setIsLoading(true);
    if (user?.id) {
      const data = await mockPatientService.getVitals(user.id);
      setVitals(data);
      setHr(data.heartRate.replace(" BPM", ""));
      setSpo2(data.oxygenSaturation.replace("%", ""));
      setTemp(data.bodyTemperature.replace(" °F", ""));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    const heartRate = hr.includes("BPM") ? hr : `${hr} BPM`;
    const oxygenSaturation = spo2.includes("%") ? spo2 : `${spo2}%`;
    const bodyTemperature = temp.includes("°F") ? temp : `${temp} °F`;

    await mockPatientService.updateVitals(user.id, {
      heartRate,
      oxygenSaturation,
      bodyTemperature,
    });

    setIsModalOpen(false);
    load();
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      <PageHeader
        title="Vitals & Telemetry Log"
        subtitle="Review real-time biometric inputs synchronizing from your mobile app."
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Log Vitals
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center p-8">Loading telemetry...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard
              title="Heart Rate"
              value={vitals.heartRate}
              icon={Heart}
              description="Normal resting sinus heart rate"
            />
            <StatCard
              title="Oxygen Saturation"
              value={vitals.oxygenSaturation}
              icon={Activity}
              description="Optimal cellular oxygen levels"
            />
            <StatCard
              title="Body Temperature"
              value={vitals.bodyTemperature}
              icon={Thermometer}
              description="Standard core temperature"
            />
          </div>

          <Card>
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Android Integration Status</h3>
            <p className="text-sm text-slate-500">
              Native health log monitoring is active. Background sync events run every 15 minutes while the Capacitor runtime application remains in memory.
            </p>
          </Card>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Biometrics">
        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <Input
            id="vit-hr"
            label="Heart Rate (BPM)"
            type="number"
            placeholder="e.g. 72"
            value={hr}
            onChange={(e) => setHr(e.target.value)}
            required
          />
          <Input
            id="vit-spo2"
            label="Oxygen Saturation (%)"
            type="number"
            placeholder="e.g. 98"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            required
          />
          <Input
            id="vit-temp"
            label="Body Temperature (°F)"
            type="number"
            step="0.1"
            placeholder="e.g. 98.6"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            required
          />
          <Button type="submit" className="w-full mt-2">
            Save Vitals
          </Button>
        </form>
      </Modal>
    </div>
  );
}
