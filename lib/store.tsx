"use client";

// TeamTask — Supabase-backed data layer (Phase 2a).
// ---------------------------------------------------------------------------
// This is the ONE data-access module. Every screen reads and writes through
// the `useStore()` hook below — no page touches Supabase directly.
// It keeps the SAME interface as the Phase 1 mock (same state fields and
// function names) with two necessary changes:
//   * Everything is async now (Supabase is a network call), so the store
//     functions return Promises and screens await them.
//   * Auth is real: password login via Supabase Auth (phone -> pseudo-email,
//     see lib/supabase.ts). Demo passwords and the demo role switcher are
//     gone; roles come from the profiles table.
// Photos are compressed client-side to ~200 KB (lib/compress.ts, unchanged)
// and uploaded to the private "proofs" Storage bucket; the database stores
// Storage PATHS, and the app turns them into signed URLs for display.
// State lives in Supabase now — refreshing the page no longer resets data.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { signUpClient, phoneToEmail, supabase } from "./supabase";
import type {
  AppNotification,
  AttendanceRecord,
  NotificationKind,
  Priority,
  Role,
  Submission,
  Task,
  TaskStatus,
  Team,
  User,
} from "./types";
import { todayISTISO } from "./utils";

export interface AssignInput {
  title: string;
  description: string;
  teamId: string;
  assigneeId: string;
  deadline: string; // yyyy-mm-dd
  priority: Priority;
  /** Compressed (~200 KB) JPEG data URL, optional. Uploaded to Storage. */
  beforePhoto?: string;
}

export interface AddMemberInput {
  name: string;
  phone: string;
  teamId: string;
  /** Password the Admin sets once for the new member (min 6 characters). */
  password: string;
  role: "member" | "manager";
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: User;
}

interface StoreState {
  teams: Team[];
  users: User[];
  tasks: Task[];
  notifications: AppNotification[];
  currentUser: User | null;
  /** Today's attendance rows in the viewer's scope (RLS: member sees own,
   * manager own team, admin all). Refreshed on login and after check-in/out. */
  todayAttendance: AttendanceRecord[];
  /** True while today's attendance is being (re)loaded. */
  attendanceLoading: boolean;
}

interface StoreValue extends StoreState {
  /** True while the session is being restored on first load. Screens and
   * RequireAuth wait for this before deciding to redirect to /login. */
  authLoading: boolean;
  /** True while data is being (re)loaded from Supabase. */
  loading: boolean;
  /** Set when a signed-in user has no profile row (account not set up). */
  authError: string | null;
  // Auth (Supabase Auth, password only — no OTP)
  login: (phone: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  // Tasks
  assignTask: (input: AssignInput) => Promise<Task>;
  acceptTask: (taskId: string) => Promise<void>;
  submitTask: (taskId: string, note: string, photos: string[]) => Promise<void>;
  approveTask: (taskId: string, submissionId: string) => Promise<void>;
  rejectTask: (taskId: string, submissionId: string, reason: string) => Promise<void>;
  resubmitTask: (taskId: string, note: string, photos: string[]) => Promise<void>;
  // Members
  addMember: (input: AddMemberInput) => Promise<User>;
  // Attendance (check-in / check-out — records are NEVER deleted)
  getTodayAttendance: () => Promise<AttendanceRecord | null>;
  checkIn: () => Promise<AttendanceRecord>;
  checkOut: () => Promise<AttendanceRecord>;
  getTeamToday: () => Promise<AttendanceRecord[]>;
  getHistory: (userId: string, limit?: number) => Promise<AttendanceRecord[]>;
  fixCheckOut: (attendanceId: string, time: string) => Promise<void>;
  refreshTodayAttendance: () => Promise<void>;
  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Signed URLs stay valid 7 days — long enough for review, short enough
 * that a leaked link dies on its own. (The 30-day auto-delete policy
 * removes approved-task photos from Storage entirely.) */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

// --- Database row shapes (snake_case, as Supabase returns them) -------------
interface TeamRow {
  id: string;
  name: string;
  color: string;
  manager_id: string | null;
}
interface ProfileRow {
  id: string;
  name: string;
  phone: string;
  role: Role;
  team_id: string | null;
  is_active: boolean;
}
interface SubmissionRow {
  id: string;
  task_id: string;
  submitted_by: string;
  note: string;
  photo_paths: string[] | null;
  decision: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  submitted_at: string;
}
interface TaskRow {
  id: string;
  title: string;
  description: string;
  team_id: string;
  assignee_id: string;
  assigned_by_id: string;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  before_photo_path: string | null;
  created_at: string;
  submissions: SubmissionRow[] | null;
}
interface NotificationRow {
  id: string;
  user_id: string;
  kind: NotificationKind;
  task_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}
interface AttendanceRow {
  id: string;
  user_id: string;
  team_id: string | null;
  work_date: string;
  check_in_at: string;
  check_out_at: string | null;
  created_at: string;
}

// --- Row -> app-type mapping -------------------------------------------------
function mapTeam(row: TeamRow): Team {
  return { id: row.id, name: row.name, color: row.color, managerId: row.manager_id ?? "" };
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    teamId: row.team_id,
  };
}

function mapSubmission(row: SubmissionRow, urlByPath: Map<string, string>): Submission {
  return {
    id: row.id,
    taskId: row.task_id,
    note: row.note,
    photos: (row.photo_paths ?? [])
      .map((p) => urlByPath.get(p))
      .filter((u): u is string => Boolean(u)),
    submittedAt: row.submitted_at,
    decision: row.decision,
    rejectReason: row.reject_reason ?? undefined,
  };
}

function mapTask(row: TaskRow, urlByPath: Map<string, string>): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teamId: row.team_id,
    assigneeId: row.assignee_id,
    assignedById: row.assigned_by_id,
    deadline: row.deadline,
    priority: row.priority,
    status: row.status,
    beforePhoto: row.before_photo_path
      ? urlByPath.get(row.before_photo_path)
      : undefined,
    createdAt: row.created_at,
    submissions: (row.submissions ?? []).map((s) => mapSubmission(s, urlByPath)),
  };
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    taskId: row.task_id ?? undefined,
    message: row.message,
    createdAt: row.created_at,
    read: row.is_read,
  };
}

