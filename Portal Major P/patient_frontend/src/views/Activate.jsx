import React, { useState } from 'react';

const API_BASE_URL = "http://localhost:5000";

export default function Activate({ onActivated, onBackToLogin }) {
  const urlParams = new URLSearchParams(window.location.search);
  const initialToken = urlParams.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Activation token is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/patient/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Account activation failed.");
      }

      setSuccess(true);
      // Clean query params from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err.message || "Failed to activate account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '48px', height: '48px', background: 'var(--primary)',
            borderRadius: '12px', color: 'white', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem',
            marginBottom: '0.75rem'
          }}>✓</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Set Your Account Password</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Complete your patient account setup to access clinical follow-up
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-light)', color: 'var(--danger)',
            padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem',
            fontSize: '0.85rem', fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
              fontSize: '0.9rem', fontWeight: 500
            }}>
              🎉 Account activated successfully! You may now sign in with your new password.
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem' }}
              onClick={() => {
                if (onActivated) {
                  onActivated();
                } else {
                  window.location.href = "/";
                }
              }}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!initialToken && (
              <div className="form-group">
                <label>Activation Token</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste your 64-character activation token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Create New Password (min. 8 characters)</label>
              <input
                id="activate-password"
                type="password"
                className="form-input"
                placeholder="Enter a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                id="activate-confirm-password"
                type="password"
                className="form-input"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              id="btn-activate-submit"
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Activating Account...' : 'Set Password & Activate'}
            </button>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState({}, document.title, "/");
                  if (onBackToLogin) onBackToLogin();
                  else if (onActivated) onActivated();
                  else window.location.href = "/";
                }}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary)',
                  cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Single-Use Cryptographic Token • Hashed Storage • Zero Universal Passwords
        </div>
      </div>
    </div>
  );
}
