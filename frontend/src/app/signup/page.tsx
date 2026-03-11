"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";

const MIN_PASSWORD_LENGTH = 8;

function getFriendlyError(message: string): string {
  if (message.includes("already registered") || message.includes("already exists"))
    return "This email is already registered. Try logging in or use a different email.";
  if (message.includes("at least 8"))
    return "Password must be at least 8 characters.";
  return message || "Something went wrong. Please try again.";
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    passwordsMatch &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(getFriendlyError(err instanceof Error ? err.message : "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-navy">
      <Logo href="/" className="mb-6" />
      <div className="card w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-muted text-sm mt-1">
            Sign up to start turning your goals into workflows with AI.
          </p>
        </div>

        <p className="text-muted text-sm mb-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-muted mb-1">
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
              disabled={loading}
            />
            <p className="text-muted text-xs mt-1">
              We&apos;ll use this for your account and to keep your workflows secure.
            </p>
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-muted mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="At least 8 characters"
              required
              minLength={MIN_PASSWORD_LENGTH}
              disabled={loading}
            />
            <p className="text-muted text-xs mt-1">
              Use at least 8 characters. A mix of letters and numbers is more secure.
            </p>
            {password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
              <p className="text-amber-400 text-xs mt-0.5">
                {MIN_PASSWORD_LENGTH - password.length} more character
                {MIN_PASSWORD_LENGTH - password.length !== 1 ? "s" : ""} needed.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="signup-confirm"
              className="block text-sm font-medium text-muted mb-1"
            >
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password again"
              required
              disabled={loading}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-amber-400 text-xs mt-0.5">Passwords do not match.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating your account…" : "Create account"}
          </button>
        </form>

        <p className="text-muted text-xs mt-6 text-center">
          By creating an account, you can save and manage your workflows. We don&apos;t share your
          email with third parties.
        </p>
      </div>
    </div>
  );
}
