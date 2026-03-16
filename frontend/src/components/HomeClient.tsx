"use client";

import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/Spinner";
import Link from "next/link";

export function HomeClient({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-navy">
        <Spinner className="h-8 w-8 border-t-primary" />
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex flex-col bg-navy">
        <header className="border-b border-slate-700/80 px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-muted text-sm truncate max-w-[180px]" title={user.email}>
              {user.email}
            </span>
            <button onClick={logout} className="btn-secondary text-sm shrink-0">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Link href="/dashboard" className="btn-primary text-lg px-8 py-3 rounded-lg">
            Open Dashboard
          </Link>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
