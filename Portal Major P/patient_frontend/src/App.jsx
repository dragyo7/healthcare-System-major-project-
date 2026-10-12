import React, { useState, useEffect } from 'react';
import { getAuthToken, removeAuthToken, patientApi } from './api';
import Login from './views/Login';
import Activate from './views/Activate';
import Dashboard from './views/Dashboard';
import DischargeCare from './views/DischargeCare';
import Prescriptions from './views/Prescriptions';
import MedicalHistory from './views/MedicalHistory';
import HealthAssistant from './views/HealthAssistant';
import Profile from './views/Profile';

export default function App() {
  const [token, setToken] = useState(getAuthToken());
  const [patient, setPatient] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [authView, setAuthView] = useState(() => {
    // If not authenticated, check if user arrived on /activate or has ?token=
    if (!getAuthToken()) {
      if (typeof window !== 'undefined' && (window.location.pathname === '/activate' || window.location.search.includes('token='))) {
        return 'activate';
      }
    }
    return 'login';
  });

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([
        patientApi.getProfile(),
        patientApi.getDashboard()
      ]).then(([profData, dashData]) => {
        setPatient(profData.patient);
        setDashboard(dashData);
      }).catch((err) => {
        console.error("Auth check failed:", err);
        const msg = String(err.message || '').toLowerCase();
        if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid token') || msg.includes('jwt expired')) {
          removeAuthToken();
          setToken(null);
          setAuthView('login');
        } else {
          console.warn("Retaining authenticated session despite network/server warning:", err.message);
        }
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [token]);

  const handleLogout = () => {
    removeAuthToken();
    setToken(null);
    setPatient(null);
    setDashboard(null);
    setAuthView('login');
    setCurrentView('dashboard');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  };

  // 1. If not authenticated and visiting activation route
  if (!token && authView === 'activate') {
    return (
      <Activate
        onActivated={() => {
          setAuthView('login');
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
        onBackToLogin={() => {
          setAuthView('login');
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
      />
    );
  }

  // 2. If not authenticated, show Login & Sign Up
  if (!token) {
    return (
      <Login
        onLoginSuccess={(pat) => {
          setToken(getAuthToken());
          setPatient(pat);
          setAuthView('login');
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
        onGoToActivate={() => {
          setAuthView('activate');
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/activate');
          }
        }}
      />
    );
  }

  if (loading && !patient) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h2>Loading Clinical Patient Portal...</h2>
      </div>
    );
  }

  return (
    <div className="portal-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">P</div>
          <div className="sidebar-logo-text">
            <h2>Patient Portal</h2>
            <p>Clinical Care & CDS</p>
          </div>
        </div>

        <ul className="nav-links">
          <li>
            <button
              className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              📊 My Dashboard
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${currentView === 'discharge' ? 'active' : ''}`}
              onClick={() => setCurrentView('discharge')}
            >
              🏥 Post-Discharge Care
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${currentView === 'assistant' ? 'active' : ''}`}
              onClick={() => setCurrentView('assistant')}
            >
              💬 Post-Discharge Chat
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${currentView === 'prescriptions' ? 'active' : ''}`}
              onClick={() => setCurrentView('prescriptions')}
            >
              💊 My Prescriptions
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentView('history')}
            >
              🩺 Medical History
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
              onClick={() => setCurrentView('profile')}
            >
              👤 My Profile
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="patient-badge">
            <div className="patient-avatar">
              {patient?.full_name ? patient.full_name.charAt(0) : 'P'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{patient?.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blood: {patient?.blood_group || '—'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {currentView === 'dashboard' && <Dashboard dashboard={dashboard} onNavigate={setCurrentView} />}
        {currentView === 'discharge' && <DischargeCare onNavigate={setCurrentView} />}
        {currentView === 'assistant' && <HealthAssistant />}
        {currentView === 'prescriptions' && <Prescriptions />}
        {currentView === 'history' && <MedicalHistory />}
        {currentView === 'profile' && <Profile />}
      </main>
    </div>
  );
}
