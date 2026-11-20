"use client";

// Admin Dashboard (Rohan — all teams).
// Figma: 4 teams hero, stat boxes, + Assign New Task, Recent Tasks.
// Values are computed live from the store (they differ from the Figma
// dummy numbers, which were placeholders).

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, ProgressRing, SectionTitle, TaskCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { isOverdue } from "@/lib/utils";

export default function AdminDashboard() {
  return (
    <RequireAuth roles={["admin"]}>
      <AdminDashboardInner />
    </RequireAuth>
  );
}

function AdminDashboardInner() {
  const store = useStore();
  const user = store.currentUser!;
  const tasks = store.tasks;

  const totalTasks = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pendingApprovals = tasks.filter((t) => t.status === "submitted").length;
  const overdue = tasks.filter((t) => isOverdue(t.deadline, t.status === "completed")).length;
  const completion = totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100);

  const teamStats = store.teams.map((team) => {
    const teamTasks = tasks.filter((t) => t.teamId === team.id);
    const done = teamTasks.filter((t) => t.status === "completed").length;
    const pct = teamTasks.length === 0 ? 0 : Math.round((done / teamTasks.length) * 100);
    const members = store.users.filter((u) => u.teamId === team.id && u.role === "member").length;
    return { team, total: teamTasks.length, done, pct, members };
  });

  const recent = [...tasks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <>
      <AppHeader title={`Hello, ${user.name}`} subtitle="Admin · All Teams" />
      <main className="flex-1 px-5 pb-6">
        {/* 4-team hero */}
        <div className="mt-2 rounded-3xl bg-charcoal p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gold">Overall completion</p>
              <p className="mt-1 text-2xl font-bold">{completion}% complete</p>
              <p className="text-xs text-stone-400">
                {completed} of {totalTasks} tasks done · {overdue} overdue
              </p>
            </div>
            <ProgressRing percent={completion} size={84} stroke={8} color="#D4A024" track="#3A3A3A" label={`${completion}%`} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {teamStats.map(({ team, pct }) => (
              <div key={team.id} className="rounded-2xl bg-charcoal-2 p-2.5 text-center">
                <ProgressRing percent={pct} size={52} stroke={5} color={team.color === "#1A1A1A" ? "#D4A024" : team.color} track="#3A3A3A" label={`${pct}%`} />
                <p className="mt-1.5 text-[10px] font-semibold leading-tight text-stone-200">{team.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stat boxes */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatBox label="Total Tasks" value={totalTasks} />
          <StatBox label="Teams" value={store.teams.length} />
          <StatBox label="Pending Approval" value={pendingApprovals} accent={pendingApprovals > 0} />
        </div>

        <Link
          href="/tasks/new"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 text-[15px] font-bold text-charcoal"
        >
          + Assign New Task
        </Link>

        <Link
          href="/attendance/who"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-charcoal bg-white py-3 text-[15px] font-semibold text-charcoal"
        >
          Attendance — Who's here today
        </Link>

        {overdue > 0 && (
          <Link href="/tasks?filter=overdue" className="mt-3 block rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {overdue} task{overdue > 1 ? "s" : ""} overdue — review now →
          </Link>
        )}

        <SectionTitle>Recent Tasks</SectionTitle>
        <div className="space-y-3">
          {recent.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${accent ? "border-gold bg-gold-light" : "border-stone-200 bg-white"}`}>
      <p className="text-2xl font-bold text-charcoal">{value}</p>
      <p className="text-[11px] font-medium text-stone-600">{label}</p>
    </div>
  );
}
