# TeamTask — Phase 2a (Supabase-backed, migration pending)

Team task manager for **Ouroboros Art Hub, Ahmedabad**. Manager assigns a
task, the member does the work and submits photo proof, the manager approves
or rejects it — only then is the task complete.

**Status: Phase 2a — app wired to Supabase Auth + PostgreSQL + Storage.
The SQL migration has NOT run yet, so the live database is still empty.
Run `supabase/migration-001.sql` in the Supabase dashboard SQL editor first.**

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (Phase 1 used :3100; either works)
npm run build      # production build (must pass before handover)
```

## Supabase project

- Project: **TeamTask** (`ryrxhuyjoycstxgwgczk`), region Mumbai (ap-south-1), Free plan
- Env vars in `.env.local` (never commit): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Dashboard steps before first use (do these in order)

1. **Run the migration** — Supabase dashboard → SQL Editor → paste
   `supabase/migration-001.sql` → Run. It creates the tables, RLS policies,
   the private `proofs` Storage bucket, and seeds the 4 teams.
2. **Turn "Confirm email" OFF** — Authentication → Providers → Email →
   Confirm email OFF. Password login uses pseudo-emails
   (`<digits>@teamtask.local`) that have no inbox, so with confirmation ON
   nobody can ever sign in.
3. **Create the first Admin (Rohan)** — Authentication → Users → Add user:
   email `919998851767@teamtask.in`, a strong password, Auto Confirm ON.
   Then run the commented `profiles` insert at the end of
   `migration-001.sql` with that user's UUID. The Admin then creates
   managers and members from the app's Team page.

## Login — password only (locked decision)

Members log in with **phone number + password**. The Admin sets the
password once when adding a member (Team page → + Add member → name,
phone, password, role Member/Manager). No OTP anywhere in this build.
Pseudo-email mapping lives in `lib/supabase.ts`:
`"+91 99988 51767"` → `919998851767@teamtask.in`. (The domain must be a
real public TLD — `@teamtask.local` is rejected by Supabase Auth as
invalid. No mail is ever sent to it.)

**Known limitation:** there is no in-app password reset yet — a member who
forgets their password needs the Admin to reset it in the Supabase
dashboard (Authentication → Users → ⋯ → Reset password) or delete and
re-create the account.

## Screens (12, from the Figma "Final" page)

| Route | Screen |
| --- | --- |
| `/login` | Login — phone + **password** (OTP was replaced by the locked password decision) |
| `/admin` | Admin Dashboard — 4 teams, totals, recent tasks |
| `/manager` | Manager Dashboard — team ring, per-team rings, in-progress |
| `/member` | Member Dashboard — new-task banner, stat boxes, my tasks |
| `/tasks` | My Tasks — date strip, filter chips, overdue first |
| `/tasks/new` | Task Assign — team, member, title, deadline, priority, before-photo |
| `/tasks/[id]` | Task Detail — details, before photo, photo proof, submit / resubmit |
| `/approval/[id]` | Approval — submitted photo, Approve / Reject (reason required) |
| `/team` | Team — member list, progress rings, search, + Add member |
| `/profile` | Profile — user card, menu, demo role switcher, Log Out |
| `/notifications` | Notification centre (v1 addition) |

Plus the 3 approved v1 additions: **in-app notifications** (bell + list,
created on assign / submit / approve / reject), **overdue highlight**
(red badges + overdue sections), **resubmit after rejection**.

## Architecture — one data-access module

Everything reads and writes through `lib/store.tsx` (`useStore()`).
It talks to Supabase (Auth + PostgreSQL + Storage) with the same function
names the Phase 1 mock had, so the screens did not change. Photos are
compressed client-side to ~200 KB (`lib/compress.ts`) and uploaded to the
private `proofs` bucket; the database stores Storage paths and the app
turns them into signed URLs (7-day) for display.

## What still needs doing before go-live

- **Run the migration + dashboard steps above** (tables are empty until then).
- **Real data** — the Admin creates the pilot team's managers and members
  from the Team page (name + phone + password + role).
- **Push** — Firebase Cloud Messaging for real push notifications
  (the in-app centre and its hooks are already built).
- **Password reset in-app** — currently dashboard-only (see above).
- **30-day photo auto-delete** — the cleanup function is in the migration;
  schedule it with pg_cron (commented block in the SQL file) once enabled.
- **OTP (later)** — SMS OTP only after TRAI DLT registration; or email OTP.
  Not in this build by decision.

## Design

Charcoal `#1A1A1A` + mustard gold `#D4A024` + crimson `#C82828`
(Ouroboros brand). All UI copy in English. Mobile-first, 375px phone
column centred on desktop. Status colours (plan doc): Assigned blue,
In Progress amber, Submitted orange, Completed green, Overdue/Rejected red.
