"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Spinner } from "@/components/Spinner";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        </div>
      </main>
    </div>
  );
}
