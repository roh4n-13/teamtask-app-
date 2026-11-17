"use client";

// Manager Dashboard — own team only.
// Figma: big team completion ring, per-team rings, in-progress cards.
// Ring values are computed live from the store.

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, ProgressRing, SectionTitle, TaskCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { isOverdue } from "@/lib/utils";

export default function ManagerDashboard() {
  return (
    <RequireAuth roles={["manager"]}>
      <ManagerDashboardInner />
    </RequireAuth>
  );
}

function ManagerDashboardInner() {
  const store = useStore();
  const user = store.currentUser!;
  const team = store.teams.find((t) => t.id === user.teamId);
  const teamTasks = store.tasks.filter((t) => t.teamId === user.teamId);
  const completed = teamTasks.filter((t) => t.status === "completed").length;
  const completion = teamTasks.length === 0 ? 0 : Math.round((completed / teamTasks.length) * 100);
  const pendingApprovals = teamTasks.filter((t) => t.status === "submitted").length;
  const overdue = teamTasks.filter((t) => isOverdue(t.deadline, t.status === "completed"));
  const inProgress = teamTasks.filter((t) => t.status === "in_progress" || t.status === "assigned");

  // Per-team rings (as on the Figma screen) — computed live.
  const teamRings = store.teams.map((tm) => {
    const ts = store.tasks.filter((t) => t.teamId === tm.id);
    const done = ts.filter((t) => t.status === "completed").length;
    return { team: tm, pct: ts.length === 0 ? 0 : Math.round((done / ts.length) * 100) };
  });

  return (
    <>
      <AppHeader title={`${team?.name ?? "Team"} Dashboard`} subtitle={`${user.name} · Manager`} />
      <main className="flex-1 px-5 pb-6">
        {/* Big team ring */}
        <div className="mt-2 flex items-center gap-5 rounded-3xl bg-charcoal p-5 text-white">
          <ProgressRing percent={completion} size={110} stroke={10} color="#D4A024" track="#3A3A3A" label={`${completion}%`} />
          <div>
            <p className="text-xs uppercase tracking-wide text-gold">Team completion</p>
            <p className="mt-1 text-xl font-bold leading-snug">
              {completed} of {teamTasks.length} tasks done
            </p>
            <p className="mt-1 text-xs text-stone-400">
              {pendingApprovals} waiting for approval · {overdue.length} overdue
            </p>
            <Link href="/tasks/new" className="mt-3 inline-block rounded-full bg-gold px-4 py-2 text-xs font-bold text-charcoal">
              + Assign Task
            </Link>
          </div>
        </div>

        {/* Per-team rings */}
        <SectionTitle>Teams</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {teamRings.slice(0, 3).map(({ team: tm, pct }) => (
            <div key={tm.id} className="rounded-2xl border border-stone-200 bg-white p-3 text-center">
              <ProgressRing percent={pct} size={64} stroke={6} color={tm.color === "#1A1A1A" ? "#D4A024" : tm.color} label={`${pct}%`} />
              <p className="mt-1.5 truncate text-xs font-semibold text-charcoal">{tm.name}</p>
            </div>
          ))}
        </div>

        {overdue.length > 0 && (
          <>
            <SectionTitle>Overdue</SectionTitle>
            <div className="space-y-3">
              {overdue.map((t) => (
                <TaskCard key={t.id} task={t} showTeam={false} />
              ))}
            </div>
          </>
        )}

        <SectionTitle>In Progress</SectionTitle>
        <div className="space-y-3">
          {inProgress.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-500">
              No tasks in progress. Assign a task to get started.
            </p>
          ) : (
            inProgress.map((t) => <TaskCard key={t.id} task={t} showTeam={false} />)
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
