"use client";

// My Tasks — date strip, filter chips, overdue first.
// Figma: date strip with today selected, All / To Do / In Progress /
// Completed chips. Scope: member sees own tasks, manager sees own team,
// admin sees all.

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, EmptyState, SectionTitle, TaskCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { addDaysISO, isOverdue, todayISO, toISODate } from "@/lib/utils";
import type { Task } from "@/lib/types";

type Filter = "all" | "todo" | "in_progress" | "completed" | "overdue";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];

export default function MyTasksPage() {
  return (
    <RequireAuth>
      <MyTasksInner />
    </RequireAuth>
  );
}

function MyTasksInner() {
  const store = useStore();
  const searchParams = useSearchParams();
  const user = store.currentUser!;
  const [filter, setFilter] = useState<Filter>(
    searchParams.get("filter") === "overdue" ? "overdue" : "all",
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const scoped = useMemo(() => {
    if (user.role === "member") return store.tasks.filter((t) => t.assigneeId === user.id);
    if (user.role === "manager") return store.tasks.filter((t) => t.teamId === user.teamId);
    return store.tasks;
  }, [store.tasks, user]);

  const days = useMemo(() => {
    const today = todayISO();
    return Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 3));
  }, []);

  const visible = useMemo(() => {
    let list = scoped;
    if (selectedDay) list = list.filter((t) => t.deadline === selectedDay);
    switch (filter) {
      case "todo":
        return list.filter((t) => t.status === "assigned");
      case "in_progress":
        return list.filter((t) => t.status === "in_progress");
      case "completed":
        return list.filter((t) => t.status === "completed");
      case "overdue":
        return list.filter((t) => isOverdue(t.deadline, t.status === "completed"));
      default:
        return list;
    }
  }, [scoped, filter, selectedDay]);

  const overdueList = useMemo(
    () => scoped.filter((t) => isOverdue(t.deadline, t.status === "completed")),
    [scoped],
  );

  return (
    <>
      <AppHeader title="My Tasks" subtitle={`${scoped.length} tasks in your view`} />
      <main className="flex-1 px-5 pb-6">
        {/* Date strip */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const d = new Date(`${day}T12:00:00`);
            const isToday = day === todayISO();
            const selected = selectedDay === day;
            const count = scoped.filter((t) => t.deadline === day).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                className={`flex min-w-12 flex-col items-center rounded-2xl px-2 py-2 ${
                  selected ? "bg-charcoal text-white" : isToday ? "bg-gold-light text-charcoal" : "bg-white text-stone-600"
                } border ${selected ? "border-charcoal" : "border-stone-200"}`}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {d.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="text-base font-bold leading-tight">{d.getDate()}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${count > 0 ? "bg-gold" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
        {selectedDay && (
          <button onClick={() => setSelectedDay(null)} className="mt-1 text-xs font-medium text-gold-deep">
            Showing tasks due {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — tap to clear ×
          </button>
        )}

        {/* Filter chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                filter === f.id ? "bg-charcoal text-white" : "bg-white text-stone-600 border border-stone-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filter !== "overdue" && overdueList.length > 0 && (
          <>
            <SectionTitle>Overdue</SectionTitle>
            <div className="space-y-3">
              {overdueList.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </>
        )}

        <SectionTitle>{filter === "all" ? "All Tasks" : FILTERS.find((f) => f.id === filter)?.label}</SectionTitle>
        <div className="space-y-3">
          {visible.length === 0 ? (
            <EmptyState title="Nothing here" hint="Try another filter or day." />
          ) : (
            visible.map((t: Task) => <TaskCard key={t.id} task={t} />)
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
