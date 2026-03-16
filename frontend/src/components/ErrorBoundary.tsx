"use client";

import React from "react";
import { reportClientError } from "@/lib/api";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render errors and window unhandled errors/rejections,
 * reports them to the backend log tracker, and shows a fallback UI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        message: event.message,
        stack: event.error?.stack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message ?? String(event.reason);
      const stack = event.reason?.stack;
      reportClientError({ message, stack, url: window?.location?.href });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    this._cleanup = () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }

  private _cleanup?: () => void;

  componentWillUnmount() {
    this._cleanup?.();
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportClientError({
      message: error.message,
      stack: error.stack ?? errorInfo.componentStack,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6 bg-base-200 rounded-lg">
          <div className="text-center max-w-md">
            <p className="font-semibold text-error">Something went wrong</p>
            <p className="text-sm text-base-content/70 mt-1">{this.state.error.message}</p>
            <p className="text-xs text-base-content/50 mt-2">
              This error has been reported. Refresh the page to try again.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
