"use client";

// Task Detail — details, before photo, photo proof, Submit for Approval.
// A rejected task can be fixed and resubmitted (v1 addition).
// Submission requires at least one photo (plan rule).

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { BackButton, BottomNav, PhotoPicker, PriorityChip, StatusChip } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDeadline, isOverdue } from "@/lib/utils";

export default function TaskDetailPage() {
  return (
    <RequireAuth>
      <TaskDetailInner />
    </RequireAuth>
  );
}

function TaskDetailInner() {
  const params = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const task = store.tasks.find((t) => t.id === params.id);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Captured at submit time: after resubmitting, the live task status flips
  // to "submitted", so deriving "was this a resubmit?" from it would lie.
  const [wasResubmit, setWasResubmit] = useState(false);

  if (!task) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-base font-semibold text-charcoal">Task not found</p>
        <p className="mt-1 text-sm text-stone-500">It may have been removed.</p>
        <button onClick={() => router.push("/tasks")} className="mt-4 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white">
          Back to My Tasks
        </button>
      </main>
    );
  }

  const team = store.teams.find((t) => t.id === task.teamId);
  const assignee = store.users.find((u) => u.id === task.assigneeId);
  const assigner = store.users.find((u) => u.id === task.assignedById);
  const user = store.currentUser!;
  const isAssignee = user.id === task.assigneeId;
  const canReview = user.role === "admin" || (user.role === "manager" && user.teamId === task.teamId);
  const overdue = isOverdue(task.deadline, task.status === "completed");
  const latestSubmission = task.submissions[task.submissions.length - 1];
  const isResubmit = task.status === "rejected";

  async function handleSubmit() {
    if (!task) return;
    if (photos.length === 0) {
      setError("Please add at least one photo as proof before submitting.");
      return;
    }
    setError("");
    setBusy(true);
    setWasResubmit(isResubmit);
    try {
      if (isResubmit) await store.resubmitTask(task.id, note, photos);
      else await store.submitTask(task.id, note, photos);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</span>
        <h1 className="mt-4 text-xl font-bold text-charcoal">
          {wasResubmit ? "Resubmitted for approval" : "Submitted for approval"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">Your manager will review the photo proof.</p>
        <button onClick={() => router.push("/tasks")} className="mt-5 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white">
          Back to My Tasks
        </button>
      </main>
    );
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
          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-stone-500"}`}>
            {formatDeadline(task.deadline)}
          </span>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{task.description}</p>

        <div className="mt-4 space-y-1.5 rounded-2xl bg-white p-4 text-sm">
          <Row label="Team" value={team?.name ?? "—"} />
          <Row label="Assigned to" value={assignee?.name ?? "—"} />
          <Row label="Assigned by" value={assigner?.name ?? "—"} />
          <Row label="Deadline" value={formatDeadline(task.deadline)} />
        </div>

        {task.beforePhoto && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-stone-600">Before photo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={task.beforePhoto} alt="Before photo" className="w-full rounded-2xl object-cover" />
          </div>
        )}

        {/* Submission history */}
        {task.submissions.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-stone-600">Submissions</p>
            <div className="space-y-3">
              {task.submissions.map((sub) => (
                <div key={sub.id} className="rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-500">{formatDateTime(sub.submittedAt)}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        sub.decision === "approved"
                          ? "bg-green-100 text-green-800"
                          : sub.decision === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {sub.decision === "pending" ? "Waiting for review" : sub.decision === "approved" ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  {sub.note && <p className="mt-2 text-sm text-stone-700">{sub.note}</p>}
                  {sub.rejectReason && (
                    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span className="font-semibold">Rejection reason: </span>
                      {sub.rejectReason}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {sub.photos.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`Submitted photo ${i + 1}`} className="h-24 w-full rounded-xl object-cover" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Member actions */}
        {actionError && (
          <p className="mt-5 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{actionError}</p>
        )}
        {isAssignee && task.status === "assigned" && (
          <button
            onClick={async () => {
              setActionError("");
              try {
                await store.acceptTask(task.id);
              } catch (e) {
                setActionError(e instanceof Error ? e.message : "Could not start the task. Please try again.");
              }
            }}
            className="mt-5 w-full rounded-xl bg-charcoal py-3.5 text-[15px] font-semibold text-white"
          >
            Start Task
          </button>
        )}

        {isAssignee && (task.status === "in_progress" || task.status === "rejected") && (
          <div className="mt-5 rounded-2xl bg-white p-4">
            <h2 className="text-sm font-bold text-charcoal">
              {isResubmit ? "Fix and resubmit" : "Submit for approval"}
            </h2>
            {isResubmit && latestSubmission?.rejectReason && (
              <p className="mt-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                <span className="font-semibold">Rejected: </span>
                {latestSubmission.rejectReason}
              </p>
            )}
            <div className="mt-3">
              <PhotoPicker photos={photos} onChange={setPhotos} />
            </div>
            <textarea
              rows={2}
              placeholder="Add a note for your manager (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-3 w-full resize-none rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold"
            />
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-gold py-3.5 text-[15px] font-bold text-charcoal disabled:opacity-50"
            >
              {busy ? "Submitting…" : isResubmit ? "Resubmit for Approval" : "Submit for Approval"}
            </button>
            <p className="mt-2 text-center text-[11px] text-stone-400">A photo is required — the task cannot be completed without proof.</p>
          </div>
        )}

        {isAssignee && task.status === "submitted" && (
          <p className="mt-5 rounded-2xl bg-orange-50 px-4 py-3 text-center text-sm font-medium text-orange-800">
            Submitted — waiting for your manager to review.
          </p>
        )}

        {isAssignee && task.status === "completed" && (
          <p className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
            Completed — approved by your manager. Well done!
          </p>
        )}

        {/* Manager / admin review shortcut */}
        {canReview && !isAssignee && task.status === "submitted" && (
          <Link
            href={`/approval/${task.id}`}
            className="mt-5 block rounded-xl bg-charcoal py-3.5 text-center text-[15px] font-semibold text-white"
          >
            Review Submission
          </Link>
        )}
      </main>
      <BottomNav />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-4">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-charcoal">{value}</span>
    </p>
  );
}
