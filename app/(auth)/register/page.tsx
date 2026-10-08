import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  return <AuthShell title="Be om tilgang" description="Opprett din personlige RoutineFlow-konto."><AuthForm mode="register" /></AuthShell>;
}
