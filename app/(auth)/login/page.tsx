import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ link?: string; password?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Velkommen tilbake" description="Logg inn på RoutineFlow.">
    {params.link === "invalid" && <p role="alert" className="mb-5 text-sm text-red-700">Lenken er ugyldig eller utløpt. Be om en ny lenke og prøv igjen.</p>}
    {params.password === "updated" && <p role="status" className="mb-5 text-sm text-green-800">Passordet er endret. Logg inn med det nye passordet.</p>}
    <AuthForm mode="login" />
    <p className="mt-4 text-center text-sm"><Link href="/verify-email" className="text-primary underline underline-offset-4">Send ny e-postbekreftelse</Link></p>
    <p className="mt-6 border-t pt-4 text-center text-sm"><Link href="/account/upgrade" className="text-foreground/70 underline underline-offset-4">Har du en tidligere nettleserkonto?</Link></p>
  </AuthShell>;
}
