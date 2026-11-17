"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export function homeHrefFor(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/member";
}

/** Landing page — sends the user to login or to their role dashboard. */
export default function HomePage() {
  const store = useStore();
  const router = useRouter();

  useEffect(() => {
    if (store.authLoading) return;
    if (store.currentUser) router.replace(homeHrefFor(store.currentUser.role));
    else router.replace("/login");
  }, [store.authLoading, store.currentUser, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-charcoal px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Ouroboros Art Hub</p>
      <h1 className="mt-3 text-3xl font-bold text-white">TeamTask</h1>
      <p className="mt-2 text-sm text-stone-400">Work smarter. Together.</p>
    </main>
  );
}
