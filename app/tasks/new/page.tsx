"use client";

// Task Assign — manager/admin creates a task for one member.
// One task = one member (plan rule). Deadline is required.
// Optional before-photo uses the same compressed photo picker.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { BackButton, BottomNav, PhotoPicker } from "@/components/ui";
import { useStore } from "@/lib/store";
import { addDaysISO, todayISO } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const PRIORITIES: Priority[] = ["Low", "Normal", "Urgent"];

export default function TaskAssignPage() {
  return (
    <RequireAuth roles={["admin", "manager"]}>
      <TaskAssignInner />
    </RequireAuth>
  );
}

function TaskAssignInner() {
  const store = useStore();
  const router = useRouter();
  const user = store.currentUser!;

  const assignableTeams = user.role === "admin" ? store.teams : store.teams.filter((t) => t.id === user.teamId);
  const [teamId, setTeamId] = useState(assignableTeams[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(addDaysISO(todayISO(), 1));
  const [priority, setPriority] = useState<Priority>("Normal");
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const members = useMemo(
    () => store.users.filter((u) => u.teamId === teamId && u.role === "member"),
    [store.users, teamId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Please enter a task title.");
    if (!assigneeId) return setError("Please choose a member for this task.");
    if (!deadline) return setError("Please choose a deadline.");
    setError("");
    setBusy(true);
    try {
      await store.assignTask({
        title,
        description,
        teamId,
        assigneeId,
        deadline,
        priority,
        beforePhoto: beforePhotos[0],
      });
      setDone(true);
      window.setTimeout(() => {
        router.push(user.role === "admin" ? "/admin" : "/manager");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the task. Please try again.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</span>
        <h1 className="mt-4 text-xl font-bold text-charcoal">Task assigned</h1>
        <p className="mt-1 text-sm text-stone-600">The member has been notified in the app.</p>
      </main>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-paper/95 px-5 pb-2 pt-4 backdrop-blur">
        <BackButton />
        <h1 className="mt-2 text-xl font-bold text-charcoal">Assign Task</h1>
      </header>
      <main className="flex-1 px-5 pb-6">
        <form onSubmit={submit} className="mt-2 space-y-4">
          <div>
            <label htmlFor="team" className="mb-1 block text-xs font-semibold text-stone-600">Team</label>
            <select
              id="team"
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setAssigneeId("");
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-gold"
            >
              {assignableTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="member" className="mb-1 block text-xs font-semibold text-stone-600">Assign to</label>
            <select
              id="member"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-gold"
            >
              <option value="">Choose a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.phone}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-semibold text-stone-600">Title</label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Set up gallery wall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-semibold text-stone-600">Description</label>
            <textarea
              id="description"
              rows={3}
              placeholder="What exactly needs to be done?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
            />
          </div>

          <div>
            <label htmlFor="deadline" className="mb-1 block text-xs font-semibold text-stone-600">Deadline</label>
            <input
              id="deadline"
              type="date"
              value={deadline}
              min={todayISO()}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-[15px] outline-none focus:border-gold"
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-stone-600">Priority</span>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                    priority === p
                      ? p === "Urgent"
                        ? "bg-red-600 text-white"
                        : "bg-charcoal text-white"
                      : "border border-stone-300 bg-white text-stone-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-stone-600">Before photo (optional)</span>
            <PhotoPicker photos={beforePhotos} onChange={setBeforePhotos} maxPhotos={1} />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>}

          <button type="submit" disabled={busy} className="w-full rounded-xl bg-charcoal py-3.5 text-[15px] font-semibold text-white disabled:opacity-50">
            {busy ? "Assigning…" : "Assign Task"}
          </button>
        </form>
      </main>
      <BottomNav />
    </>
  );
}
