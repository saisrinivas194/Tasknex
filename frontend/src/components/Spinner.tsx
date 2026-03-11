"use client";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-primary ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
