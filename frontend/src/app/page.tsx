"use client";

import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/Spinner";
import Link from "next/link";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-navy">
        <Spinner className="h-8 w-8 border-t-primary" />
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 bg-navy">
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo />
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight sm:text-2xl">
              Turn goals into executable workflows
            </h1>
            <p className="text-muted text-sm mt-2 max-w-md">
              Plan with AI. Track progress on a Kanban board. Get from idea to done.
            </p>
          </div>
        </div>
        <p className="text-muted text-sm max-w-sm text-center">
          Sign in or create an account to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:min-w-[240px]">
          <Link href="/login" className="btn-primary text-center py-2.5">
            Sign in
          </Link>
          <Link href="/signup" className="btn-secondary text-center py-2.5">
            Create account
          </Link>
        </div>
      </div>
    );
  }

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
