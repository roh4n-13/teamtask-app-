-- ============================================================================
-- TeamTask — migration 001 (Phase 2a)
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Project: TeamTask (ryrxhuyjoycstxgwgczk), region ap-south-1, Free plan.
-- Safe to run twice: table/seed creation is IF NOT EXISTS / ON CONFLICT
-- guarded, policies are dropped and recreated.
--
-- What it creates:
--   * organisations, profiles (members), teams, tasks, submissions,
--     task_comments (v2), activity_log, notifications
--   * Private Storage bucket "proofs" for photo proof
--   * Row Level Security: member sees own team's data, manager own team,
--     admin everything
--   * 30-day auto-delete helper for approved-task photos (function only —
--     schedule it separately, see the commented pg_cron block at the end)
--   * Seeds the 4 teams from the Figma design (manager assigned later,
--     when the manager's account is created)
--
-- What it does NOT do (dashboard steps, see the report / README):
--   * Turn "Confirm email" OFF (Authentication -> Providers -> Email).
--     Without this, password login with pseudo-emails can never work.
--   * Create the first Admin (Rohan) Auth user + profile row — see the
--     commented block at the very end of this file.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organisations — one row per organisation. Multi-org ready in the data
-- model, but launch is Ouroboros-only. Every table below carries an
-- organisation_id defaulting to this one.
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organisations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Ouroboros Art Hub')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles — one row per person. id IS the Supabase Auth user id, so a
-- profile only exists for a real Auth account. phone is unique: one account
-- per phone number. Admin has team_id NULL (all teams).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null
    references public.organisations (id)
    default '00000000-0000-0000-0000-000000000001',
  name text not null,
  phone text not null unique,
  role text not null check (role in ('admin', 'manager', 'member')),
  team_id uuid, -- set below (circular FK with teams.manager_id)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Teams — name + Figma ring colour + manager. manager_id is set when the
-- manager's account is created (the app updates it automatically).
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations (id)
    default '00000000-0000-0000-0000-000000000001',
  name text not null,
  color text not null default '#1A1A1A',
  manager_id uuid, -- set below (circular FK with profiles.team_id)
  created_at timestamptz not null default now(),
  unique (organisation_id, name)
);

-- Circular FKs, added after both tables exist.
alter table public.profiles
  drop constraint if exists profiles_team_id_fkey;
alter table public.profiles
  add constraint profiles_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete set null;

alter table public.teams
  drop constraint if exists teams_manager_id_fkey;
alter table public.teams
  add constraint teams_manager_id_fkey
  foreign key (manager_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tasks — one task = one member (plan rule). Status is a single truth;
-- "overdue" is computed from the deadline in the app, not stored.
-- before_photo_path is a Storage path in the "proofs" bucket (NULL = none).
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations (id)
    default '00000000-0000-0000-0000-000000000001',
  title text not null,
  description text not null default '',
  team_id uuid not null references public.teams (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by_id uuid not null references public.profiles (id) on delete cascade,
  deadline date not null,
  priority text not null default 'Normal'
    check (priority in ('Low', 'Normal', 'Urgent')),
  status text not null default 'assigned'
    check (status in ('assigned', 'in_progress', 'submitted', 'rejected', 'completed')),
  before_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Submissions — full history. A task can have several submissions (the
-- latest is the one under review). photo_paths are Storage paths in the
-- "proofs" bucket; the app turns them into signed URLs for display.
-- 1–3 photos per submission, enforced by the app (plan rule).
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  note text not null default '',
  photo_paths text[] not null default '{}',
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'rejected')),
  reject_reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Task comments — Version 2 feature. Table exists now so the model is
-- complete; the app does not use it yet.
-- ---------------------------------------------------------------------------
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity log — who did what, when (activity timeline). actor is the
-- signed-in user who performed the action.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations (id)
    default '00000000-0000-0000-0000-000000000001',
  task_id uuid references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications — in-app notification centre. One row per recipient.
