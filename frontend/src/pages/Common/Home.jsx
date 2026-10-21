import React from "react";
import { Link } from "react-router-dom";
import { Activity, ShieldCheck, Cpu, Smartphone, Sparkles, BookOpen, Layers } from "lucide-react";
import { motion } from "framer-motion";
import Button from "../../components/ui/Button";
import Card from "../../components/shared/Card";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/50 flex items-center justify-between px-4 lg:px-8 select-none shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
            MedAI <span className="text-xs font-normal text-primary-600 font-mono">CDS-RAG</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/cds">
            <Button size="sm" className="flex items-center gap-1.5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Launch CDS Assistant
            </Button>
          </Link>
          <Link to="/about">
            <Button variant="ghost" size="sm">
              About & Ethics
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Landing Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-5xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-6">
            <ShieldCheck className="h-4 w-4" /> Evidence-Grounded Healthcare RAG Architecture
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-3xl leading-tight">
            Healthcare Clinical Decision Support & Diagnostics
          </h1>

          <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 mt-4 max-w-2xl leading-relaxed">
            Powered by a verified 2,204-chunk multi-source clinical corpus (FDA DailyMed, MedlinePlus, ICMR, and MoHFW) with hybrid FAISS dense retrieval, BM25 lexical matching, reciprocal rank fusion, and deterministic clinical safety policies.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8 w-full">
            <Link to="/cds" className="w-full sm:w-auto">
              <Button className="w-full sm:w-56 h-12 text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-primary-500/20">
                <Sparkles className="h-4 w-4" /> Open CDS Assistant
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-48 h-12 text-sm font-semibold">
                Clinician / Patient Portal
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full text-left">
          <Card className="flex flex-col gap-3 p-5">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Authoritative Evidence</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Grounds answers directly in FDA monographs and ICMR standard treatment workflows with full provenance citations.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Deterministic Safety Guardrails</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Intercepts emergency crises with national emergency helplines (112 / 108 / 102) and abstains safely on unsupported entities.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Hybrid Retrieval & RRF</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Combines 384-dimensional dense BGE-small embeddings with BM25Okapi lexical matching and Cross-Encoder reranking.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
