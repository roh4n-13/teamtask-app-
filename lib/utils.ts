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

// --- Attendance helpers (Asia/Kolkata) -------------------------------------
// Attendance dates and times are always Asia/Kolkata, regardless of the
// device timezone — the centre is in Ahmedabad and the records must line
// up with the centre's day, not a phone's clock setting.
const IST_TIMEZONE = "Asia/Kolkata";

/** Today's date (yyyy-mm-dd) in Asia/Kolkata. */
export function todayISTISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "10:02 AM" in Asia/Kolkata. */
export function formatTimeIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Tue 17 Nov 2026" in Asia/Kolkata. */
export function formatDateIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Tue 17 Nov" for a yyyy-mm-dd date. */
export function formatDayIST(dateISO: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateISO}T12:00:00+05:30`));
}

/** Minutes between two ISO timestamps. */
export function minutesBetween(startISO: string, endISO: string): number {
  return Math.max(0, Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000));
}

/** "8h 28m" / "2h 14m". */
export function formatHours(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Monday (yyyy-mm-dd) of the week containing the given yyyy-mm-dd date.
 * Computed on UTC fields of the +05:30-anchored date, so the result is
 * correct no matter what timezone the device is set to. */
export function mondayISTISO(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00+05:30`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
