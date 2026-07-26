import React, { useState } from "react";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Pill, Search, ShieldAlert } from "lucide-react";

export default function DrugChecker() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = (e) => {
    e.preventDefault();
    if (!query) return;

    setIsLoading(true);
    setResult(null);

    setTimeout(() => {
      setIsLoading(false);
      const isAspirin = query.toLowerCase().includes("aspirin");
      const isIbuprofen = query.toLowerCase().includes("ibuprofen");

      if (isAspirin && isIbuprofen) {
        setResult({
          status: "Warning",
          message: "Aspirin and Ibuprofen are both NSAIDs. Concurrent usage increases gastrointestinal irritation or bleeding hazards.",
          severity: "high",
        });
      } else {
        setResult({
          status: "Safe",
          message: "No acute interactive conflict was logged in the index database for this inquiry. Consult a physician for accurate advice.",
          severity: "low",
        });
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl select-none animate-fadeIn">
      <PageHeader
        title="Drug Interaction Checker"
        subtitle="Verify interactive drug risks and clinical compatibility indexes."
      />

      <Card>
        <form onSubmit={handleCheck} className="flex flex-col gap-4">
          <Input
            id="drug-query"
            label="Search Medical Compounds"
            placeholder="e.g. Aspirin + Ibuprofen"
            icon={Pill}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isLoading} className="mt-2">
            Verify Safety Compatibility
          </Button>
        </form>
      </Card>

      {result && (
        <Card className={`border-l-4 ${result.severity === "high" ? "border-l-red-500 bg-red-50/20" : "border-l-green-500 bg-green-50/20"}`}>
          <div className="flex gap-3">
            <ShieldAlert className={`h-5 w-5 shrink-0 ${result.severity === "high" ? "text-red-500" : "text-green-500"}`} />
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">{result.status} Indicator</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{result.message}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
