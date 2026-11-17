// TeamTask — shared types.
// Phase 1 uses a mock data layer (see lib/store.tsx). When Supabase lands,
// these types map 1:1 to the PostgreSQL tables in the plan doc
// (teams, users, tasks, submissions, notifications, activity_log).

export type Role = "admin" | "manager" | "member";

export type TaskStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "rejected"
  | "completed";

export type Priority = "Low" | "Normal" | "Urgent";

export interface Team {
  id: string;
  name: string;
  /** Ring / accent colour for this team (from the Figma design). */
  color: string;
  managerId: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  /** Null for Admin (all teams). */
  teamId: string | null;
}

export interface Submission {
  id: string;
  taskId: string;
  note: string;
  /** Compressed (~200 KB) JPEG data URLs. Local blobs in Phase 1. */
  photos: string[];
  submittedAt: string; // ISO
  decision: "pending" | "approved" | "rejected";
  rejectReason?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  teamId: string;
  assigneeId: string;
  assignedById: string;
  deadline: string; // ISO date (yyyy-mm-dd)
  priority: Priority;
  status: TaskStatus;
  /** Optional "before" photo (placeholder in Phase 1). */
  beforePhoto?: string;
  createdAt: string; // ISO
  submissions: Submission[];
}

export type NotificationKind =
  | "assigned"
  | "submitted"
  | "approved"
  | "rejected"
  | "deadline"
  | "overdue";

export interface AppNotification {
  id: string;
  userId: string; // recipient
  kind: NotificationKind;
  taskId?: string;
  message: string;
  createdAt: string; // ISO
  read: boolean;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  assigned: "To Do",
  in_progress: "In Progress",
  submitted: "Submitted",
  rejected: "Rejected",
  completed: "Completed",
};

export const STATUS_ORDER: TaskStatus[] = [
  "assigned",
  "in_progress",
  "submitted",
  "rejected",
  "completed",
];

/**
 * One attendance row = one person, one day.
 * checkOutAt is null until the member checks out (null = missed check-out).
 * Rows are NEVER deleted (see supabase/migration-002.sql).
 */
export interface AttendanceRecord {
  id: string;
  userId: string;
  teamId: string | null;
  workDate: string; // yyyy-mm-dd (Asia/Kolkata)
  checkInAt: string; // ISO
  checkOutAt: string | null; // ISO, null = missed check-out
  createdAt: string; // ISO
}
