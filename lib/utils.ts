// Small date / id helpers. Dates are computed relative to "today" at runtime
// so the seeded overdue / due-soon demo data always behaves correctly.

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysFromToday(isoDate: string): number {
  const today = new Date(`${todayISO()}T12:00:00`);
  const d = new Date(`${isoDate}T12:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function formatDeadline(isoDate: string): string {
  const diff = daysFromToday(isoDate);
  const d = new Date(`${isoDate}T12:00:00`);
  const label = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (diff < 0) return `${label} · ${Math.abs(diff)}d overdue`;
  if (diff === 0) return `${label} · Due today`;
  if (diff === 1) return `${label} · Due tomorrow`;
  return `${label} · in ${diff}d`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} · ${formatTime(iso)}`;
}

/** A task is overdue when its deadline has passed and it is not completed. */
export function isOverdue(deadlineISO: string, completed: boolean): boolean {
  return !completed && daysFromToday(deadlineISO) < 0;
}

/** Due within the next 24 hours and not finished yet. */
export function isDueSoon(deadlineISO: string, completed: boolean): boolean {
  if (completed) return false;
  const diff = daysFromToday(deadlineISO);
  return diff === 0 || diff === 1;
}
