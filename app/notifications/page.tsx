"use client";

// Notifications — in-app notification centre (v1 addition).
// Real push via FCM comes later; this centre + the hooks that create
// notifications on assign / submit / approve / reject are ready for it.
// "Due soon" is computed live: your unfinished tasks due within 24 hours.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav, SectionTitle } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatDateTime, isDueSoon } from "@/lib/utils";
import type { NotificationKind } from "@/lib/types";

const KIND_LABEL: Record<NotificationKind, string> = {
  assigned: "New task",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  deadline: "Deadline",
  overdue: "Overdue",
};

const KIND_STYLE: Record<NotificationKind, string> = {
  assigned: "bg-blue-100 text-blue-800",
  submitted: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  deadline: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-700",
};

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsInner />
    </RequireAuth>
  );
}

function NotificationsInner() {
  const store = useStore();
  const router = useRouter();
  const user = store.currentUser!;

  const mine = useMemo(
    () =>
      store.notifications
        .filter((n) => n.userId === user.id)
        .sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt)),
    [store.notifications, user.id],
  );

  const dueSoon = useMemo(
    () =>
      store.tasks.filter(
        (t) =>
          t.assigneeId === user.id &&
          t.status !== "completed" &&
          isDueSoon(t.deadline, false),
      ),
    [store.tasks, user.id],
  );

  const unread = mine.filter((n) => !n.read).length;

  return (
    <>
      <AppHeader title="Notifications" subtitle={unread > 0 ? `${unread} unread` : "All caught up"} />
      <main className="flex-1 px-5 pb-6">
        {unread > 0 && (
          <button
            onClick={store.markAllNotificationsRead}
            className="mt-2 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-charcoal shadow-sm"
          >
            <CheckCheck size={17} className="text-gold-deep" />
            Mark all as read
          </button>
        )}

        {dueSoon.length > 0 && (
          <>
            <SectionTitle>Due soon — within 24 hours</SectionTitle>
            <div className="space-y-2">
              {dueSoon.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
                >
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    Deadline
                  </span>
                  <p className="mt-1.5 text-sm font-semibold text-charcoal">{t.title}</p>
                  <p className="text-xs text-stone-500">Due {t.deadline} — finish it today.</p>
                </button>
              ))}
            </div>
          </>
        )}

        <SectionTitle>All notifications</SectionTitle>
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center">
            <BellRing className="mx-auto mb-2 text-gold" size={24} />
            <p className="text-sm font-semibold text-charcoal">No notifications yet</p>
            <p className="mt-1 text-xs text-stone-500">New tasks, submissions and decisions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mine.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  store.markNotificationRead(n.id);
                  if (n.taskId) router.push(`/tasks/${n.taskId}`);
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  n.read ? "border-stone-200 bg-white" : "border-gold/50 bg-gold-light/50"
                }`}
              >
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${KIND_STYLE[n.kind]}`}>
                  {KIND_LABEL[n.kind]}
                </span>
                <p className="mt-1.5 text-sm leading-snug text-charcoal">{n.message}</p>
                <p className="mt-1 text-[11px] text-stone-400">{formatDateTime(n.createdAt)}</p>
              </button>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
