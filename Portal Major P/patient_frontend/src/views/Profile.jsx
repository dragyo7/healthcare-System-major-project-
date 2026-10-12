import React, { useState, useEffect } from 'react';
import { patientApi } from '../api';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientApi.getProfile()
      .then(data => setProfile(data.patient))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading profile demographics...</div>;
  if (!profile) return <div>Profile not found.</div>;

  return (
    <div>
      <div className="header-banner">
        <div>
          <h1>My Patient Profile</h1>
          <p>Verified Identity & Demographics</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <div className="card-title">Personal Demographic Details</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</label>
            <div style={{ fontWeight: 600 }}>{profile.full_name}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Email</label>
            <div style={{ fontWeight: 600 }}>{profile.email}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact Phone</label>
            <div style={{ fontWeight: 600 }}>{profile.phone}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date of Birth</label>
            <div style={{ fontWeight: 600 }}>{profile.date_of_birth}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Biological Sex / Gender</label>
            <div style={{ fontWeight: 600 }}>{profile.gender}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Blood Group</label>
            <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{profile.blood_group}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Documented Allergies</label>
            <div style={{ fontWeight: 600 }}>{profile.allergies || 'No documented allergies'}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Emergency Contact</label>
            <div style={{ fontWeight: 600 }}>{profile.emergency_contact || 'None'}</div>
          </div>
        </div>

        {profile.address && (
          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Residential Address</label>
            <div style={{ fontWeight: 500 }}>{profile.address}</div>
          </div>
        )}
      </div>
    </div>
  );
}
