import React, { useState, useEffect } from 'react';
import { patientApi } from '../api';
import HealthAssistant from './HealthAssistant';

export default function DischargeCare({ onNavigate }) {
  const [discharge, setDischarge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    patientApi.getDischarge()
      .then(data => setDischarge(data.discharge))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading discharge care episode...</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>;

  if (!discharge) {
    return (
      <div className="card">
        <div className="card-title">Discharge Care Instructions</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          No hospital discharge records currently found for your patient profile.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="header-banner">
        <div>
          <h1>Post-Discharge Care & Follow-up</h1>
          <p>Treating Physician: {discharge.doctor_name} ({discharge.specialization})</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('assistant')}>
          Ask Discharge Assistant
        </button>
      </div>

      {/* Critical Red Warning Banner */}
      <div style={{
        background: '#fff1f2',
        border: '2px solid #e11d48',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🚨</span>
          <h3 style={{ color: '#9f1239', fontSize: '1.1rem', fontWeight: 700 }}>
            Critical Warning Signs — When to Seek Immediate Emergency Care
          </h3>
        </div>
        <p style={{ color: '#881337', fontSize: '0.95rem', lineHeight: 1.5, fontWeight: 500 }}>
          {discharge.warning_signs}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title">
          <span>Clinical Discharge Summary</span>
          <span className="badge badge-success">Status: {discharge.status}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Admission Date</label>
            <div style={{ fontWeight: 600 }}>{discharge.admission_date || 'N/A'}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discharge Date</label>
            <div style={{ fontWeight: 600 }}>{discharge.discharge_date}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Diagnosis</label>
            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{discharge.diagnosis}</div>
          </div>
        </div>

        {discharge.discharge_summary && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Physician's Summary</label>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem' }}>
              {discharge.discharge_summary}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Patient Discharge Instructions</label>
          <div style={{ background: 'var(--primary-light)', color: '#0369a1', padding: '1rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.5 }}>
            {discharge.discharge_instructions}
          </div>
        </div>

        {discharge.follow_up_instructions && (
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Follow-up Schedule</label>
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
              📅 {discharge.follow_up_date ? `Planned for: ${discharge.follow_up_date} — ` : ''}
              {discharge.follow_up_instructions}
            </div>
          </div>
        )}
      </div>

      {/* Embedded Post-Discharge Clinical Chat Assistant */}
      <div style={{ marginTop: '2.5rem' }}>
        <HealthAssistant />
      </div>
    </div>
  );
}
