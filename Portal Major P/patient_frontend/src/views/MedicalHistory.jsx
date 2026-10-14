import React, { useState, useEffect } from 'react';
import { patientApi } from '../api';

export default function MedicalHistory() {
  const [history, setHistory] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientApi.getMedicalHistory()
      .then(data => {
        setHistory(data.medical_history || []);
        setSymptoms(data.symptoms || []);
        setReports(data.reports || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading medical records...</div>;

  return (
    <div>
      <div className="header-banner">
        <div>
          <h1>My Medical Records & Health Profile</h1>
          <p>Authoritative Health Conditions, Reported Symptoms & Lab Reports</p>
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Conditions */}
        <div className="card">
          <div className="card-title">
            <span>🩺 Diagnosed Conditions</span>
            <span className="badge badge-primary">{history.length}</span>
          </div>
          {history.length > 0 ? (
            history.map((h) => (
              <div key={h.history_id} className="list-item">
                <div style={{ fontWeight: 600 }}>{h.condition_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Diagnosis: {h.diagnosis}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Diagnosed on: {h.diagnosed_date}
                </div>
                {h.notes && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Notes: {h.notes}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No chronic conditions recorded.</p>
          )}
        </div>

        {/* Symptoms */}
        <div className="card">
          <div className="card-title">
            <span>📝 Reported Symptoms</span>
            <span className="badge badge-warning">{symptoms.length}</span>
          </div>
          {symptoms.length > 0 ? (
            symptoms.map((s) => (
              <div key={s.symptom_id} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{s.symptoms}</span>
                  <span className={`badge ${s.severity === 'Severe' ? 'badge-danger' : 'badge-warning'}`}>
                    {s.severity}
                  </span>
                </div>
                {s.description && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {s.description}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Reported on: {s.reported_date}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No recent symptoms recorded.</p>
          )}
        </div>
      </div>

      {/* Diagnostic Reports */}
      <div className="card">
        <div className="card-title">
          <span>🔬 Diagnostic Reports</span>
          <span className="badge badge-primary">{reports.length}</span>
        </div>
        {reports.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Report Name</th>
                <th>Date</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.report_id}>
                  <td style={{ fontWeight: 600 }}>{r.report_type}</td>
                  <td>{r.report_name}</td>
                  <td>{r.report_date}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.report_summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No lab reports uploaded.</p>
        )}
      </div>
    </div>
  );
}
