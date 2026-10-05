import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function ForgotPasswordPage() {
  return <AuthShell title="Glemt passord?" description="Vi sender deg en lenke for å velge et nytt passord."><AuthForm mode="forgot" /></AuthShell>;
}
