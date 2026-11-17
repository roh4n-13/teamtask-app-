"use client";

// Redirects to /login when nobody is signed in (Supabase Auth).
// Optionally restricts the page to certain roles. Waits for the session
// to restore first, so a signed-in user is never bounced to /login while
// the app is still checking.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export default function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[];
  children: React.ReactNode;
}) {
  const store = useStore();
  const router = useRouter();

  useEffect(() => {
    if (store.authLoading) return;
    if (!store.currentUser) router.replace("/login");
    else if (roles && !roles.includes(store.currentUser.role)) {
      router.replace(
        store.currentUser.role === "admin"
          ? "/admin"
          : store.currentUser.role === "manager"
            ? "/manager"
            : "/member",
      );
    }
  }, [store.authLoading, store.currentUser, roles, router]);

  if (store.authLoading || !store.currentUser) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-stone-500">Loading…</p>
      </main>
    );
  }
  if (roles && !roles.includes(store.currentUser.role)) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-stone-500">Loading…</p>
      </main>
    );
  }
  return <>{children}</>;
}
