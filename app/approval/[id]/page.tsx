"use client";

// Approval — manager/admin reviews a submitted task.
// Submitted photo shown large, optional note, Approve / Reject.
// Rejection requires a reason (plan rule).

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { BackButton, BottomNav, PriorityChip, StatusChip } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDeadline } from "@/lib/utils";

export default function ApprovalPage() {
  return (
    <RequireAuth roles={["admin", "manager"]}>
      <ApprovalInner />
    </RequireAuth>
  );
}

function ApprovalInner() {
  const params = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const task = store.tasks.find((t) => t.id === params.id);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState("");
  const [decided, setDecided] = useState<"approved" | "rejected" | null>(null);

  if (!task) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-base font-semibold text-charcoal">Task not found</p>
        <button onClick={() => router.push("/tasks")} className="mt-4 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white">
          Back to My Tasks
        </button>
      </main>
    );
  }

  const latest = task.submissions[task.submissions.length - 1];
  const team = store.teams.find((t) => t.id === task.teamId);
  const assignee = store.users.find((u) => u.id === task.assigneeId);
  const user = store.currentUser!;
  const canReview =
    user.role === "admin" || (user.role === "manager" && user.teamId === task.teamId);

  if (!canReview) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-base font-semibold text-charcoal">Not your team&apos;s task</p>
        <p className="mt-1 text-sm text-stone-600">
          Managers can only review tasks from their own team.
        </p>
        <button onClick={() => router.back()} className="mt-4 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white">
          Go Back
        </button>
      </main>
    );
  }

  if (decided) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${
            decided === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {decided === "approved" ? "✓" : "×"}
        </span>
        <h1 className="mt-4 text-xl font-bold text-charcoal">
          {decided === "approved" ? "Task approved" : "Task rejected"}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {decided === "approved"
            ? "The task is now complete. The member has been notified."
            : "The member has been notified and can fix and resubmit."}
        </p>
        <button
          onClick={() => router.push(store.currentUser?.role === "admin" ? "/admin" : "/manager")}
          className="mt-5 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Dashboard
        </button>
      </main>
    );
  }

  if (task.status !== "submitted" || !latest || latest.decision !== "pending") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-base font-semibold text-charcoal">Nothing to review here</p>
        <p className="mt-1 text-sm text-stone-600">
          This task is currently “{task.status.replace("_", " ")}” — there is no submission waiting for approval.
        </p>
        <button onClick={() => router.back()} className="mt-4 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white">
          Go Back
        </button>
      </main>
    );
  }

  async function approve() {
    setError("");
    try {
      await store.approveTask(task!.id, latest!.id);
      setDecided("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve. Please try again.");
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Please write a reason — the member needs to know what to fix.");
      return;
    }
    setError("");
    try {
      await store.rejectTask(task!.id, latest!.id, reason);
      setDecided("rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject. Please try again.");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-paper/95 px-5 pb-2 pt-4 backdrop-blur">
        <BackButton />
        <h1 className="mt-2 text-xl font-bold leading-snug text-charcoal">{task.title}</h1>
      </header>
      <main className="flex-1 px-5 pb-6">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusChip task={task} />
          <PriorityChip priority={task.priority} />
          <span className="text-xs font-medium text-stone-600">{formatDeadline(task.deadline)}</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{task.description}</p>
        <p className="mt-2 text-sm text-stone-600">
          {team?.name} · {assignee?.name} · submitted {formatDateTime(latest.submittedAt)}
        </p>

        <p className="mb-1.5 mt-4 text-xs font-semibold text-stone-600">Submitted photo proof</p>
        <div className="grid grid-cols-2 gap-2">
          {latest.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Submitted photo ${i + 1}`} className="w-full rounded-2xl object-cover" />
          ))}
        </div>
        {latest.note && (
          <div className="mt-3 rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold text-stone-600">Member&apos;s note</p>
            <p className="mt-1 text-sm text-stone-700">{latest.note}</p>
          </div>
        )}

        {showReject ? (
          <div className="mt-4 rounded-2xl bg-white p-4">
            <label htmlFor="reason" className="mb-1 block text-xs font-semibold text-stone-600">
              Reason for rejection (required)
            </label>
            <textarea
              id="reason"
              rows={3}
              placeholder="What needs to be fixed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
            />
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => setShowReject(false)} className="flex-1 rounded-xl border border-stone-300 py-3 text-sm font-semibold text-stone-600">
                Cancel
              </button>
              <button onClick={reject} className="flex-1 rounded-xl bg-crimson py-3 text-sm font-semibold text-white">
                Confirm Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            {error && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>
            )}
            <div className="flex gap-3">
            <button onClick={() => setShowReject(true)} className="flex-1 rounded-xl border-2 border-crimson py-3.5 text-[15px] font-semibold text-crimson">
              Reject
            </button>
            <button onClick={approve} className="flex-1 rounded-xl bg-green-600 py-3.5 text-[15px] font-semibold text-white">
              Approve
            </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
