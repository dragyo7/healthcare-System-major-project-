import React, { useState, useEffect, useRef } from "react";
import { patientApi } from "../../api/patientApi";
import {
  Bot,
  User,
  Send,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  Globe,
  Sparkles,
  Info,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PatientAssistant() {
  const { language: globalLanguage, setLanguage: setGlobalLanguage } = useLanguage();
  const [language, setLanguage] = useState(globalLanguage || "en");

  useEffect(() => {
    if (globalLanguage) {
      setLanguage(globalLanguage);
    }
  }, [globalLanguage]);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      content:
        "Hello. I am your Post-Discharge Care Assistant. You can ask me questions about your discharge instructions, prescribed medications, follow-up schedule, or recovery warning signs. How can I help you today?",
      status: "system_greeting",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [careContext, setCareContext] = useState({ discharge: null, medications: [] });
  const activeRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    Promise.allSettled([patientApi.getDischarge(), patientApi.getMedications()]).then((results) => {
      if (cancelled) return;
      setCareContext({
        discharge: results[0].status === "fulfilled" ? results[0].value : null,
        medications: results[1].status === "fulfilled" ? results[1].value : [],
      });
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      activeRequestRef.current += 1;
    };
  }, []);

  const firstMedication = careContext.medications.find(
    (medication) => medication?.medicine_name || medication?.name,
  );
  const firstMedicationName = firstMedication?.medicine_name || firstMedication?.name;
  const hasDischargePlan = Boolean(careContext.discharge);

  const sampleQueriesByLang = {
    en: [
      hasDischargePlan
        ? "What care should I take?"
        : "Do I have a discharge plan on record?",
      firstMedicationName
        ? `What does my saved care record say about taking ${firstMedicationName}?`
        : "Are medication instructions documented in my discharge plan?",
      "What are the warning signs where I should seek emergency care?",
      "What follow-up appointments and lab tests do I need?",
    ],
    hi: [
      "मुझे अपने डिस्चार्ज निर्देशों के बारे में बताएं",
      "मेरी डिस्चार्ज योजना में दवा के कौन से निर्देश दर्ज हैं?",
      "रिकवरी के दौरान किन चेतावनी संकेतों पर ध्यान देना चाहिए?",
      "मेरी अगली फॉलो-अप योजना क्या है?",
    ],
    mr: [
      "माझ्या डिस्चार्ज सूचना काय आहेत?",
      "माझ्या नोंदीत औषध घेण्याच्या कोणत्या सूचना आहेत?",
      "रिकव्हरीदरम्यान कोणती चेतावणी चिन्हे पाहावीत?",
      "माझी फॉलो-अप योजना काय आहे?",
    ],
    gu: [
      "મારી ડિસ્ચાર્જ સૂચનાઓ શું છે?",
      "મારા રેકોર્ડમાં દવા લેવાની કઈ સૂચનાઓ છે?",
      "રિકવરી દરમિયાન કયા ચેતવણી ચિહ્નો જોવાં જોઈએ?",
      "મારી ફોલો-અપ યોજના શું છે?",
    ],
  };

  const sampleQueries = sampleQueriesByLang[language] || sampleQueriesByLang.en;

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || evaluating) return;

    const userMessage = {
      role: "user",
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery("");
    setEvaluating(true);
    const requestId = ++activeRequestRef.current;
    try {
      const conversationHistory = messages
        .filter((m) => m.content && (m.role === "user" || m.role === "bot") && !m.is_technical_error && !m.is_network_error && !m.status?.includes("transport") && !m.status?.includes("timeout") && m.status !== "technical_error")
        .slice(-6)
        .map((m) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.content,
        }));

      const response = await patientApi.evaluateCDS({
        clinicalQuery: textToSend,
        language,
        conversationHistory,
      });

      if (!mountedRef.current || requestId !== activeRequestRef.current) return;

      const withheld = response.abstained || [
        "abstained_policy",
        "withheld_verification_failure",
        "technical_failure",
        "validation_error",
      ].includes(response.verification_status);
      const isSavedDischargeResponse = response.pipeline_mode === "discharge_care_grounding";
      const patientFacingAnswer = withheld && !isSavedDischargeResponse
        ? "I could not verify an answer from your saved care plan and approved evidence. I will not substitute general advice for missing personal instructions. Please ask about a specific documented medicine, warning sign, or follow-up item, or contact your treating care team."
        : response.answer;

      const botMessage = {
        role: "bot",
        content: patientFacingAnswer,
        status: response.verification_status,
        citations: response.citations || [],
        safety_alerts: response.safety_alerts || [],
        drug_interactions: response.drug_interactions || [],
        is_emergency: response.is_emergency,
        language: response.language || language,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      if (!mountedRef.current || requestId !== activeRequestRef.current) return;
      const isNet = err.isNetworkError || err.status === 0 || (typeof err.message === "string" && (err.message.includes("fetch") || err.message.includes("Failed") || err.message.includes("unreachable")));
      const isTimeout = err.isTimeout || err.status === 504;
      const isAuth = err.isAuthError || err.status === 401 || err.status === 403;

      let userMsg = "Technical communication error: Unable to contact the clinical gateway.";
      let errStatus = "transport_error";

      if (isNet) {
        userMsg = "Connection to the hospital EHR gateway failed (service offline or ports unreachable). Please verify the backend service is running.";
        errStatus = "transport_offline";
      } else if (isTimeout) {
        userMsg = "The clinical reasoning engine request timed out (>60s). Please retry your question.";
        errStatus = "gateway_timeout";
      } else if (isAuth) {
        userMsg = "Your clinical session has expired. Please sign in again to review post-discharge care instructions.";
        errStatus = "authentication_required";
      } else if (err.message) {
        userMsg = `Technical gateway error: ${err.message}.`;
        errStatus = "technical_error";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: `${userMsg} (If you are experiencing acute physical distress, please seek immediate emergency care.)`,
          status: errStatus,
          is_technical_error: true,
          failed_query: textToSend,
        },
      ]);
    } finally {
      if (mountedRef.current && requestId === activeRequestRef.current) {
        setEvaluating(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Post-Discharge Care Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence-grounded medical guidance restricted strictly to your authorized discharge context and approved clinical guidelines.
          </p>
        </div>

        {/* Language Selection */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-sm">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={evaluating}
            className="text-xs font-bold text-foreground bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="en">English (en)</option>
            <option value="hi">हिंदी (hi)</option>
            <option value="mr">मराठी (mr)</option>
            <option value="gu">ગુજરાતી (gu)</option>
          </select>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Suggested queries for your post-discharge recovery:
        </p>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sq)}
              disabled={evaluating}
              className="text-xs px-3 py-1.5 rounded-full bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/30 text-foreground transition text-left"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Frame */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm min-h-[460px] flex flex-col justify-between space-y-4">
        <div className="space-y-4 overflow-y-auto max-h-[520px] pr-2">
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-1 border border-primary/20">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-sm"
                      : "bg-muted/50 border border-border/80 text-foreground rounded-tl-none shadow-sm space-y-3"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {(msg.is_network_error || msg.is_technical_error || msg.failed_query) && msg.failed_query && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleSend(msg.failed_query)}
                        disabled={evaluating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Retry Question ↺
                      </button>
                    </div>
                  )}

                  {/* Verification Status Badge */}
                  {!isUser && msg.status && msg.status !== "system_greeting" && (
                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                      {msg.status === "verified_grounded" || msg.status === "grounded" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Grounded in Authorized Hospital Care Directives
                        </span>
                      ) : msg.status === "educational_guidance" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold">
                          <BookOpen className="w-3.5 h-3.5" />
                          Educational Guidance (General Pharmacology)
                        </span>
                      ) : msg.status === "conversational_greeting" || msg.status === "conversational_response" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 font-semibold">
                          <Sparkles className="w-3.5 h-3.5" />
                          Care Assistant Connected
                        </span>
                      ) : msg.status === "emergency_intercept" || msg.status === "emergency_diverted" || msg.is_emergency ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-semibold">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          Emergency Intercept Escalation
                        </span>
                      ) : msg.is_technical_error || msg.status?.includes("transport") || msg.status?.includes("timeout") || msg.status === "technical_error" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Service Unavailable ({msg.status})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Unable to verify from your saved plan and approved evidence
                        </span>
                      )}
                    </div>
                  )}

                  {/* Emergency Alert Box */}
                  {!isUser && msg.is_emergency && (
                    <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-rose-600" />
                        Urgent Medical Assistance Required
                      </p>
                      <p>
                        Your query indicates potential acute emergency symptoms. Please dial <strong>108 / 112</strong> or go to your nearest emergency department immediately.
                      </p>
                    </div>
                  )}

                  {/* Drug Interactions */}
                  {!isUser && msg.drug_interactions && msg.drug_interactions.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                      <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Medication Safety Alerts ({msg.drug_interactions.length})
                      </p>
                      <div className="space-y-1.5">
                        {msg.drug_interactions.map((di, dIdx) => {
                          const pairLabel = Array.isArray(di.drug_pair)
                            ? di.drug_pair.join(" + ")
                            : (di.drug1 && di.drug2 ? `${di.drug1} + ${di.drug2}` : (di.drug_pair || "Medication Alert"));
                          return (
                            <div key={dIdx} className="text-foreground border-l-2 border-amber-500 pl-2">
                              <span className="font-semibold">{pairLabel}</span>
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 uppercase">
                                {di.severity}
                              </span>
                              <p className="text-muted-foreground mt-0.5">{di.description || di.effect || di.clinical_consequence}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Evidence Citations & Clinical Sources */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        Evidence Citations & Sources ({msg.citations.length})
                      </p>
                      <div className="space-y-1">
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded bg-background border border-border/80 text-[11px] text-muted-foreground"
                          >
                            <div className="font-semibold text-foreground">
                              {c.url ? (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-medium"
                                >
                                  {c.title || c.source_name || c.source || `Evidence Source #${cIdx + 1}`}
                                </a>
                              ) : (
                                <span>{c.title || c.source_name || c.source || `Evidence Source #${cIdx + 1}`}</span>
                              )}
                            </div>
                            {c.publisher && <div className="text-[10px] text-muted-foreground/80">{c.publisher}</div>}
                            {c.text && <p className="mt-0.5 italic text-slate-600 dark:text-slate-300">"{c.text}"</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 mt-1 border border-border">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {evaluating && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/80 text-foreground text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Evaluating query against discharge directives and DailyMed guidelines...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 pt-2 border-t border-border"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={evaluating}
            placeholder={`Ask a question regarding your post-discharge care (${language})...`}
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <button
            type="submit"
            disabled={evaluating || !inputQuery.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
