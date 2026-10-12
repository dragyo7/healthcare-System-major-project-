import React, { useState } from 'react';
import { patientApi } from '../api';

export default function HealthAssistant() {
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: 'Hello. I am your Clinical Care Assistant. You can ask me questions about your post-discharge instructions, medications, follow-up plan, or health warnings. How can I help you today?'
    }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const sampleQueriesByLang = {
    en: [
      "What time should I take my Amlodipine blood pressure medicine?",
      "What are the warning signs where I should seek emergency care?",
      "Can I take painkillers like Ibuprofen with my blood pressure pills?"
    ],
    hi: [
      "मेटफॉर्मिन के उपयोग और संकेत क्या हैं?",
      "सीने में तेज दर्द और सांस लेने में तकलीफ हो रही है",
      "क्या मैं एस्पिरिन और वारफारिन एक साथ ले सकता हूँ?"
    ],
    mr: [
      "उच्च रक्तदाब साठी लिसिनोप्रिल 5 mg चा वापर काय आहे?",
      "माझ्या छातीत खूप तीव्र वेदना होत आहेत आणि मला श्वास घेता येत नाही",
      "मेटफॉर्मिनचे दुष्परिणाम काय आहेत?"
    ],
    gu: [
      "મેટફોર્મિન 500mg ની આડઅસરો શું છે?",
      "મારી છાતીમાં ખૂબ તીવ્ર દુખાવો થઈ રહ્યો છે અને શ્વાસ લેવામાં તકલીફ છે",
      "હાઈ બ્લડ પ્રેશર માટે એમ્લોડિપિન દવા ક્યારે લેવી?"
    ]
  };

  const sampleQueries = sampleQueriesByLang[language] || sampleQueriesByLang.en;

  const handleSend = async (userQuery) => {
    const textToSend = userQuery || query;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const data = await patientApi.evaluateCDS(textToSend, language);
      
      const botMsg = {
        role: 'bot',
        content: data.answer,
        status: data.verification_status,
        citations: data.citations || [],
        alerts: data.safety_alerts || [],
        drug_interactions: data.drug_interactions || [],
        is_emergency: data.is_emergency,
        language: data.language
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          content: `Unable to evaluate health query: ${err.message}. Please consult your physician or emergency care.`,
          is_error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="header-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Post-Discharge Care Assistant</h1>
          <p>Evidence-grounded medical guidance restricted to your authorized discharge context.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Language:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="en">English (en)</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
          </select>
        </div>
      </div>

      <div className="emergency-banner" style={{ marginBottom: '1rem' }}>
        <span>ℹ️</span>
        <div>
          <strong>Safety Policy Notice:</strong>
          <p>
            Your query is evaluated with your personal EHR history & discharge instructions without transmitting any PII.
            Deterministic DrugBank safety checks and fail-closed grounding verification are strictly enforced.
          </p>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {sampleQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={loading}
            style={{
              background: '#f1f5f9',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            💬 {q}
          </button>
        ))}
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-bubble ${m.role}`}>
              <div>{m.content}</div>

              {m.is_emergency && (
                <div style={{ marginTop: '0.5rem', background: '#fee2e2', color: '#991b1b', padding: '0.5rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                  🚨 Acute emergency symptom detected. Please seek emergency medical care immediately!
                </div>
              )}

              {m.drug_interactions && m.drug_interactions.length > 0 && (
                <div style={{ marginTop: '0.75rem', background: '#fef3c7', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#b45309' }}>⚠️ Interaction Alert Detected:</strong>
                  {m.drug_interactions.map((d, i) => (
                    <div key={i} style={{ marginTop: '0.25rem', color: '#78350f' }}>
                      • {d.drug_pair.join(' + ')}: {d.explanation}
                    </div>
                  ))}
                </div>
              )}

              {m.status && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <span className={`badge ${m.status === 'grounded' ? 'badge-success' : 'badge-primary'}`}>
                    Verification: {m.status}
                  </span>
                  {m.citations && m.citations.length > 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      📚 {m.citations.length} Verified Evidence Citations
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-bubble bot" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Consulting clinical knowledge base & discharge guidelines...
            </div>
          )}
        </div>

        <div className="chat-input-bar">
          <input
            type="text"
            className="chat-input"
            placeholder="Type your question regarding discharge instructions or medications..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button className="btn-primary" onClick={() => handleSend()} disabled={loading || !query.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
