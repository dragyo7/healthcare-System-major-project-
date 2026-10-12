import React, { useState } from 'react';
import { patientApi, setAuthToken } from '../api';

export default function Login({ onLoginSuccess, onGoToActivate }) {
  const [selectedRole, setSelectedRole] = useState('patient');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  
  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Sign Up state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('1995-05-15');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    setError('');
    if (newRole === 'doctor') {
      window.location.href = 'http://localhost:5173';
    } else if (newRole === 'receptionist') {
      window.location.href = 'http://localhost:5174';
    }
  };

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const data = await patientApi.login(email.trim(), password);
      setAuthToken(data.token);
      onLoginSuccess(data.patient);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!fullName || !signupEmail || !signupPassword) {
      setError('Please fill in your name, email, and password.');
      setLoading(false);
      return;
    }

    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const data = await patientApi.signup({
        full_name: fullName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        phone: signupPhone.trim() || '9876543210',
        date_of_birth: dob || '1995-05-15',
        gender: gender || 'Male',
        blood_group: bloodGroup || 'O+'
      });

      setAuthToken(data.token);
      setSuccessMsg('Registration successful! Launching your health portal...');
      setTimeout(() => {
        onLoginSuccess(data.patient);
      }, 500);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: mode === 'signup' ? '480px' : '440px' }}>
        {/* Role Selection Tabs */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', fontWeight: 600,
            color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            Select Portal Role
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px',
            background: 'var(--surface-alt, #f1f5f9)', padding: '4px', borderRadius: '10px'
          }}>
            <button
              type="button"
              onClick={() => handleRoleChange('doctor')}
              style={{
                padding: '8px 4px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: selectedRole === 'doctor' ? 'var(--primary, #0284c7)' : 'transparent',
                color: selectedRole === 'doctor' ? '#fff' : 'var(--text-secondary, #64748b)'
              }}
            >
              👨‍⚕️ Doctor
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('patient')}
              style={{
                padding: '8px 4px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: selectedRole === 'patient' ? 'var(--primary, #0284c7)' : 'transparent',
                color: selectedRole === 'patient' ? '#fff' : 'var(--text-secondary, #64748b)'
              }}
            >
              🏥 Patient
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('receptionist')}
              style={{
                padding: '8px 4px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '8px',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                background: selectedRole === 'receptionist' ? 'var(--primary, #0284c7)' : 'transparent',
                color: selectedRole === 'receptionist' ? '#fff' : 'var(--text-secondary, #64748b)'
              }}
            >
              📋 Receptionist
            </button>
          </div>
        </div>

        {/* Portal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '44px', height: '44px', background: 'var(--primary, #0284c7)',
            borderRadius: '12px', color: 'white', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.3rem',
            marginBottom: '0.4rem'
          }}>P</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {mode === 'signin' ? 'Patient Portal Sign In' : 'New Patient Registration'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Clinical Follow-up & Post-Discharge Care Portal
          </p>
        </div>

        {/* Auth Mode Toggle Tabs (Sign In vs Sign Up) */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border, #e2e8f0)', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); }}
            style={{
              flex: 1, padding: '0.6rem', border: 'none', background: 'none',
              fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              color: mode === 'signin' ? 'var(--primary, #0284c7)' : 'var(--text-secondary, #64748b)',
              borderBottom: mode === 'signin' ? '2px solid var(--primary, #0284c7)' : 'none',
              marginBottom: '-2px'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            style={{
              flex: 1, padding: '0.6rem', border: 'none', background: 'none',
              fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              color: mode === 'signup' ? 'var(--primary, #0284c7)' : 'var(--text-secondary, #64748b)',
              borderBottom: mode === 'signup' ? '2px solid var(--primary, #0284c7)' : 'none',
              marginBottom: '-2px'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light, #fee2e2)', color: 'var(--danger, #dc2626)',
            border: '1px solid #fca5a5', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem',
            fontSize: '0.82rem', fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#ecfdf5', color: '#065f46',
            border: '1px solid #a7f3d0', padding: '0.65rem', borderRadius: '8px', marginBottom: '1rem',
            fontSize: '0.82rem', fontWeight: 500
          }}>
            ✓ {successMsg}
          </div>
        )}

        {mode === 'signin' ? (
          /* ================= SIGN IN FORM ================= */
          <form onSubmit={handleSignInSubmit}>
            <div className="form-group" style={{ marginBottom: '0.9rem' }}>
              <label htmlFor="patient-email" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Registered Email</label>
              <input
                id="patient-email"
                type="email"
                className="form-input"
                placeholder="e.g. aarav@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="patient-password" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Password</label>
              <input
                id="patient-password"
                type="password"
                className="form-input"
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="btn-patient-submit"
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In as Patient'}
            </button>

            {/* Account Activation Link */}
            <div style={{ marginTop: '1.25rem', textAlign: 'center', padding: '0.65rem', background: 'rgba(2, 132, 199, 0.05)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                New patient registered by hospital staff?
              </p>
              <button
                type="button"
                onClick={onGoToActivate}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary, #0284c7)',
                  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline'
                }}
              >
                Activate account with staff token →
              </button>
            </div>
          </form>
        ) : (
          /* ================= SIGN UP FORM ================= */
          <form onSubmit={handleSignUpSubmit}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="signup-name" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-email" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
                <input
                  id="signup-email"
                  type="email"
                  className="form-input"
                  placeholder="rahul@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-phone" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone Number</label>
                <input
                  id="signup-phone"
                  type="tel"
                  className="form-input"
                  placeholder="9876543210 (optional)"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-dob" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Date of Birth</label>
                <input
                  id="signup-dob"
                  type="date"
                  className="form-input"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-gender" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Gender</label>
                <select
                  id="signup-gender"
                  className="form-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-blood" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Blood Group</label>
                <select
                  id="signup-blood"
                  className="form-input"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-password" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Password (min 8)</label>
                <input
                  id="signup-password"
                  type="password"
                  className="form-input"
                  placeholder="Min 8 chars"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="signup-confirm-password" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Confirm</label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Re-enter"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              id="btn-signup-submit"
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register & Access Health Portal'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
          Strict BOLA Enforced • Zero PII to LLM • Role-Verified Access
        </div>
      </div>
    </div>
  );
}
