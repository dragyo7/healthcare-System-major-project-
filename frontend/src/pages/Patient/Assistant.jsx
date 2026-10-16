import React, { useState, useEffect } from "react";
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

  const sampleQueriesByLang = {
    en: [
      "What time should I take my Amlodipine blood pressure medicine?",
      "What are the warning signs where I should seek emergency care?",
      "Can I take painkillers like Ibuprofen with my blood pressure pills?",
      "What follow-up appointments and lab tests do I need?",
    ],
    hi: [
      "मेटफॉर्मिन के उपयोग और संकेत क्या हैं?",
      "सीने में तेज दर्द और सांस लेने में तकलीफ हो रही है",
      "क्या मैं एस्पिरिन और वारफारिन एक साथ ले सकता हूँ?",
      "मुझे अपने डिस्चार्ज निर्देशों के बारे में बताएं",
    ],
    mr: [
      "उच्च रक्तदाब साठी लिसिनोप्रिल 5 mg चा वापर काय आहे?",
      "माझ्या छातीत खूप तीव्र वेदना होत आहेत आणि मला श्वास घेता येत नाही",
      "मेटफॉर्मिनचे दुष्परिणाम काय आहेत?",
      "माझ्या डिस्चार्ज सूचना काय आहेत?",
    ],
    gu: [
      "મેટફોર્મિન 500mg ની આડઅસરો શું છે?",
      "મારી છાતીમાં ખૂબ તીવ્ર દુખાવો થઈ રહ્યો છે અને શ્વાસ લેવામાં તકલીફ છે",
      "હાઈ બ્લડ પ્રેશર માટે એમ્લોડિપિન દવા ક્યારે લેવી?",
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

    try {
      const response = await patientApi.evaluateCDS({
        clinicalQuery: textToSend,
        language,
      });

      const botMessage = {
        role: "bot",
        content: response.answer,
        status: response.verification_status,
        citations: response.citations || [],
        safety_alerts: response.safety_alerts || [],
        drug_interactions: response.drug_interactions || [],
        is_emergency: response.is_emergency,
        language: response.language || language,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: `Unable to evaluate post-discharge query safely: ${err.message}. If experiencing severe discomfort, seek urgent emergency care.`,
          status: "system_error",
          is_error: true,
        },
      ]);
    } finally {
      setEvaluating(false);
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

                  {/* Verification Status Badge */}
                  {!isUser && msg.status && msg.status !== "system_greeting" && (
                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                      {msg.status === "verified_grounded" || msg.status === "grounded" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Grounded in Clinical Guidelines
                        </span>
                      ) : msg.status === "conversational_greeting" || msg.status === "conversational_response" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold">
                          <Sparkles className="w-3.5 h-3.5" />
                          Care Assistant Connected
                        </span>
                      ) : msg.status === "emergency_intercept" || msg.status === "emergency_diverted" || msg.is_emergency ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-semibold">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          Emergency Intercept Escalation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Safety Policy Enforced: Answer Withheld ({msg.status})
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
                        {msg.drug_interactions.map((di, dIdx) => (
                          <div key={dIdx} className="text-foreground border-l-2 border-amber-500 pl-2">
                            <span className="font-semibold">{di.drug1} + {di.drug2}</span>
                            <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 uppercase">
                              {di.severity}
                            </span>
                            <p className="text-muted-foreground mt-0.5">{di.description || di.effect}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DailyMed Citations */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        FDA DailyMed Evidence Citations ({msg.citations.length})
                      </p>
                      <div className="space-y-1">
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded bg-background border border-border/80 text-[11px] text-muted-foreground"
                          >
                            <strong className="text-foreground">{c.source || "DailyMed Label"}:</strong>{" "}
                            {c.text || c.snippet || JSON.stringify(c)}
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
