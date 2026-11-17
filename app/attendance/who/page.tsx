"use client";

// Attendance — Who's Here Today: live list of who is at the centre.
// Manager sees their own team; Admin sees all teams. Members cannot see
// other people's rows (RLS), so they get a note instead.
// Figma: Who's Here Today screen (Final 10).

import { useEffect, useMemo } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, AttendanceTabs, BottomNav } from "@/components/ui";
import { useStore } from "@/lib/store";
import { avatarPlaceholder } from "@/lib/placeholders";
import { formatDateIST, formatTimeIST, todayISTISO } from "@/lib/utils";

export default function WhosHerePage() {
  return (
    <RequireAuth>
      <WhosHereInner />
    </RequireAuth>
  );
}

function WhosHereInner() {
  const store = useStore();
  const { refreshTodayAttendance } = store;
  const user = store.currentUser!;
  const today = todayISTISO();

  useEffect(() => {
    void refreshTodayAttendance();
  }, [refreshTodayAttendance]);

  // Roster: team members + managers in the viewer's scope (not Admins).
  const roster = useMemo(() => {
    const inScope =
      user.role === "admin"
        ? store.users
        : store.users.filter((u) => u.teamId === user.teamId);
    return inScope
      .filter((u) => u.role === "member" || u.role === "manager")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.users, user.role, user.teamId]);

  type RowStatus = "here" | "left" | "not-arrived";
  const rows = useMemo(() => {
    const list = roster.map((u) => {
      const rec = store.todayAttendance.find((r) => r.userId === u.id);
      const status: RowStatus = !rec ? "not-arrived" : rec.checkOutAt ? "left" : "here";
      return { user: u, rec, status };
    });
    const order: Record<RowStatus, number> = { here: 0, left: 1, "not-arrived": 2 };
    return list.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (a.status === "here" && b.status === "here")
        return (a.rec?.checkInAt ?? "").localeCompare(b.rec?.checkInAt ?? "");
      if (a.status === "left" && b.status === "left")
        return (b.rec?.checkOutAt ?? "").localeCompare(a.rec?.checkOutAt ?? "");
      return a.user.name.localeCompare(b.user.name);
    });
  }, [roster, store.todayAttendance]);

  const hereCount = rows.filter((r) => r.status === "here").length;
  const leftCount = rows.filter((r) => r.status === "left").length;
  const notArrivedCount = rows.filter((r) => r.status === "not-arrived").length;

  return (
    <>
      <AppHeader title="Who's Here Today" subtitle={formatDateIST(today)} />
      <main className="flex-1 px-5 pb-6">
        <AttendanceTabs active="who" showWho={user.role !== "member"} />

        {user.role === "member" ? (
          <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-500">
            Only managers and Admin can see who's here today.
          </p>
        ) : (
          <>
            {/* Count chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-green-100 px-3.5 py-1.5 text-xs font-bold text-green-800">
                Here now {hereCount}
              </span>
              <span className="rounded-full bg-stone-200 px-3.5 py-1.5 text-xs font-bold text-stone-600">
                Left {leftCount}
              </span>
              <span className="rounded-full bg-gold-light px-3.5 py-1.5 text-xs font-bold text-gold-deep">
                Not arrived {notArrivedCount}
              </span>
            </div>

            {/* Member rows */}
            <div className="mt-3 space-y-2">
              {rows.length === 0 ? (
                <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-500">
                  No team members yet.
                </p>
              ) : (
                rows.map(({ user: u, rec, status }) => {
                  const team = store.teams.find((t) => t.id === u.teamId);
                  const initials = u.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("");
                  return (
                    <Link
                      key={u.id}
                      href={`/attendance/history?user=${u.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarPlaceholder(initials)} alt="" className="h-11 w-11 rounded-full" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-charcoal">{u.name}</span>
                        <span className="block text-xs text-stone-500">
                          {team?.name ?? "—"}
                          {u.role === "manager" ? " · Manager" : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold text-charcoal">
                          {rec ? formatTimeIST(rec.checkInAt) : "—"}
                        </span>
                        {status === "here" ? (
                          <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-800">
                            Here
                          </span>
                        ) : status === "left" ? (
                          <span className="mt-0.5 inline-block rounded-full bg-stone-200 px-2.5 py-0.5 text-[11px] font-bold text-stone-600">
                            Left • {rec?.checkOutAt ? formatTimeIST(rec.checkOutAt) : ""}
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block rounded-full bg-gold-light px-2.5 py-0.5 text-[11px] font-bold text-gold-deep">
                            Not arrived
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>

            <p className="mt-4 text-center text-xs text-stone-400">
              Showing {rows.length} of {roster.length} members
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}
