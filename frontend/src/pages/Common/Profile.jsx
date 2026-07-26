import React, { useState, useEffect } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Avatar from "../../components/shared/Avatar";
import { useAuth } from "../../contexts/AuthContext";
import { mockPatientService } from "../../services/mock/mockPatientService";
import { mockDoctorService } from "../../services/mock/mockDoctorService";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
];

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState("");

  const service = user?.role === "doctor" ? mockDoctorService : mockPatientService;

  useEffect(() => {
    async function load() {
      if (user?.id) {
        const data = await service.getProfile(user.id);
        setProfile(data);
      }
      setIsLoading(false);
    }
    load();
  }, [user, service]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaved(false);
    try {
      await service.updateProfile(user.id, profile);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      setError("Failed to save profile details");
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading profile...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl select-none animate-fadeIn">
      <PageHeader
        title="Personal Profile"
        subtitle="Manage details displayed across clinical records."
      />

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {isSaved && (
            <div className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-400">
              Profile updated successfully.
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Avatar Selector */}
          <div className="flex flex-col gap-2.5 items-center sm:flex-row sm:gap-6 border-b border-slate-100 pb-5 dark:border-slate-800">
            <Avatar name={profile?.name} src={profile?.avatar} size="lg" className="h-16 w-16" />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Avatar Profile</span>
              <div className="flex gap-2">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setProfile({ ...profile, avatar: url })}
                    className={`h-10 w-10 rounded-full overflow-hidden border-2 transition-all ${
                      profile?.avatar === url ? "border-primary-600 scale-105" : "border-transparent"
                    }`}
                  >
                    <img src={url} alt="Preset Avatar" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or paste custom image URL..."
                value={profile?.avatar || ""}
                onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
                className="h-9 px-3 w-60 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 text-xs focus:outline-hidden text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          <Input
            id="name"
            label="Full Name"
            type="text"
            value={profile?.name || ""}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            required
          />

          <Input
            id="email"
            label="Email Address"
            type="email"
            value={profile?.email || ""}
            disabled
          />

          <Input
            id="phone"
            label="Phone Number"
            type="text"
            value={profile?.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />

          {user?.role === "doctor" ? (
            <Input
              id="specialization"
              label="Specialization"
              type="text"
              value={profile?.specialization || ""}
              onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Input
                id="age"
                label="Age"
                type="number"
                value={profile?.age || ""}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              />
              <Input
                id="gender"
                label="Gender"
                type="text"
                value={profile?.gender || ""}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              />
              <Input
                id="bloodGroup"
                label="Blood Group"
                type="text"
                value={profile?.bloodGroup || ""}
                onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
              />
            </div>
          )}

          <Button type="submit" className="mt-4">
            Save Profile
          </Button>
        </form>
      </Card>
    </div>
  );
}