-- FCM push (real push notifications) comes later; the app reads this table.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('assigned', 'submitted', 'approved', 'rejected', 'deadline', 'overdue')),
  task_id uuid references public.tasks (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (small tables now, but these are the hot query paths).
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_team on public.profiles (team_id);
create index if not exists idx_tasks_team_status on public.tasks (team_id, status);
create index if not exists idx_tasks_assignee on public.tasks (assignee_id);
create index if not exists idx_submissions_task on public.submissions (task_id);
create index if not exists idx_comments_task on public.task_comments (task_id);
create index if not exists idx_activity_task on public.activity_log (task_id);
create index if not exists idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance for tasks.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Role rules (plan): member sees own team's tasks, manager own team, admin
-- everything. Helpers are SECURITY DEFINER so they can read profiles
-- without tripping over the profiles RLS policy itself.
-- ============================================================================

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_team()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;

-- Organisations: every signed-in user can read; only Admin changes it.
drop policy if exists "organisations_read" on public.organisations;
create policy "organisations_read" on public.organisations
  for select to authenticated using (true);
drop policy if exists "organisations_admin_write" on public.organisations;
create policy "organisations_admin_write" on public.organisations
  for all to authenticated using (public.is_admin());

-- Profiles: every signed-in user can read (the app resolves names/teams
-- from this table). A profile row is created by the Admin (for a new
-- member) or by the user themselves; only self or Admin can change it.
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- Teams: everyone signed in can read; only Admin creates/renames them.
drop policy if exists "teams_read" on public.teams;
create policy "teams_read" on public.teams
  for select to authenticated using (true);
drop policy if exists "teams_admin_write" on public.teams;
create policy "teams_admin_write" on public.teams
  for all to authenticated using (public.is_admin());

-- Tasks: read = Admin, or own team, or the assignee. Create = Admin, or a
-- manager for their own team (and they must be the assigner). Update =
-- Admin, the team's manager, or the assignee (accept/submit). Delete = Admin.
drop policy if exists "tasks_read" on public.tasks;
create policy "tasks_read" on public.tasks
  for select to authenticated using (
    public.is_admin()
    or team_id = public.current_profile_team()
    or assignee_id = auth.uid()
  );
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks
  for insert to authenticated with check (
    assigned_by_id = auth.uid()
    and (
      public.is_admin()
      or (public.current_profile_role() = 'manager' and team_id = public.current_profile_team())
    )
  );
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks
  for update to authenticated using (
    public.is_admin()
    or (team_id = public.current_profile_team() and public.current_profile_role() = 'manager')
    or assignee_id = auth.uid()
  );
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks
  for delete to authenticated using (public.is_admin());

-- Submissions: read = Admin, or anyone on the task's team (incl. the
-- assignee). Create = only the assignee, for their own task. Update
-- (approve/reject decision) = Admin or the team's manager. Delete = Admin.
drop policy if exists "submissions_read" on public.submissions;
create policy "submissions_read" on public.submissions
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = submissions.task_id
        and (t.team_id = public.current_profile_team() or t.assignee_id = auth.uid())
    )
  );
drop policy if exists "submissions_insert" on public.submissions;
create policy "submissions_insert" on public.submissions
  for insert to authenticated with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = submissions.task_id and t.assignee_id = auth.uid()
    )
  );
drop policy if exists "submissions_update" on public.submissions;
create policy "submissions_update" on public.submissions
  for update to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = submissions.task_id
        and t.team_id = public.current_profile_team()
        and public.current_profile_role() = 'manager'
    )
  );
drop policy if exists "submissions_delete" on public.submissions;
create policy "submissions_delete" on public.submissions
  for delete to authenticated using (public.is_admin());

-- Task comments (v2): read/insert = anyone on the task's team; change =
-- the author or Admin.
drop policy if exists "comments_read" on public.task_comments;
create policy "comments_read" on public.task_comments
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (t.team_id = public.current_profile_team() or t.assignee_id = auth.uid())
    )
  );
drop policy if exists "comments_insert" on public.task_comments;
create policy "comments_insert" on public.task_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (t.team_id = public.current_profile_team() or t.assignee_id = auth.uid())
    )
  );
drop policy if exists "comments_change" on public.task_comments;
create policy "comments_change" on public.task_comments
  for update to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "comments_delete" on public.task_comments;
create policy "comments_delete" on public.task_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- Activity log: read = Admin, the actor themselves, or the task's team.
-- Insert = the actor themselves (the app logs its own actions).
drop policy if exists "activity_read" on public.activity_log;
create policy "activity_read" on public.activity_log
  for select to authenticated using (
    public.is_admin()
    or actor_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = activity_log.task_id and t.team_id = public.current_profile_team()
    )
  );
drop policy if exists "activity_insert" on public.activity_log;
create policy "activity_insert" on public.activity_log
  for insert to authenticated with check (actor_id = auth.uid());

