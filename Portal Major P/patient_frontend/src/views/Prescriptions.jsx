import React, { useState, useEffect } from 'react';
import { patientApi } from '../api';

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [tab, setTab] = useState('prescriptions'); // 'prescriptions' | 'regimens'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMed, setSelectedMed] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      patientApi.getPrescriptions(),
      patientApi.getMedications()
    ])
      .then(([rxData, medData]) => {
        setPrescriptions(rxData.prescriptions || []);
        setMedications(medData.medications || []);
      })
      .catch((err) => {
        console.error('Failed to load prescription data:', err);
        setError('Unable to load prescription history. Please check connection and try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
          Loading prescription records...
        </div>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving your authorized medical records from EHR database.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px solid #fecaca' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
          ⚠️ Data Retrieval Error
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-primary" onClick={fetchData}>
          🔄 Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="header-banner">
        <div>
          <h1>My Prescriptions & Medication Regimens</h1>
          <p>Read-Only Record of Authenticated Clinical Prescriptions & Dosing Instructions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn-primary ${tab !== 'prescriptions' ? 'btn-secondary' : ''}`}
            style={{ background: tab === 'prescriptions' ? 'var(--primary)' : '#e2e8f0', color: tab === 'prescriptions' ? 'white' : '#475569' }}
            onClick={() => { setTab('prescriptions'); setSelectedMed(null); }}
          >
            Prescriptions ({prescriptions.length})
          </button>
          <button
            className={`btn-primary ${tab !== 'regimens' ? 'btn-secondary' : ''}`}
            style={{ background: tab === 'regimens' ? 'var(--primary)' : '#e2e8f0', color: tab === 'regimens' ? 'white' : '#475569' }}
            onClick={() => { setTab('regimens'); setSelectedMed(null); }}
          >
            Distinct Medications ({medications.length})
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '0.85rem 1.25rem',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
        <div>
          <strong>Patient Medication Guidance:</strong> Prescription entries reflect official clinician orders stored in your EHR.
          Never start, alter, or discontinue prescribed treatments without consulting your physician.
          Absence of interaction warnings in configured rules does not guarantee that no clinical interactions exist.
        </div>
      </div>

      {tab === 'prescriptions' ? (
        <div>
          {prescriptions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Prescriptions on Record</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                You do not have any active or past medical prescriptions recorded in this clinic.
                Prescriptions issued during consultations will appear here automatically.
              </p>
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div key={rx.prescription_id} className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-title">
                  <div>
                    <span style={{ fontSize: '1.05rem', color: 'var(--primary)', fontWeight: 600 }}>
                      Prescription #{rx.prescription_id}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                      Issued: {rx.prescription_date}
                    </span>
                  </div>
                  <span className="badge badge-primary">Dr. {rx.doctor_name} ({rx.specialization})</span>
                </div>

                {rx.diagnosis && (
                  <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    <strong>Clinical Indication / Diagnosis:</strong> {rx.diagnosis}
                  </p>
                )}

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rx.medicines && rx.medicines.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{m.medicine_name}</td>
                        <td>{m.dosage || '—'}</td>
                        <td>{m.frequency || '—'}</td>
                        <td>{m.duration || '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{m.instructions || 'As advised'}</td>
                        <td>
                          <button
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--primary)',
                              color: 'var(--primary)',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedMed({
                              ...m,
                              doctor_name: rx.doctor_name,
                              prescription_date: rx.prescription_date,
                              diagnosis: rx.diagnosis
                            })}
                          >
                            ℹ️ Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rx.notes && (
                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                    Physician Notes: {rx.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Distinct Recorded Medications</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Deduplicated distinct medications prescribed across your consultation history with the most recent dosing schedule.
          </p>
          {medications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>No distinct medication regimens found.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Latest Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Last Prescribed</th>
                  <th>Prescribing Doctor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{m.medicine_name}</td>
                    <td>{m.latest_dosage || '—'}</td>
                    <td>{m.latest_frequency || '—'}</td>
                    <td>{m.latest_duration || '—'}</td>
                    <td>{m.last_prescribed_date}</td>
                    <td>{m.prescribed_by}</td>
                    <td>
                      <button
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--primary)',
                          color: 'var(--primary)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedMed({
                          medicine_name: m.medicine_name,
                          dosage: m.latest_dosage,
                          frequency: m.latest_frequency,
                          duration: m.latest_duration,
                          instructions: m.instructions,
                          doctor_name: m.prescribed_by,
                          prescription_date: m.last_prescribed_date,
                          diagnosis: m.diagnosis
                        })}
                      >
                        ℹ️ Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Medication Details Modal / Panel */}
      {selectedMed && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '560px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
                  💊 {selectedMed.medicine_name}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Persisted EHR Medication Record
                </span>
              </div>
              <button
                onClick={() => setSelectedMed(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Dosage:</span>
                  <strong>{selectedMed.dosage || 'Not specified'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Frequency:</span>
                  <strong>{selectedMed.frequency || 'Not specified'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Duration:</span>
                  <strong>{selectedMed.duration || 'Not specified'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Prescribed By:</span>
                  <strong>Dr. {selectedMed.doctor_name || 'Attending Physician'}</strong>
                </div>
              </div>
              {selectedMed.instructions && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Administration Instructions:</span>
                  <strong>{selectedMed.instructions}</strong>
                </div>
              )}
              {selectedMed.diagnosis && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Indication / Diagnosis:</span>
                  <span>{selectedMed.diagnosis}</span>
                </div>
              )}
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#1e40af' }}>
              <strong>Clinical Context Differentiation:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                The details above are factual clinical records from your consultation. General pharmacology or contraindication databases provide broad reference material and do not replace personalized medical advice from Dr. {selectedMed.doctor_name || 'your physician'}.
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e' }}>
              <strong>Interaction Rule Coverage Limitation:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                The local CDSS drug safety engine screens against verified high-severity clinical rules (DrugBank, SIDER). If no interaction is flagged, this confirms only that no rule in the configured local dataset matched—it does <em>not</em> guarantee that no drug, supplement, or food interactions exist.
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setSelectedMed(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
