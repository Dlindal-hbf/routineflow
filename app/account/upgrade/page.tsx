import { redirect } from "next/navigation";
import { createAuthClient } from "@/src/auth/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { LegacySessionBridge } from "@/components/auth/LegacySessionBridge";

export default async function UpgradePage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !user.is_anonymous) redirect("/account/status");
  return <AuthShell title="Behold eksisterende konto" description="Knytt e-post og passord til kontoen du allerede har.">
    {user ? <AuthForm mode="upgrade" /> : <LegacySessionBridge />}
  </AuthShell>;
}
