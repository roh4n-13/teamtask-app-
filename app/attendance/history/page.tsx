"use client";

// Attendance — History: per-person record (when they came, when they left,
// total hours per day) + this week's summary.
// Member sees only their own history. Manager/admin pick a team member
// (or tap a row on Who's Here, which opens that member's history).
// Missed check-outs can be fixed by a manager (own team) or Admin.
// Figma: History screen (Final 11).

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, AttendanceTabs, BottomNav } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { AttendanceRecord } from "@/lib/types";
import {
  formatDayIST,
  formatHours,
  formatTimeIST,
  minutesBetween,
  mondayISTISO,
  todayISTISO,
} from "@/lib/utils";

export default function HistoryPage() {
  return (
    <RequireAuth>
      <Suspense>
        <HistoryInner />
      </Suspense>
    </RequireAuth>
  );
}

function HistoryInner() {
  const store = useStore();
  const searchParams = useSearchParams();
  const user = store.currentUser!;

  // Who can the viewer look at? Member: only self. Manager: own team.
  // Admin: everyone (members, managers and the Admin).
  const options = useMemo(() => {
    const inScope =
      user.role === "admin"
        ? store.users
        : user.role === "manager"
          ? store.users.filter((u) => u.teamId === user.teamId)
          : store.users.filter((u) => u.id === user.id);
    return inScope
      .filter((u) => u.role === "member" || u.role === "manager" || u.role === "admin")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.users, user.role, user.teamId, user.id]);

  const requestedId = searchParams.get("user");
  const [selectedId, setSelectedId] = useState<string>(user.id);
  // Honour ?user= (from Who's Here) when it is someone the viewer may see.
  useEffect(() => {
    if (requestedId && options.some((u) => u.id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [requestedId, options]);

  const selectedUser = options.find((u) => u.id === selectedId) ?? null;
  const canFix = (rec: AttendanceRecord): boolean => {
    if (user.role === "admin") return true;
    if (user.role !== "manager") return false;
    const owner = store.users.find((u) => u.id === rec.userId);
    return owner?.teamId === user.teamId;
  };

  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixTime, setFixTime] = useState("18:00");
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState("");

  async function loadHistory(userId: string) {
    setLoading(true);
    setError("");
    try {
      setRows(await store.getHistory(userId, 60));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) void loadHistory(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function saveFix(rec: AttendanceRecord) {
    setFixError("");
    setFixBusy(true);
    try {
      await store.fixCheckOut(rec.id, fixTime);
      setFixingId(null);
      await loadHistory(selectedId);
    } catch (e) {
      setFixError(e instanceof Error ? e.message : "Could not save the check-out time.");
    } finally {
      setFixBusy(false);
    }
  }

  // This week (Monday to today, Asia/Kolkata): completed rows only.
  const week = useMemo(() => {
    const monday = mondayISTISO(todayISTISO());
    const inRange = rows.filter((r) => r.workDate >= monday && r.workDate <= todayISTISO());
    const done = inRange.filter((r) => r.checkOutAt);
    const totalMinutes = done.reduce(
      (sum, r) => sum + minutesBetween(r.checkInAt, r.checkOutAt!),
      0,
    );
    const days = inRange.length;
    return { totalMinutes, days, avg: days === 0 ? 0 : Math.round(totalMinutes / days) };
  }, [rows]);

  return (
    <>
      <AppHeader
        title="History"
        subtitle={selectedUser ? `${selectedUser.name}'s attendance record` : "Your attendance record"}
      />
      <main className="flex-1 px-5 pb-6">
        <AttendanceTabs active="history" showWho={user.role !== "member"} />

        {/* Member picker (manager/admin only) */}
        {user.role !== "member" && options.length > 0 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-4 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-charcoal outline-none focus:border-gold"
            aria-label="Choose a member"
          >
            {options.map((u) => {
              const team = store.teams.find((t) => t.id === u.teamId);
              const label = u.role === "admin" ? "Admin" : (team?.name ?? "—");
              return (
                <option key={u.id} value={u.id}>
                  {u.name} — {label}
                  {u.id === user.id ? " (you)" : ""}
                </option>
              );
            })}
          </select>
        )}

        {/* Week summary */}
        <div className="mt-4 rounded-3xl bg-charcoal p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-gold">This week</p>
          <p className="mt-1 text-4xl font-bold leading-none">{formatHours(week.totalMinutes)}</p>
          <p className="mt-2 text-sm text-stone-300">
            {week.days} day{week.days === 1 ? "" : "s"} • Avg {formatHours(week.avg)}
          </p>
        </div>

        {/* Date rows */}
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-600">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-600">
              No attendance records yet.
            </p>
          ) : (
            rows.map((r) => {
              const missed = !r.checkOutAt;
              const total = missed ? null : minutesBetween(r.checkInAt, r.checkOutAt!);
              return (
                <div key={r.id} className="rounded-2xl bg-white px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-charcoal">{formatDayIST(r.workDate)}</p>
                      <p className="mt-0.5 text-xs text-stone-600">
                        {formatTimeIST(r.checkInAt)} → {r.checkOutAt ? formatTimeIST(r.checkOutAt) : "—"}
                      </p>
                    </div>
                    {missed ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                        Missed check-out
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-bold text-charcoal">
                        {formatHours(total!)}
                      </span>
                    )}
                  </div>
                  {missed && canFix(r) && (
                    <div className="mt-3 border-t border-stone-100 pt-3">
                      {fixingId === r.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={fixTime}
                            onChange={(e) => setFixTime(e.target.value)}
                            className="min-h-[44px] flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-gold"
                            aria-label="Check-out time"
                          />
                          <button
                            type="button"
                            disabled={fixBusy}
                            onClick={() => void saveFix(r)}
                            className="rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {fixBusy ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFixingId(null);
                              setFixError("");
                            }}
                            className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-medium text-stone-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFixingId(r.id);
                            setFixError("");
                          }}
                          className="text-sm font-semibold text-gold-deep"
                        >
                          Fix check-out time →
                        </button>
                      )}
                      {fixError && fixingId === r.id && (
                        <p className="mt-2 text-xs font-medium text-red-600">{fixError}</p>
                      )}
                    </div>
                  )}
                  {missed && !canFix(r) && (
                    <p className="mt-2 text-xs text-stone-400">
                      Ask your manager to fix a missed check-out.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
        {error && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          Auto-exported to Google Sheets every day.
        </p>
      </main>
      <BottomNav />
    </>
  );
}
