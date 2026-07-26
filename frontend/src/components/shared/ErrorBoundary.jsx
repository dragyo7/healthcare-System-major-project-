import React from "react";
import { AlertOctagon } from "lucide-react";
import Button from "../ui/Button";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-950 select-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 mb-6 border border-red-100 dark:border-red-900/30">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Application Error
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
            An unexpected client exception has occurred. You can attempt to refresh the application workspace.
          </p>
          <Button onClick={this.handleReset} className="mt-8">
            Reset Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
