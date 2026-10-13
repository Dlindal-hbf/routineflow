"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/src/lib/supabaseClient";

type RecoveryState = "checking" | "ready" | "invalid";

export function RecoverySessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecoveryState>("checking");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    const establishSession = async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (active) setState("invalid");
          return;
        }
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (active) setState(session?.user && !session.user.is_anonymous ? "ready" : "invalid");
    };

    void establishSession();
    return () => { active = false; };
  }, []);

  if (state === "ready") return children;
  if (state === "checking") return <p className="text-sm text-slate-600">Kontrollerer tilbakestillingslenken …</p>;
  return (
    <div className="space-y-4" role="alert">
      <p className="text-sm leading-relaxed text-red-900">Lenken er ugyldig eller utløpt. Be om en ny lenke for å tilbakestille passordet.</p>
      <Link href="/forgot-password" className="font-medium text-[#771816] underline underline-offset-4">Be om ny lenke</Link>
    </div>
  );
}
