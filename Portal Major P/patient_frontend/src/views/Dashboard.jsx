import React from 'react';

export default function Dashboard({ dashboard, onNavigate }) {
  if (!dashboard) {
    return <div>Loading care dashboard...</div>;
  }

  const { active_discharge, upcoming_appointments, recent_prescriptions } = dashboard;

  return (
    <div>
      <div className="header-banner">
        <div>
          <h1>Welcome, {dashboard.patient_name || 'Patient'}</h1>
          <p>Personal Health Overview & Post-Discharge Care Summary</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('assistant')}>
          💬 Open Post-Discharge Chat
        </button>
      </div>

      <div className="emergency-banner">
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <strong>Medical Notice & Emergency Advisory</strong>
          <p>
            This portal is an AI-augmented decision support assistant grounded in clinical guidelines.
            If you experience severe chest pain, shortness of breath, severe dizziness, or sudden numbness,
            call 108 / 112 immediately or proceed to the nearest emergency room.
          </p>
        </div>
      </div>

      {active_discharge && (
        <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-title">
            <span>🏥 Active Discharge Episode Follow-up</span>
            <span className="badge badge-primary">Discharged on {active_discharge.discharge_date}</span>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            <strong>Diagnosis:</strong> {active_discharge.diagnosis}
          </p>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <strong>Care Instructions:</strong> {active_discharge.discharge_instructions}
          </div>
          {active_discharge.follow_up_date && (
            <p style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>
              📅 Follow-up Planned: {active_discharge.follow_up_date} ({active_discharge.follow_up_instructions})
            </p>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => onNavigate('discharge')}>
              View Full Discharge Plan & Warning Signs →
            </button>
          </div>
        </div>
      )}

      <div className="grid-cards">
        {/* Appointments Card */}
        <div className="card">
          <div className="card-title">
            <span>📅 Upcoming Appointments</span>
            <span className="badge badge-primary">{upcoming_appointments?.length || 0}</span>
          </div>
          {upcoming_appointments && upcoming_appointments.length > 0 ? (
            upcoming_appointments.map((app, idx) => (
              <div key={idx} className="list-item">
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{app.doctor_name} ({app.specialization})</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Date: {app.appointment_date} at {app.start_time}
                </div>
                <span className="badge badge-success" style={{ marginTop: '0.25rem' }}>{app.status}</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No upcoming appointments scheduled.</p>
          )}
        </div>

        {/* Recent Prescriptions */}
        <div className="card">
          <div className="card-title">
            <span>💊 Recent Prescriptions</span>
            <span className="badge badge-primary">{recent_prescriptions?.length || 0}</span>
          </div>
          {recent_prescriptions && recent_prescriptions.length > 0 ? (
            recent_prescriptions.map((rx, idx) => (
              <div key={idx} className="list-item">
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rx.diagnosis || 'Clinical Consultation'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Prescribed by {rx.doctor_name} on {rx.prescription_date}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No prescription records recorded.</p>
          )}
          <div style={{ marginTop: '1rem' }}>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => onNavigate('prescriptions')}
            >
              View All Prescriptions →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
