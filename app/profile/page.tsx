"use client";

// Profile — user card, menu, Log Out.
// Figma: Rohan card, menu rows (My Tasks / Notifications / Teams /
// Settings / Help & Support), red Log Out button.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, ClipboardList, Clock, HelpCircle, LogOut, Users } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";
import { AppHeader, BottomNav } from "@/components/ui";
import { useStore } from "@/lib/store";
import { avatarPlaceholder } from "@/lib/placeholders";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const store = useStore();
  const router = useRouter();
  const user = store.currentUser!;
  const team = store.teams.find((t) => t.id === user.teamId);

  const roleLabel =
    user.role === "admin" ? "Admin · All Teams" : user.role === "manager" ? `Manager · ${team?.name ?? ""} Team` : `Member · ${team?.name ?? ""} Team`;

  const initials = user.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  const menuRow = (href: string, icon: React.ReactNode, label: string) => (
    <Link href={href} className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5 last:border-0">
      <span className="text-charcoal">{icon}</span>
      <span className="flex-1 text-sm font-medium text-charcoal">{label}</span>
      <ChevronRight size={17} className="text-stone-400" />
    </Link>
  );

  return (
    <>
      <AppHeader title="Profile" />
      <main className="flex-1 px-5 pb-6">
        {/* User card */}
        <div className="mt-2 flex items-center gap-4 rounded-3xl bg-charcoal p-5 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarPlaceholder(initials)} alt="" className="h-16 w-16 rounded-full border-2 border-gold" />
          <div>
            <p className="text-lg font-bold">{user.name}</p>
            <p className="text-xs text-gold">{roleLabel}</p>
            <p className="mt-0.5 text-xs text-stone-400">{user.phone}</p>
          </div>
        </div>

        {/* Menu */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {menuRow("/tasks", <ClipboardList size={19} />, "My Tasks")}
          {menuRow("/notifications", <Bell size={19} />, "Notifications")}
          {menuRow("/team", <Users size={19} />, "Teams")}
          {menuRow("/attendance", <Clock size={19} />, "Attendance")}
          <Link href="/notifications" className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-charcoal"><HelpCircle size={19} /></span>
            <span className="flex-1 text-sm font-medium text-charcoal">Help &amp; Support</span>
            <ChevronRight size={17} className="text-stone-400" />
          </Link>
        </div>

        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs leading-relaxed text-stone-500">
          Help &amp; Support: ask your Admin (Rohan) if the app misbehaves or you forget your password. Only the Admin can reset passwords.
        </p>

        <button
          onClick={async () => {
            await store.logout();
            router.replace("/login");
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-crimson py-3.5 text-[15px] font-semibold text-white"
        >
          <LogOut size={17} />
          Log Out
        </button>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          TeamTask · Ouroboros Art Hub
        </p>
      </main>
      <BottomNav />
    </>
  );
}
