"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/src/lib/supabaseClient";

export function SessionBoundary({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        setActive(false);
        window.location.replace("/login");
      }
    });
    const check = async () => {
      try {
        const response = await fetch("/api/account/access", { cache: "no-store" });
        const account = response.ok ? await response.json() : null;
        if (!account?.approved || account.userId !== userId) {
          setActive(false);
          window.location.replace("/account/status");
        }
      } catch { /* RLS continues to enforce access while offline. */ }
    };
    const timer = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => { subscription.unsubscribe(); clearInterval(timer); window.removeEventListener("focus", check); };
  }, [userId]);
  return active ? children : null;
}
