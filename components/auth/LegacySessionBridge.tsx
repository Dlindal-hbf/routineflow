"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/src/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";

export function LegacySessionBridge() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function recover() {
    setPending(true);
    setError("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) throw new Error();
      const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
      const raw = localStorage.getItem(storageKey);
      const session = raw ? JSON.parse(raw) : null;
      if (typeof session?.access_token !== "string" || typeof session?.refresh_token !== "string") throw new Error();
      const supabase = getSupabaseClient();
      const { error: sessionError } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (sessionError) throw new Error();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error();
      localStorage.setItem("routineflow-legacy-owner", user.id);
      // Keep the source session and local business data until rollout is complete.
      window.location.assign(user.is_anonymous ? "/account/upgrade" : "/account/status");
    } catch {
      setError("Fant ingen gyldig tidligere økt i denne nettleseren. Kontakt administrator før du oppretter en ny konto hvis du har eksisterende data.");
      setPending(false);
    }
  }
  return <div className="space-y-4">
    <p className="text-sm text-foreground/70">Fortsett med den tidligere kontoen i denne nettleseren for å beholde eksisterende data.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button onClick={recover} disabled={pending} className="w-full">{pending && <LoaderCircle className="animate-spin" />}Hent eksisterende konto</Button>
  </div>;
}
