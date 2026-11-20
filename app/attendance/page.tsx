"use client";

// Attendance — Today: check in / check out with time, hours so far,
// today's timeline. Figma: Attendance screen (Final 9).
// Records are never deleted (migration-002).

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, AttendanceTabs, BottomNav } from "@/components/ui";
import { useStore } from "@/lib/store";
import {
  formatDateIST,
  formatHours,
  formatTimeIST,
  minutesBetween,
  todayISTISO,
} from "@/lib/utils";

export default function AttendancePage() {
  return (
    <RequireAuth>
      <AttendanceInner />
    </RequireAuth>
  );
}

function AttendanceInner() {
  const store = useStore();
  const { refreshTodayAttendance, checkIn, checkOut } = store;
  const user = store.currentUser!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const today = todayISTISO();
  const myRow = store.todayAttendance.find((r) => r.userId === user.id) ?? null;

  // Refresh today's rows on mount (the login load may still be in flight).
  useEffect(() => {
    void refreshTodayAttendance();
  }, [refreshTodayAttendance]);

  // Live "hours so far" while checked in (recompute every 30 seconds).
  useEffect(() => {
    if (!myRow || myRow.checkOutAt) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [myRow]);

  const checkedIn = Boolean(myRow);
  const checkedOut = Boolean(myRow?.checkOutAt);
  const hoursSoFar = myRow
    ? minutesBetween(myRow.checkInAt, myRow.checkOutAt ?? new Date(now).toISOString())
    : 0;

  async function handleCheckIn() {
    setError("");
    setBusy(true);
    try {
      await checkIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setError("");
    setBusy(true);
    try {
      await checkOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title="Attendance" subtitle={formatDateIST(today)} />
      <main className="flex-1 px-5 pb-6">
        <AttendanceTabs active="today" showWho={user.role !== "member"} />

        {/* Status card */}
        <div className="mt-4 rounded-3xl bg-charcoal p-5 text-white">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                checkedOut ? "bg-gold" : checkedIn ? "bg-green-400" : "bg-stone-500"
              }`}
            />
            {checkedOut ? "Checked Out" : checkedIn ? "Checked In" : "Not Checked In"}
          </p>
          <p className="mt-2 text-4xl font-bold leading-none">
            {checkedOut && myRow?.checkOutAt
              ? formatTimeIST(myRow.checkOutAt)
              : checkedIn && myRow
                ? formatTimeIST(myRow.checkInAt)
                : "—"}
          </p>
          <p className="mt-2 text-sm text-stone-300">
            {checkedOut
              ? `Worked ${formatHours(hoursSoFar)} today`
              : checkedIn
                ? `${formatHours(hoursSoFar)} so far`
                : "Tap Check In when you arrive"}
          </p>
        </div>

        {/* Check In / Check Out button */}
        {checkedOut ? (
          <p className="mt-4 rounded-xl bg-white px-4 py-3.5 text-center text-sm font-semibold text-stone-600">
            Checked out for today. See you tomorrow!
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={checkedIn ? handleCheckOut : handleCheckIn}
            className="mt-4 w-full rounded-xl bg-gold py-4 text-[15px] font-bold text-charcoal disabled:opacity-50"
          >
            {busy ? "Saving…" : checkedIn ? "Check Out" : "Check In"}
          </button>
        )}
        {error && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>
        )}

        {/* Today timeline */}
        <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-stone-600">Today</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-charcoal">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              Check In
            </span>
            <span className="text-sm font-medium text-stone-600">
              {myRow ? formatTimeIST(myRow.checkInAt) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-charcoal">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-stone-300" />
              Check Out
            </span>
            {myRow?.checkOutAt ? (
              <span className="text-sm font-medium text-stone-600">{formatTimeIST(myRow.checkOutAt)}</span>
            ) : (
              <span className="text-sm font-semibold text-gold-deep">Pending</span>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Check-in saves with time. Records are never deleted.
        </p>
      </main>
      <BottomNav />
    </>
  );
}
