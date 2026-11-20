"use client";

// Login — PASSWORD ONLY (locked decision, 17 Nov 2026).
// The Figma OTP screens become password-login screens in this build:
// wrong password shows the same red error state the Figma error screen had
// for a wrong OTP ("Wrong password. Please try again.").
// Real auth: Supabase Auth, password only (Phase 2a). Members log in with
// their phone number + the password the Admin set for them.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { homeHrefFor } from "@/app/page";

export default function LoginPage() {
  const store = useStore();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin(p: string, pw: string) {
    setBusy(true);
    setError("");
    const result = await store.login(p, pw);
    if (result.ok && result.user) {
      router.replace(homeHrefFor(result.user.role));
    } else {
      setError(result.error ?? "Login failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero — charcoal panel with a gallery-frame motif (no photo asset yet). */}
      <div className="relative overflow-hidden bg-charcoal px-6 pb-8 pt-10">
        <div className="absolute right-6 top-6 h-20 w-14 rounded-sm border-2 border-gold/70" />
        <div className="absolute right-24 top-14 h-12 w-12 rounded-full border-2 border-gold/50" />
        <div className="absolute bottom-6 right-10 h-8 w-24 border border-gold/40" />
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold">Ouroboros Art Hub</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-white">TeamTask</h1>
        <p className="mt-1 text-sm text-stone-400">Work smarter. Together.</p>
      </div>

      <div className="flex-1 px-6 py-6">
        <h2 className="text-lg font-bold text-charcoal">Welcome back</h2>
        <p className="mt-0.5 text-sm text-stone-600">Log in with your phone number and password.</p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            doLogin(phone, password);
          }}
        >
          <div>
            <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-stone-600">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold ${
                error ? "border-red-500" : "border-stone-300"
              }`}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-stone-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] outline-none placeholder:text-stone-400 focus:border-gold ${
                error ? "border-red-500" : "border-stone-300"
              }`}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !phone.trim() || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            <Lock size={16} />
            {busy ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-stone-600">
          Forgot your password? Ask your Admin to reset it.
        </p>
      </div>
    </main>
  );
}
