import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function VerifyEmailPage() {
  return <AuthShell title="Bekreft e-postadressen" description="Mangler du bekreftelseslenken? Be om en ny."><AuthForm mode="resend" /></AuthShell>;
}