function mapAttendance(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    workDate: row.work_date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    createdAt: row.created_at,
  };
}

/** The single organisation (Ouroboros Art Hub) — seeded id in migration-001. */
const ORG_ID = "00000000-0000-0000-0000-000000000001";

// --- Storage helpers ---------------------------------------------------------
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Upload one compressed photo to the private "proofs" bucket. */
async function uploadProof(path: string, dataUrl: string): Promise<void> {
  const { error } = await supabase.storage
    .from("proofs")
    .upload(path, dataUrlToBlob(dataUrl), {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
}

/** Turn Storage paths into displayable signed URLs (one batch call). */
async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await supabase.storage
    .from("proofs")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return map;
  for (const item of data) {
    const url = item.signedUrl;
    const path = item.path;
    if (!item.error && url && path) map.set(path, url);
  }
  return map;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Refs mirror state for use inside stable callbacks (avoids stale closures).
  const currentUserRef = useRef<User | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const loadToken = useRef(0);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // --- Load everything for the signed-in user -------------------------------
  const loadAll = useCallback(async (userId: string) => {
    const token = ++loadToken.current;
    setLoading(true);
    try {
      const [teamsRes, usersRes, tasksRes, notifRes, attRes] = await Promise.all([
        supabase.from("teams").select("*").order("created_at"),
        supabase.from("profiles").select("*").order("name"),
        supabase
          .from("tasks")
          .select("*, submissions(*)")
          .order("created_at", { ascending: false })
          .order("submitted_at", { foreignTable: "submissions", ascending: true }),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        // Today's attendance — RLS scopes it: member sees own rows,
        // manager own team, admin all.
        supabase
          .from("attendance")
          .select("*")
          .eq("work_date", todayISTISO())
          .order("check_in_at", { ascending: true }),
      ]);
      if (token !== loadToken.current) return; // a newer load superseded this one
      if (teamsRes.error) throw teamsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (notifRes.error) throw notifRes.error;
      if (attRes.error) throw attRes.error;

      const taskRows = (tasksRes.data ?? []) as unknown as TaskRow[];
      const paths: string[] = [];
      for (const t of taskRows) {
        if (t.before_photo_path) paths.push(t.before_photo_path);
        for (const s of t.submissions ?? []) paths.push(...(s.photo_paths ?? []));
      }
      const urlByPath = await signUrls(paths);
      if (token !== loadToken.current) return;

      setTeams((teamsRes.data as unknown as TeamRow[]).map(mapTeam));
      setUsers((usersRes.data as unknown as ProfileRow[]).map(mapProfile));
      setTasks(taskRows.map((t) => mapTask(t, urlByPath)));
      setNotifications((notifRes.data as unknown as NotificationRow[]).map(mapNotification));
      setTodayAttendance((attRes.data as unknown as AttendanceRow[]).map(mapAttendance));
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, []);

  // --- Session bootstrap: restore the session, then load the profile --------
  const loadProfileFor = useCallback(
    async (authUserId: string): Promise<User | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUserId)
        .single();
      if (error || !data) return null;
      const profile = data as unknown as ProfileRow;
      if (!profile.is_active) return null;
      return mapProfile(profile);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    const handleSession = async (userId: string | null) => {
      if (!mounted) return;
      if (!userId) {
        setCurrentUser(null);
        setTeams([]);
        setUsers([]);
        setTasks([]);
        setNotifications([]);
        setTodayAttendance([]);
        setAuthError(null);
        setAuthLoading(false);
        return;
      }
      const profile = await loadProfileFor(userId);
      if (!mounted) return;
      if (!profile) {
        // Signed in but no profile row (account not set up yet) — sign out
        // so the app does not sit in a half-logged-in state.
        setAuthError("No profile found for this account. Ask your Admin to set up your account.");
        await supabase.auth.signOut();
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }
      setAuthError(null);
      setCurrentUser(profile);
      setAuthLoading(false);
      await loadAll(profile.id);
    };

    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session?.user.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAll, loadProfileFor]);

  // --- Helpers: notifications + activity log (best-effort — a failure here
  // must never break the task flow itself) ------------------------------------
  const insertNotification = useCallback(
    async (userId: string, kind: NotificationKind, message: string, taskId?: string) => {
      try {
        const { error } = await supabase.from("notifications").insert({
          user_id: userId,
          kind,
          task_id: taskId ?? null,
          message,
        });
        if (error) console.warn("Notification insert failed:", error.message);
      } catch (e) {
        console.warn("Notification insert failed:", e);
      }
    },
    [],
  );

  const notifyAdminsAndManager = useCallback(
    async (task: Task, kind: NotificationKind, message: string) => {
      const me = currentUserRef.current;
      const team = teams.find((t) => t.id === task.teamId);
      const recipients = new Set<string>();
      if (team?.managerId) recipients.add(team.managerId);
      for (const u of users) if (u.role === "admin") recipients.add(u.id);
      if (me) recipients.delete(me.id);
      await Promise.all(
        [...recipients].map((id) => insertNotification(id, kind, message, task.id)),
      );
    },
    [insertNotification, teams, users],
  );

  const logActivity = useCallback(
    async (taskId: string | null, action: string, detail: string) => {
      const me = currentUserRef.current;
      if (!me) return;
      try {
        const { error } = await supabase.from("activity_log").insert({
          task_id: taskId,
          actor_id: me.id,
          action,
          detail,
        });
        if (error) console.warn("Activity log insert failed:", error.message);
      } catch (e) {
        console.warn("Activity log insert failed:", e);
      }
    },
    [],
  );

  // --- Auth ------------------------------------------------------------------
  const login = useCallback(
    async (phone: string, password: string): Promise<LoginResult> => {
      const email = phoneToEmail(phone);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        if (error?.message?.includes("Email not confirmed")) {
          return {
            ok: false,
            error:
              "This account is not confirmed yet. Ask your Admin to turn off email confirmation in Supabase.",
          };
        }
        if (
          error?.message?.includes("fetch failed") ||
          error?.message?.includes("Failed to fetch") ||
          error?.message?.includes("NetworkError") ||
          error?.message?.includes("Network request failed")
        ) {
          return {
            ok: false,
            error: "Could not reach the server. Check your internet connection and try again.",
          };
        }
        return { ok: false, error: "Wrong phone number or password. Please try again." };
      }
      const profile = await loadProfileFor(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return {
          ok: false,
          error: "Account found, but no profile exists. Ask your Admin to set up your account.",
        };
      }
      setAuthError(null);
      setCurrentUser(profile);
      await loadAll(profile.id);
      return { ok: true, user: profile };
    },
    [loadAll, loadProfileFor],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setTeams([]);
    setUsers([]);
    setTasks([]);
    setNotifications([]);
    setTodayAttendance([]);
  }, []);

  // --- Tasks -----------------------------------------------------------------
  const assignTask = useCallback(
    async (input: AssignInput): Promise<Task> => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title.trim(),
          description: input.description.trim(),
          team_id: input.teamId,
          assignee_id: input.assigneeId,
          assigned_by_id: me.id,
          deadline: input.deadline,
          priority: input.priority,
          status: "assigned",
        })
        .select()
        .single();
      if (error || !data) {
        throw new Error(`Could not assign the task: ${error?.message ?? "unknown error"}`);
      }
      const row = data as unknown as TaskRow;
      let beforePhoto: string | undefined;
      if (input.beforePhoto) {
        const path = `${input.teamId}/${row.id}/before.jpg`;
        await uploadProof(path, input.beforePhoto);
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ before_photo_path: path })
          .eq("id", row.id);
        if (updateError) throw new Error(`Task saved but before-photo could not be saved: ${updateError.message}`);
        const urls = await signUrls([path]);
        beforePhoto = urls.get(path);
      }
      await insertNotification(
        input.assigneeId,
        "assigned",
        `You have been assigned a new task: ${row.title}.`,
        row.id,
      );
      await logActivity(row.id, "assigned", `Assigned “${row.title}”`);
      await loadAll(me.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        teamId: row.team_id,
        assigneeId: row.assignee_id,
        assignedById: row.assigned_by_id,
        deadline: row.deadline,
        priority: row.priority,
        status: "assigned",
        beforePhoto,
        createdAt: row.created_at,
        submissions: [],
      };
    },
    [insertNotification, loadAll, logActivity],
  );

  const acceptTask = useCallback(
    async (taskId: string) => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      const { error } = await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", taskId)
        .eq("assignee_id", me.id)
        .eq("status", "assigned");
      if (error) throw new Error(`Could not start the task: ${error.message}`);
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (task) await logActivity(taskId, "accepted", `Started “${task.title}”`);
      await loadAll(me.id);
    },
    [loadAll, logActivity],
  );

  const submitTaskInternal = useCallback(
    async (taskId: string, note: string, photos: string[], action: "submitted" | "resubmitted") => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found. It may have been removed.");
      if (photos.length === 0) {
        throw new Error("Please add at least one photo as proof before submitting.");
      }
      const submissionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const path = `${task.teamId}/${taskId}/${submissionId}_${i}.jpg`;
        await uploadProof(path, photos[i]);
        paths.push(path);
      }
      const { error } = await supabase.from("submissions").insert({
        id: submissionId,
        task_id: taskId,
        submitted_by: me.id,
        note: note.trim(),
        photo_paths: paths,
        decision: "pending",
      });
      if (error) {
        throw new Error(`Could not submit the task: ${error.message}`);
      }
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "submitted" })
        .eq("id", taskId);
      if (taskError) throw new Error(`Submitted, but the task status could not be updated: ${taskError.message}`);
      const verb = action === "resubmitted" ? "resubmitted" : "submitted";
      await notifyAdminsAndManager(
        task,
        "submitted",
        `${me.name} ${verb} “${task.title}” for approval.`,
      );
      await logActivity(taskId, action, `${verb === "resubmitted" ? "Resubmitted" : "Submitted"} “${task.title}”`);
      await loadAll(me.id);
    },
    [loadAll, logActivity, notifyAdminsAndManager],
  );

  const submitTask = useCallback(
    (taskId: string, note: string, photos: string[]) =>
      submitTaskInternal(taskId, note, photos, "submitted"),
    [submitTaskInternal],
  );

  const resubmitTask = useCallback(
    (taskId: string, note: string, photos: string[]) =>
      submitTaskInternal(taskId, note, photos, "resubmitted"),
    [submitTaskInternal],
  );

  const approveTask = useCallback(
    async (taskId: string, submissionId: string) => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      const task = tasksRef.current.find((t) => t.id === taskId);
      const { error } = await supabase
        .from("submissions")
        .update({ decision: "approved", decided_at: new Date().toISOString() })
        .eq("id", submissionId);
      if (error) throw new Error(`Could not approve: ${error.message}`);
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskId);
      if (taskError) throw new Error(`Approved, but the task status could not be updated: ${taskError.message}`);
      if (task) {
        await insertNotification(
          task.assigneeId,
          "approved",
          `Your task “${task.title}” was approved. Well done!`,
          task.id,
        );
        await logActivity(taskId, "approved", `Approved “${task.title}”`);
      }
      await loadAll(me.id);
    },
    [insertNotification, loadAll, logActivity],
  );

  const rejectTask = useCallback(
    async (taskId: string, submissionId: string, reason: string) => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      const task = tasksRef.current.find((t) => t.id === taskId);
      const { error } = await supabase
        .from("submissions")
        .update({
          decision: "rejected",
          reject_reason: reason.trim(),
          decided_at: new Date().toISOString(),
        })
        .eq("id", submissionId);
      if (error) throw new Error(`Could not reject: ${error.message}`);
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "rejected" })
        .eq("id", taskId);
      if (taskError) throw new Error(`Rejected, but the task status could not be updated: ${taskError.message}`);
      if (task) {
        await insertNotification(
          task.assigneeId,
          "rejected",
          `Your task “${task.title}” was rejected. Reason: ${reason.trim()}`,
          task.id,
        );
        await logActivity(taskId, "rejected", `Rejected “${task.title}”: ${reason.trim()}`);
      }
      await loadAll(me.id);
    },
    [insertNotification, loadAll, logActivity],
  );

  // --- Members ---------------------------------------------------------------
  const addMember = useCallback(
    async (input: AddMemberInput): Promise<User> => {
      const me = currentUserRef.current;
      if (!me || (me.role !== "admin" && me.role !== "manager")) {
        throw new Error("Only Admin or Manager can add members.");
      }
      if (me.role === "manager" && input.teamId !== me.teamId) {
        throw new Error("Managers can only add members to their own team.");
      }
      if (input.password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      // signUp runs on a separate client that never stores a session, so
      // creating an account does NOT log the Admin out.
      const email = phoneToEmail(input.phone);
      const { data, error } = await signUpClient.auth.signUp({
        email,
        password: input.password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          throw new Error("A user with this phone number already exists.");
        }
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error("Could not create the account. Please try again.");
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          name: input.name.trim(),
          phone: input.phone.trim(),
          role: input.role,
          team_id: input.teamId,
          is_active: true,
        })
        .select()
        .single();
      if (profileError || !profile) {
        throw new Error(
          `Account created, but the profile could not be saved: ${profileError?.message ?? "unknown error"}`,
        );
      }
      const created = mapProfile(profile as unknown as ProfileRow);
      if (input.role === "manager") {
        await supabase.from("teams").update({ manager_id: created.id }).eq("id", input.teamId);
      }
      await logActivity(null, "member_added", `${created.name} joined the team.`);
      await loadAll(me.id);
      return created;
    },
    [loadAll, logActivity],
  );

  // --- Attendance (check-in / check-out) -------------------------------------
  // Records are NEVER deleted: there is no delete function, no delete
  // grant and no delete policy (migration-002). All queries go through the
  // normal client, so RLS scopes every read/write (member: own rows,
  // manager: own team, admin: all).
  const fetchTodayRows = useCallback(async (): Promise<AttendanceRecord[]> => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("work_date", todayISTISO())
      .order("check_in_at", { ascending: true });
    if (error) throw error;
    const rows = (data as unknown as AttendanceRow[]).map(mapAttendance);
    setTodayAttendance(rows);
    return rows;
  }, []);

  const refreshTodayAttendance = useCallback(async () => {
    const me = currentUserRef.current;
    if (!me) return;
    setAttendanceLoading(true);
    try {
      await fetchTodayRows();
    } catch (e) {
      console.warn("Attendance load failed:", e);
    } finally {
      setAttendanceLoading(false);
    }
  }, [fetchTodayRows]);

  const getTodayAttendance = useCallback(async (): Promise<AttendanceRecord | null> => {
    const me = currentUserRef.current;
    if (!me) return null;
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", me.id)
      .eq("work_date", todayISTISO())
      .maybeSingle();
    if (error || !data) return null;
    return mapAttendance(data as unknown as AttendanceRow);
  }, []);

  const checkIn = useCallback(async (): Promise<AttendanceRecord> => {
    const me = currentUserRef.current;
    if (!me) throw new Error("Please log in again.");
    const { data, error } = await supabase
      .from("attendance")
      .insert({
        user_id: me.id,
        organisation_id: ORG_ID,
        team_id: me.teamId,
        work_date: todayISTISO(),
        check_in_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // Unique (user_id, work_date): already checked in today — return it.
      if (error.code === "23505") {
        const existing = await getTodayAttendance();
        if (existing) return existing;
      }
      throw new Error(`Could not check in: ${error.message}`);
    }
    const record = mapAttendance(data as unknown as AttendanceRow);
    await refreshTodayAttendance();
    return record;
  }, [getTodayAttendance, refreshTodayAttendance]);

  const checkOut = useCallback(async (): Promise<AttendanceRecord> => {
    const me = currentUserRef.current;
    if (!me) throw new Error("Please log in again.");
    const { data, error } = await supabase
      .from("attendance")
      .update({ check_out_at: new Date().toISOString() })
      .eq("user_id", me.id)
      .eq("work_date", todayISTISO())
      .is("check_out_at", null)
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `Could not check out: ${error?.message ?? "no open check-in found for today"}`,
      );
    }
    const record = mapAttendance(data as unknown as AttendanceRow);
    await refreshTodayAttendance();
    return record;
  }, [refreshTodayAttendance]);

  const getTeamToday = useCallback(async (): Promise<AttendanceRecord[]> => {
    try {
      return await fetchTodayRows();
    } catch (e) {
      throw new Error(
        `Could not load today's attendance: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    }
  }, [fetchTodayRows]);

  const getHistory = useCallback(
    async (userId: string, limit = 60): Promise<AttendanceRecord[]> => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .order("work_date", { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(`Could not load attendance history: ${error.message}`);
      }
      return (data as unknown as AttendanceRow[]).map(mapAttendance);
    },
    [],
  );

  /** Manager (own team) or Admin sets a missed check-out time ("HH:MM", IST). */
  const fixCheckOut = useCallback(
    async (attendanceId: string, time: string): Promise<void> => {
      const me = currentUserRef.current;
      if (!me) throw new Error("Please log in again.");
      if (!/^\d{2}:\d{2}$/.test(time)) {
        throw new Error("Please pick a check-out time.");
      }
      const { data, error } = await supabase
        .from("attendance")
        .select("work_date, check_in_at")
        .eq("id", attendanceId)
        .single();
      if (error || !data) {
        throw new Error(
          `Could not find that attendance record: ${error?.message ?? "unknown error"}`,
        );
      }
      const row = data as { work_date: string; check_in_at: string };
      const checkOutAt = `${row.work_date}T${time}:00+05:30`;
      if (new Date(checkOutAt).getTime() <= new Date(row.check_in_at).getTime()) {
        throw new Error("Check-out time must be after the check-in time.");
      }
      const { error: updateError } = await supabase
        .from("attendance")
        .update({ check_out_at: checkOutAt })
        .eq("id", attendanceId);
      if (updateError) {
        throw new Error(`Could not save the check-out time: ${updateError.message}`);
      }
      await refreshTodayAttendance();
    },
    [refreshTodayAttendance],
  );

  // --- Notifications ---------------------------------------------------------
  const markNotificationRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw new Error(`Could not mark as read: ${error.message}`);
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const me = currentUserRef.current;
    if (!me) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", me.id)
      .eq("is_read", false);
    if (error) throw new Error(`Could not mark all as read: ${error.message}`);
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
  }, []);

  const value: StoreValue = {
    teams,
    users,
    tasks,
    notifications,
    currentUser,
    todayAttendance,
    attendanceLoading,
    authLoading,
    loading,
    authError,
    login,
    logout,
    assignTask,
    acceptTask,
    submitTask,
    approveTask,
    rejectTask,
    resubmitTask,
    addMember,
    getTodayAttendance,
    checkIn,
    checkOut,
    getTeamToday,
    getHistory,
    fixCheckOut,
    refreshTodayAttendance,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>.");
  return ctx;
}
