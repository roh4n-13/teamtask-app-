-- TeamTask migration 002: attendance (check-in / check-out).
-- RULE: attendance records are NEVER deleted. No delete policy, no delete
-- grant, no cleanup function. (Photos have a 30-day rule; attendance does not.)
-- One row per user per day: check-in creates it, check-out fills check_out_at.
-- A NULL check_out_at means a missed check-out (manager/admin can fix the time).

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  work_date date not null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index if not exists attendance_team_date_idx on public.attendance (team_id, work_date);
create index if not exists attendance_user_date_idx on public.attendance (user_id, work_date);

alter table public.attendance enable row level security;

-- Select: own rows; managers see their team's rows; admins see all.
create policy attendance_select_own on public.attendance
  for select using (user_id = auth.uid());
create policy attendance_select_team on public.attendance
  for select using (current_profile_role() = 'manager' and team_id = current_profile_team());
create policy attendance_select_admin on public.attendance
  for select using (is_admin());

-- Insert: a member checks in for themselves only.
create policy attendance_insert_own on public.attendance
  for insert with check (user_id = auth.uid());

-- Update: own check-out; managers fix their team's missed check-outs; admins all.
create policy attendance_update_own on public.attendance
  for update using (user_id = auth.uid());
create policy attendance_update_team on public.attendance
  for update using (current_profile_role() = 'manager' and team_id = current_profile_team());
create policy attendance_update_admin on public.attendance
  for update using (is_admin());

-- Deliberately NO delete policy and NO delete grant: attendance is permanent.
grant select, insert, update on public.attendance to authenticated;
