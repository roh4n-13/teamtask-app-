"use client";

// Team — member list with progress rings, search, + Add member.
// Admin can switch between teams; manager/member see their own team.

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, ProgressRing } from "@/components/ui";
import { useStore } from "@/lib/store";
import { avatarPlaceholder } from "@/lib/placeholders";

export default function TeamPage() {
  return (
    <RequireAuth>
      <TeamInner />
    </RequireAuth>
  );
}

function TeamInner() {
  const store = useStore();
  const user = store.currentUser!;
  const [query, setQuery] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(user.teamId ?? store.teams[0].id);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"member" | "manager">("member");
  const [addedNote, setAddedNote] = useState("");
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Teams load from Supabase after login; pick the first once they arrive.
  useEffect(() => {
    if (!selectedTeamId && store.teams.length > 0) setSelectedTeamId(store.teams[0].id);
  }, [selectedTeamId, store.teams]);

  const canAdd = user.role === "admin" || user.role === "manager";
  const visibleTeams = user.role === "admin" ? store.teams : store.teams.filter((t) => t.id === user.teamId);
  const teamId = user.role === "admin" ? selectedTeamId : user.teamId!;
  const team = store.teams.find((t) => t.id === teamId);

  const members = useMemo(() => {
    const list = store.users.filter((u) => u.teamId === teamId && u.role === "member");
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")));
  }, [store.users, teamId, query]);

  function memberProgress(memberId: string) {
    const ts = store.tasks.filter((t) => t.assigneeId === memberId);
    if (ts.length === 0) return { pct: 0, done: 0, total: 0 };
    const done = ts.filter((t) => t.status === "completed").length;
    return { pct: Math.round((done / ts.length) * 100), done, total: ts.length };
  }

  async function addMember() {
    if (!newName.trim()) return setAddError("Please enter the member's name.");
    if (!newPhone.trim()) return setAddError("Please enter the member's phone number.");
    if (newPassword.length < 6) return setAddError("Password must be at least 6 characters.");
    const existing = store.users.find((u) => u.phone.replace(/[\s-]/g, "") === newPhone.replace(/[\s-]/g, ""));
    if (existing) return setAddError("A user with this phone number already exists.");
    setAddError("");
    setAddBusy(true);
    try {
      const created = await store.addMember({
        name: newName,
        phone: newPhone,
        teamId,
        password: newPassword,
        role: newRole,
      });
      setAddedNote(
        `${created.name} added to ${team?.name} as ${created.role}. Share their password with them once — only you know it.`,
      );
      setNewName("");
      setNewPhone("");
      setNewPassword("");
      setNewRole("member");
      setShowAdd(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not add the member. Please try again.");
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={`${team?.name ?? "Team"} Team`} subtitle={`${members.length} members`} />
      <main className="flex-1 px-5 pb-6">
        {user.role === "admin" && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {visibleTeams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  selectedTeamId === t.id ? "bg-charcoal text-white" : "border border-stone-200 bg-white text-stone-600"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
        />

        {addedNote && (
          <p className="mt-3 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{addedNote}</p>
        )}

        <div className="mt-3 space-y-3">
          {members.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-500">No members found.</p>
          ) : (
            members.map((m) => {
              const p = memberProgress(m.id);
              const initials = m.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarPlaceholder(initials)} alt="" className="h-11 w-11 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal">{m.name}</p>
                    <p className="text-xs text-stone-500">{m.phone}</p>
                    <p className="text-xs text-stone-500">
                      {p.done} of {p.total} tasks done
                    </p>
                  </div>
                  <ProgressRing percent={p.pct} size={52} stroke={5} color="#D4A024" label={`${p.pct}%`} />
                </div>
              );
            })
          )}
        </div>

        {canAdd && (
          <div className="mt-4">
            {showAdd ? (
              <div className="rounded-2xl bg-white p-4">
                <h2 className="text-sm font-bold text-charcoal">Add member to {team?.name}</h2>
                <input
                  type="text"
                  placeholder="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
                />
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
                />
                <input
                  type="text"
                  placeholder="Login password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
                />
                <div className="mt-2 flex gap-2">
                  {(["member", "manager"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize ${
                        newRole === r ? "bg-charcoal text-white" : "border border-stone-300 bg-white text-stone-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {addError && <p className="mt-2 text-sm font-medium text-red-600">{addError}</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border border-stone-300 py-3 text-sm font-semibold text-stone-600">
                    Cancel
                  </button>
                  <button onClick={addMember} disabled={addBusy} className="flex-1 rounded-xl bg-charcoal py-3 text-sm font-semibold text-white disabled:opacity-50">
                    {addBusy ? "Adding…" : "Add Member"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full rounded-xl border-2 border-dashed border-stone-300 py-3.5 text-sm font-semibold text-stone-600"
              >
                + Add member
              </button>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
