"use client";

// Shared UI pieces matching the Figma "Final" page (charcoal + mustard gold).
// All copy is English. No Hinglish anywhere in the UI.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronLeft,
  ClipboardList,
  Home,
  Plus,
  User as UserIcon,
  Users,
} from "lucide-react";
import type { Task, TaskStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { formatDeadline, isOverdue } from "@/lib/utils";
import { compressImage, formatBytes } from "@/lib/compress";
import { useStore } from "@/lib/store";

// ---------------------------------------------------------------------------
// Progress ring (SVG donut segment — same look as the Figma screens)
// ---------------------------------------------------------------------------
export function ProgressRing({
  percent,
  size = 72,
  stroke = 7,
  color = "#D4A024",
  track = "#EDE8DC",
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-center font-bold text-charcoal" style={{ fontSize: size * 0.2 }}>
        {label ?? `${percent}%`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status + priority chips (colours fixed by the plan doc)
// ---------------------------------------------------------------------------
const STATUS_STYLE: Record<TaskStatus, string> = {
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  submitted: "bg-orange-100 text-orange-800",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-800",
};

export function StatusChip({ task }: { task: Task }) {
  const overdue = isOverdue(task.deadline, task.status === "completed");
  if (overdue) {
    return (
      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
        Overdue
      </span>
    );
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[task.status]}`}>
      {STATUS_LABEL[task.status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  Low: "bg-stone-100 text-stone-600",
  Normal: "bg-gold-light text-gold-deep",
  Urgent: "bg-red-100 text-red-700",
};

export function PriorityChip({ priority }: { priority: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[priority] ?? ""}`}>
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task card (used on dashboards + My Tasks)
// ---------------------------------------------------------------------------
export function TaskCard({ task, showTeam = true }: { task: Task; showTeam?: boolean }) {
  const store = useStore();
  const team = store.teams.find((t) => t.id === task.teamId);
  const assignee = store.users.find((u) => u.id === task.assigneeId);
  const overdue = isOverdue(task.deadline, task.status === "completed");
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug text-charcoal">{task.title}</h3>
        <StatusChip task={task} />
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-stone-500">{task.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {showTeam && team && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
            {team.name}
          </span>
        )}
        {assignee && <span className="text-xs text-stone-500">· {assignee.name}</span>}
        <PriorityChip priority={task.priority} />
      </div>
      <p className={`mt-2 text-xs font-medium ${overdue ? "text-red-600" : "text-stone-500"}`}>
        {formatDeadline(task.deadline)}
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// App header with notification bell
// ---------------------------------------------------------------------------
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const store = useStore();
  const unread = store.currentUser
    ? store.notifications.filter((n) => n.userId === store.currentUser!.id && !n.read).length
    : 0;
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-paper/95 px-5 pb-2 pt-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-bold leading-tight text-charcoal">{title}</h1>
        {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
      </div>
      <Link
        href="/notifications"
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-charcoal"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </Link>
    </header>
  );
}

export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-sm font-medium text-charcoal"
    >
      <ChevronLeft size={18} /> {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Bottom navigation (Home / My Tasks / + FAB / Team / Profile)
// ---------------------------------------------------------------------------
export function BottomNav() {
  const pathname = usePathname();
  const store = useStore();
  const user = store.currentUser;
  if (!user) return null;

  const homeHref = user.role === "admin" ? "/admin" : user.role === "manager" ? "/manager" : "/member";
  const canAssign = user.role === "admin" || user.role === "manager";

  const item = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href || (href === homeHref && pathname === "/dashboard");
    return (
      <Link
        href={href}
        className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${
          active ? "text-gold-deep" : "text-stone-400"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky bottom-0 z-20 border-t border-stone-200 bg-white px-2 pb-3 pt-1.5">
      <div className="flex items-end">
        {item(homeHref, "Home", <Home size={21} />)}
        {item("/tasks", "My Tasks", <ClipboardList size={21} />)}
        {canAssign ? (
          <Link
            href="/tasks/new"
            aria-label="Assign new task"
            className="mx-2 flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-charcoal text-gold shadow-lg"
          >
            <Plus size={24} />
          </Link>
        ) : (
          <span className="mx-2 h-12 w-12" />
        )}
        {item("/team", "Team", <Users size={21} />)}
        {item("/profile", "Profile", <UserIcon size={21} />)}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Photo picker — compresses to ~200 KB before accepting the photo
// ---------------------------------------------------------------------------
export function PhotoPicker({
  photos,
  onChange,
  maxPhotos = 3,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const remaining = maxPhotos - photos.length;
      const picked = Array.from(files).slice(0, Math.max(0, remaining));
      const compressed = await Promise.all(picked.map((f) => compressImage(f)));
      onChange([...photos, ...compressed.map((c) => c.dataUrl)]);
    } catch {
      setError("Could not read that photo. Please try another one.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo proof ${i + 1}`} className="h-24 w-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={busy || photos.length >= maxPhotos}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-stone-300 py-3 text-sm font-medium text-stone-600 disabled:opacity-50"
      >
        {busy ? "Compressing photo…" : photos.length >= maxPhotos ? `Maximum ${maxPhotos} photos` : "+ Add photo proof"}
      </button>
      <p className="mt-1 text-[11px] text-stone-400">
        Photos are compressed to about 200 KB before saving. {photos.length}/{maxPhotos} added.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center">
      <Check className="mx-auto mb-2 text-gold" size={24} />
      <p className="text-sm font-semibold text-charcoal">{title}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-stone-500">{children}</h2>;
}
