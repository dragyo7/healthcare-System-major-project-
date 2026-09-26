import React, { useState } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Pill, Search, ShieldAlert, ShieldCheck, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import ragApi from "../../api/ragApi";

export default function DrugChecker() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setEvidence([]);

    try {
      // Query real RAG backend for drug interactions / contraindications / warnings
      const res = await ragApi.queryRAG({
        query: `What are the drug interactions, boxed warnings, and contraindications for ${query}?`,
        mode: "hybrid",
        top_k: 4,
        source_filter: ["DailyMed"],
      });

      if (res.success && res.data) {
        const data = res.data;
        const isGrounded = data.grounding?.status === "grounded";
        const hasEvidence = data.evidence && data.evidence.length > 0;

        if (isGrounded && hasEvidence) {
          setResult({
            status: "Verified Clinical Record",
            severity: "info",
            summary: `Found ${data.evidence.length} authoritative monograph sections for "${query}".`,
          });
          setEvidence(data.evidence);
        } else if (data.grounding?.reason_codes?.includes("UNSUPPORTED_ENTITY")) {
          setResult({
            status: "Unsupported / Unverified Compound",
            severity: "warning",
            summary: `"${query}" was not identified in the authoritative FDA DailyMed monograph repository. Generation safely abstained.`,
          });
        } else {
          setResult({
            status: "General Inquiry Evaluated",
            severity: "info",
            summary: `Evaluated against active clinical repository (${data.total_evidence} matches).`,
          });
          setEvidence(data.evidence || []);
        }
      } else {
        setError(res.error || "Failed to query drug verification system.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl select-none animate-fadeIn">
      <PageHeader
        title="Drug Interaction & Safety Checker"
        subtitle="Verify clinical drug contraindications, interactions, and boxed warnings against official FDA DailyMed monographs."
      />

      <Card>
        <form onSubmit={handleCheck} className="flex flex-col gap-4">
          <Input
            id="drug-query"
            label="Search Medical Compounds or Interactions"
            placeholder="e.g. 'Metformin and contrast media' or 'Lisinopril pregnancy contraindication'"
            icon={Pill}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            disabled={isLoading}
          />
          <Button type="submit" isLoading={isLoading} className="mt-2 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Verifying against 2,204 Chunks...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Verify Clinical Safety Monograph
              </>
            )}
          </Button>
        </form>
      </Card>

      {error && (
        <Card className="border-l-4 border-l-red-500 bg-red-50/20 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-700 dark:text-red-400">Verification Error</h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <Card
          className={`border-l-4 ${
            result.severity === "warning"
              ? "border-l-amber-500 bg-amber-50/20"
              : result.severity === "high"
              ? "border-l-red-500 bg-red-50/20"
              : "border-l-emerald-500 bg-emerald-50/20"
          }`}
        >
          <div className="flex gap-3">
            {result.severity === "warning" ? (
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
            ) : (
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
            )}
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 dark:text-white">{result.status}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{result.summary}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Retrieved Evidence Monograph Sections */}
      {evidence.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Authoritative Monograph Evidence ({evidence.length}):
          </h3>
          {evidence.map((item, idx) => (
            <Card key={idx} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-xs text-primary-600 font-medium">› {item.section}</span>
                </div>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    FDA DailyMed <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                {item.text}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Chunk ID: {item.chunk_id}</span>
                <span>Publisher: {item.publisher}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
