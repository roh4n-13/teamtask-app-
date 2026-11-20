"use client";

// Member Dashboard — my tasks only.
// Figma: new-task banner, stat boxes, own tasks.

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, SectionTitle, TaskCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { isOverdue } from "@/lib/utils";

export default function MemberDashboard() {
  return (
    <RequireAuth roles={["member"]}>
      <MemberDashboardInner />
    </RequireAuth>
  );
}

function MemberDashboardInner() {
  const store = useStore();
  const user = store.currentUser!;
  const myTasks = store.tasks.filter((t) => t.assigneeId === user.id);
  const pending = myTasks.filter((t) => t.status === "assigned" || t.status === "in_progress").length;
  const done = myTasks.filter((t) => t.status === "completed").length;
  const overdue = myTasks.filter((t) => isOverdue(t.deadline, t.status === "completed"));
  const newest = [...myTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <>
      <AppHeader title={`Hello, ${user.name}`} subtitle="Member" />
      <main className="flex-1 px-5 pb-6">
        {/* New-task banner */}
        {newest && newest.status === "assigned" && (
          <Link href={`/tasks/${newest.id}`} className="mt-2 block rounded-3xl bg-charcoal p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-gold">New task</p>
            <p className="mt-1 text-lg font-bold leading-snug">{newest.title}</p>
            <p className="mt-1 text-xs text-stone-400">Tap to view and start working on it →</p>
          </Link>
        )}

        {/* Stat boxes */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatBox label="My Tasks" value={myTasks.length} />
          <StatBox label="Pending" value={pending} />
          <StatBox label="Done" value={done} />
        </div>

        {/* Attendance */}
        <Link href="/attendance" className="mt-3 flex items-center justify-between rounded-2xl bg-gold-light px-4 py-3.5">
          <span>
            <span className="block text-sm font-bold text-charcoal">Attendance</span>
            <span className="text-xs text-stone-600">Check in when you arrive at the centre</span>
          </span>
          <span className="text-sm font-bold text-gold-deep">Check In →</span>
        </Link>

        {overdue.length > 0 && (
          <Link href="/tasks?filter=overdue" className="mt-3 block rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {overdue.length} task{overdue.length > 1 ? "s" : ""} overdue — finish them first →
          </Link>
        )}

        <SectionTitle>My Tasks</SectionTitle>
        <div className="space-y-3">
          {myTasks.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-600">
              No tasks yet. Your manager will assign tasks here.
            </p>
          ) : (
            myTasks.map((t) => <TaskCard key={t.id} task={t} />)
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 text-center">
      <p className="text-2xl font-bold text-charcoal">{value}</p>
      <p className="text-[11px] font-medium text-stone-600">{label}</p>
    </div>
  );
}
