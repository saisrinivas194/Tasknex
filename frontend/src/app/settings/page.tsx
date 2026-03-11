"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Spinner } from "@/components/Spinner";
import { api, type Session } from "@/lib/api";

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      setDisplayName(user.display_name ?? "");
      setBio(user.bio ?? "");
    }
  }, [user, authLoading, router]);

  const loadSessions = () => {
    if (!user) return;
    setSessionsLoading(true);
    api.auth.sessions
      .list()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await api.auth.updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      await refreshUser();
      setMessage({ type: "success", text: "Profile updated." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/");
    router.refresh();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-navy">
        <Spinner className="h-8 w-8" />
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-h-0 p-8 overflow-auto">
        <div className="max-w-xl mx-auto">
          <h1 className="text-xl font-semibold text-white tracking-tight mb-1">
            Profile settings
          </h1>
          <p className="text-muted text-sm mb-6">
            Update your name and details. Your email is used to sign in and cannot be changed here.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {message && (
              <div
                className={`rounded px-4 py-2 text-sm ${
                  message.type === "success"
                    ? "bg-success/20 text-green-300 border border-success/40"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}
              >
                {message.text}
              </div>
            )}

            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-slate-300 mb-1">
                Display name
              </label>
              <input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder="e.g. Alex Smith"
                maxLength={255}
                disabled={saving}
              />
              <p className="text-muted text-xs mt-1">
                Shown in the sidebar and across the app when set.
              </p>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-slate-300 mb-1">
                Bio / details
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="input-field min-h-[100px] resize-y"
                placeholder="A short bio or description (optional)"
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save changes"}
              </button>
              <span className="text-muted text-sm">Email: {user.email}</span>
            </div>
          </form>

          <section className="mt-12 pt-8 border-t border-[#253858]">
            <h2 className="text-lg font-semibold text-white tracking-tight mb-1">
              Sessions
            </h2>
            <p className="text-muted text-sm mb-4">
              You can be logged in on multiple devices at once. Revoke a session to sign that device out.
            </p>
            {sessionsLoading ? (
              <div className="flex items-center gap-2 text-muted text-sm py-4">
                <Spinner className="h-4 w-4" /> Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-muted text-sm">No sessions.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 py-3 px-4 rounded-lg bg-[#253858]/50 border border-[#253858]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {s.label || "Session"} {s.current && <span className="badge bg-primary/20 text-primary-200 text-[10px] ml-2">Current</span>}
                      </p>
                      <p className="text-muted text-xs mt-0.5">
                        Created {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!s.current && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokingId(s.id);
                          api.auth.sessions
                            .revoke(s.id)
                            .then(loadSessions)
                            .catch((err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to revoke" }))
                            .finally(() => setRevokingId(null));
                        }}
                        disabled={revokingId === s.id}
                        className="text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
                      >
                        {revokingId === s.id ? "…" : "Revoke"}
                      </button>
                    )}
                  </div>
                ))}
                {sessions.some((s) => !s.current) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevokingOthers(true);
                      api.auth.sessions
                        .revokeOthers()
                        .then(loadSessions)
                        .then(() => setMessage({ type: "success", text: "All other sessions revoked." }))
                        .catch((err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" }))
                        .finally(() => setRevokingOthers(false));
                    }}
                    disabled={revokingOthers}
                    className="btn-secondary text-sm mt-2"
                  >
                    {revokingOthers ? "…" : "Revoke all other sessions"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
