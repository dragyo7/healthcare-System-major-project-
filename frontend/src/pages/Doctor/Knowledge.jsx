import React from "react";
import { Link } from "react-router-dom";
import { Database, Sparkles, BookOpen, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";

export default function Knowledge() {
  const KNOWLEDGE_STATS = [
    { source: "DailyMed (FDA SPL)", chunks: "2,176 Chunks", coverage: "98.7% Coverage", status: "Active & Indexed" },
    { source: "ICMR Clinical Guidelines", chunks: "8 Chunks", coverage: "Standard Indian Guidelines", status: "Active & Indexed" },
    { source: "MedlinePlus Health Topics", chunks: "16 Chunks", coverage: "Patient Education", status: "Active & Indexed" },
    { source: "MoHFW Guidelines", chunks: "4 Chunks", coverage: "Primary Care Protocol", status: "Active & Indexed" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto select-none animate-fadeIn pb-12">
      <PageHeader
        title="Medical Knowledge Repository"
        subtitle="Authoritative pharmacotherapy monographs and clinical practice guidelines indexed in FAISS and BM25."
      />

      {/* Hero Banner with Assistant Callout */}
      <Card className="p-6 bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-950 text-white border-0 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold backdrop-blur-xs w-fit">
            <Database className="h-3.5 w-3.5" />
            <span>2,204 Verified Clinical Monographs • Active Index</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">DailyMed & Evidence Knowledge Base</h2>
          <p className="text-sm text-primary-100/90 leading-relaxed">
            The active clinical knowledge base is indexed into FAISS (384D BAAI/bge-small-en) and BM25 with reciprocal rank fusion. Query and cross-reference monographs directly using the AI Clinical Assistant.
          </p>
          <div className="pt-2">
            <Link to={ROUTES.DOCTOR_CDS}>
              <Button className="bg-white text-primary-950 hover:bg-primary-50 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm shadow-md">
                <Sparkles className="h-4 w-4 text-primary-600" />
                Launch CDS AI Assistant
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Corpus Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {KNOWLEDGE_STATS.map((stat, idx) => (
          <Card key={idx} className="p-5 flex flex-col justify-between border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Source Registry</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">{stat.source}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{stat.coverage}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                {stat.status}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Vectorized Chunks</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{stat.chunks}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Integration Note */}
      <Card className="p-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-slate-400" />
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Raw Monograph Browser</h4>
            <p className="text-xs text-slate-500">Full structured manual browser scheduled for Phase 2 CDS platform integration.</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-3 py-1 rounded-md">
          Phase 2 Integration
        </span>
      </Card>
    </div>
  );
}
