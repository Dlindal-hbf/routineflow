import { redirect } from "next/navigation";
import { createAuthClient } from "@/src/auth/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function ResetPasswordPage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/forgot-password");
  return <AuthShell title="Velg nytt passord" description="Bruk et unikt passord på minst 12 tegn."><AuthForm mode="reset" /></AuthShell>;
}
