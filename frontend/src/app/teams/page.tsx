"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Spinner } from "@/components/Spinner";
import { api, Team, TeamWithMembers } from "@/lib/api";

export default function TeamsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  const loadTeams = () => {
    if (!user) return;
    api.teams
      .list()
      .then(setTeams)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;
    loadTeams();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!selectedTeam) return;
    api.teams
      .get(selectedTeam.id)
      .then(setSelectedTeam)
      .catch((e) => setError(e.message));
  }, [selectedTeam?.id]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    api.teams
      .create(name)
      .then((t) => {
        setCreateName("");
        loadTeams();
        setSelectedTeam({ ...t, members: [] });
      })
      .catch((e) => setError(e.message))
      .finally(() => setCreating(false));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !addEmail.trim()) return;
    setAdding(true);
    setError("");
    api.teams
      .addMember(selectedTeam.id, addEmail.trim())
      .then(() => {
        setAddEmail("");
        api.teams.get(selectedTeam.id).then(setSelectedTeam);
      })
      .catch((e) => setError(e.message))
      .finally(() => setAdding(false));
  };

  const handleRemoveMember = (userId: number) => {
    if (!selectedTeam) return;
    if (!confirm("Remove this member from the team?")) return;
    setRemovingUserId(userId);
    api.teams
      .removeMember(selectedTeam.id, userId)
      .then(() => api.teams.get(selectedTeam.id).then(setSelectedTeam))
      .catch((e) => setError(e.message))
      .finally(() => setRemovingUserId(null));
  };

  const handleDeleteTeam = (teamId: number) => {
    if (!confirm("Delete this team? Members will lose access to workflows shared with this team.")) return;
    setDeletingTeamId(teamId);
    api.teams
      .delete(teamId)
      .then(() => {
        setSelectedTeam(null);
        loadTeams();
      })
      .catch((e) => setError(e.message))
      .finally(() => setDeletingTeamId(null));
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
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">Teams</h1>
              <p className="text-muted text-sm mt-0.5">Collaborate with your team and share workflows</p>
            </div>
          </div>

          {error && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Spinner className="h-8 w-8" />
              <p className="text-muted text-sm">Loading teams…</p>
            </div>
          ) : selectedTeam ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="text-muted hover:text-white text-sm"
                >
                  ← Back to teams
                </button>
              </div>
              <div className="card p-6 border border-[#253858]">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedTeam.name}</h2>
                    <p className="text-muted text-xs mt-0.5">
                      {selectedTeam.owner_id === user.id ? "You own this team" : "Member"}
                    </p>
                  </div>
                  {selectedTeam.owner_id === user.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(selectedTeam.id)}
                      disabled={deletingTeamId === selectedTeam.id}
                      className="text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded text-sm transition disabled:opacity-50"
                    >
                      {deletingTeamId === selectedTeam.id ? "…" : "Delete team"}
                    </button>
                  )}
                </div>

                <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">Members</p>
                <ul className="space-y-2 mb-4">
                  {selectedTeam.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between py-2 px-3 rounded bg-[#253858]/50 text-sm"
                    >
                      <span className="text-white">
                        {m.display_name?.trim() || m.email || `User #${m.user_id}`}
                      </span>
                      {selectedTeam.owner_id === user.id && m.user_id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          disabled={removingUserId === m.user_id}
                          className="text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          {removingUserId === m.user_id ? "…" : "Remove"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {selectedTeam.owner_id === user.id && (
                  <form onSubmit={handleAddMember} className="flex gap-2">
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="Add by email"
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={adding || !addEmail.trim()}
                      className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
                    >
                      {adding ? "…" : "Add"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleCreate} className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="New team name"
                  className="input-field flex-1"
                />
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="btn-primary whitespace-nowrap disabled:opacity-50"
                >
                  {creating ? "…" : "Create team"}
                </button>
              </form>

              {teams.length === 0 ? (
                <div className="card p-12 text-center border border-[#253858]">
                  <p className="text-muted mb-1 font-medium text-white/90">No teams yet</p>
                  <p className="text-muted text-sm">
                    Create a team to share workflows with colleagues. Add members by email.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {teams.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => api.teams.get(t.id).then(setSelectedTeam)}
                        className="w-full card p-4 text-left hover:bg-[#253858] transition border border-[#253858]"
                      >
                        <span className="font-medium text-white">{t.name}</span>
                        <span className="text-muted text-xs block mt-0.5">
                          {t.owner_id === user.id ? "Owner" : "Member"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