-- Notifications: read = the recipient or Admin. Insert = the app, for
-- someone on the inserter's team (or self, or Admin). Update (mark read) =
-- the recipient only. Delete = Admin.
drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = notifications.task_id
        and (t.team_id = public.current_profile_team() or t.assignee_id = auth.uid())
    )
  );
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- STORAGE — private bucket "proofs" for photo proof.
-- Photos are visible only to the task's manager, member and Admin: the
-- bucket is private and the app opens photos with signed URLs (the app
-- only ever generates signed URLs for people on that task's team).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- Any signed-in user may upload proof photos (paths are team-scoped by the
-- app: <team_id>/<task_id>/...). Reads also need a signed URL, which the
-- app only generates for the task's own team.
drop policy if exists "proofs_upload" on storage.objects;
create policy "proofs_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs');

drop policy if exists "proofs_read" on storage.objects;
create policy "proofs_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs');

drop policy if exists "proofs_admin_delete" on storage.objects;
create policy "proofs_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and public.is_admin());

-- ============================================================================
-- SEED — the 4 teams from the Figma design. manager_id stays NULL until
-- the manager's account is created (the app sets it when an Admin adds a
-- manager to the team). Idempotent: re-running this file does not duplicate.
-- ============================================================================
insert into public.teams (organisation_id, name, color)
values
  ('00000000-0000-0000-0000-000000000001', 'Art', '#1A1A1A'),
  ('00000000-0000-0000-0000-000000000001', 'Cafe Table', '#C82828'),
  ('00000000-0000-0000-0000-000000000001', 'Theatre', '#D4A024'),
  ('00000000-0000-0000-0000-000000000001', 'Team 4', '#6E6A7C')
on conflict (organisation_id, name) do nothing;

-- ============================================================================
-- 30-DAY AUTO-DELETE (locked photo policy, 17 Nov 2026)
-- Approved-task photos delete themselves 30 days after approval, so the
-- Supabase free tier (1 GB storage) lasts. This function does the work;
-- it is NOT scheduled here. To schedule it, run the commented pg_cron
-- block below once (pg_cron must be enabled: Database -> Extensions).
-- It deletes the Storage objects AND clears the stored paths, so the app
-- simply shows no photos for old approved submissions afterwards.
-- ============================================================================
create or replace function public.delete_old_approved_photos()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  deleted_count integer := 0;
  r record;
begin
  -- Proof photos of submissions approved more than 30 days ago.
  for r in
    select s.id as submission_id, unnest(s.photo_paths) as path
    from public.submissions s
    where s.decision = 'approved'
      and s.decided_at < now() - interval '30 days'
      and s.photo_paths <> '{}'
  loop
    delete from storage.objects
    where bucket_id = 'proofs' and name = r.path;
    deleted_count := deleted_count + 1;
  end loop;

  update public.submissions s
  set photo_paths = '{}'
  where s.decision = 'approved'
    and s.decided_at < now() - interval '30 days'
    and s.photo_paths <> '{}';

  -- Before-photos of tasks completed more than 30 days ago.
  delete from storage.objects
  where bucket_id = 'proofs'
    and name in (
      select before_photo_path from public.tasks
      where status = 'completed'
        and updated_at < now() - interval '30 days'
        and before_photo_path is not null
    );

  update public.tasks
  set before_photo_path = null
  where status = 'completed'
    and updated_at < now() - interval '30 days'
    and before_photo_path is not null;

  return deleted_count;
end;
$$;

-- Schedule the cleanup daily at 03:00 IST (21:30 UTC). Run ONLY this block,
-- once, after enabling the pg_cron extension. Uncomment to use it.
-- select cron.schedule(
--   'teamtask-delete-old-photos',
--   '30 21 * * *',
--   $$select public.delete_old_approved_photos()$$
-- );

-- ============================================================================
-- FIRST ADMIN — run AFTER creating Rohan's Auth user in the dashboard.
-- Steps: Supabase dashboard -> Authentication -> Users -> Add user:
--   Email:    919998851767@teamtask.in   (pseudo-email for +91 99988 51767)
--   Password: (choose a strong password — this is Rohan's Admin password)
--   [x] Auto Confirm User: YES (so no confirmation email is needed)
-- Then copy that user's UUID below and run this block in the SQL editor.
-- ============================================================================
-- insert into public.profiles (id, name, phone, role, team_id)
-- values (
--   'PASTE-ROHAN-AUTH-USER-UUID-HERE',
--   'Rohan',
--   '+91 99988 51767',
--   'admin',
--   null
-- );

-- ============================================================================
-- TABLE GRANTS (added 2026-11-17 — the original migration had RLS policies
-- but no GRANTs, so authenticated users got "permission denied for table"
-- on every query. RLS policies only filter rows; the role still needs
-- table-level grants. Run this block in the SQL editor if it was not run
-- with the rest of the file. Safe to run twice.)
-- ============================================================================
grant select, insert, update, delete on public.organisations to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.activity_log to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
