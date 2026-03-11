"use client";

import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 bg-navy">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <p className="text-muted text-center max-w-sm text-lg">
            Turn goals into executable workflows with AI
          </p>
        </div>
        <p className="text-muted text-center max-w-md text-sm">
          Sign in or create an account to start planning and executing with AI.
        </p>
        <div className="flex gap-4">
          <Link href="/login" className="btn-primary">
            Log in
          </Link>
          <Link href="/signup" className="btn-secondary">
            Sign up
          </Link>
        </div>
        <ThemeToggle />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <header className="border-b border-slate-700/80 px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-muted text-sm">{user.email}</span>
          <button onClick={logout} className="btn-secondary text-sm">
            Log out
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <Link href="/dashboard" className="btn-primary text-lg px-6 py-3">
          Go to Dashboard
        </Link>
      </main>
    </div>
  );
}
