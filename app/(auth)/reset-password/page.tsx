import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { RecoverySessionGate } from "@/components/auth/RecoverySessionGate";

export default async function ResetPasswordPage() {
  return <AuthShell title="Velg nytt passord" description="Bruk et unikt passord på minst 12 tegn."><RecoverySessionGate><AuthForm mode="reset" /></RecoverySessionGate></AuthShell>;
}
