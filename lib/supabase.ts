// Supabase clients + phone → pseudo-email mapping (Phase 2a).
// ---------------------------------------------------------------------------
// Auth is PASSWORD ONLY (locked decision, 17 Nov 2026) — no OTP anywhere.
// Supabase Auth is email-based, but members log in with their PHONE NUMBER
// and a password, and their real email addresses are unknown. So each phone
// number maps to a deterministic pseudo-email:
//
//   "+91 99988 51767"  ->  919998851767@teamtask.in
//
// NOTE: the domain MUST be a real public TLD. "@teamtask.local" was tried
// first and Supabase Auth rejects it ("Email address is invalid") —
// ".local" is not a public suffix. "@teamtask.in" signs up fine (verified
// live, 17 Nov 2026). The domain does not need to exist or receive mail:
// with email confirmation OFF, no email is ever sent to it. The
// pseudo-email is never shown to the user as an email address — the UI
// only ever asks for phone + password.
//
// IMPORTANT DASHBOARD SETTING: Supabase Auth must have "Confirm email"
// DISABLED (Authentication -> Providers -> Email -> Confirm email OFF).
// With it ON, a signUp creates an unconfirmed user that can never sign in
// with a pseudo-email (no inbox exists to confirm it). This cannot be
// toggled from code — it has to change in the Supabase dashboard.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see README).",
  );
}

/** Main client — session persists in localStorage, so members stay logged in. */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Signup-only client — used when the Admin creates a member account.
 * `persistSession: false` means the new member's session is never stored,
 * so creating an account does NOT log the Admin out.
 */
export const signUpClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const PSEUDO_EMAIL_DOMAIN = "teamtask.in";

/** "+91 99988 51767" -> "919998851767@teamtask.in". */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalised = digits.length === 10 ? `91${digits}` : digits;
  return `${normalised}@${PSEUDO_EMAIL_DOMAIN}`;
}

/** The reverse of phoneToEmail, for display/debugging only. */
export function emailToPhone(email: string): string {
  return email.replace(`@${PSEUDO_EMAIL_DOMAIN}`, "");
}
