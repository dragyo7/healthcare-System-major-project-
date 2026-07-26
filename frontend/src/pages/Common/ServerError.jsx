import React from "react";
import { ServerCrash, RefreshCw } from "lucide-react";
import Button from "../../components/ui/Button";

export default function ServerError() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 mb-6 border border-amber-100 dark:border-amber-900/30">
        <ServerCrash className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Server Error
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
        Our services are currently experiencing an unexpected interruption. We are working to resolve the issue as quickly as possible.
      </p>
      <Button onClick={handleRetry} className="flex items-center gap-2 mt-8">
        <RefreshCw className="h-5 w-5" />
        Retry Connection
      </Button>
    </div>
  );
}
