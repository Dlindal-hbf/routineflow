import { redirect } from "next/navigation";
import { Check, Clock3, ShieldAlert } from "lucide-react";
import { getAccount } from "@/src/auth/server";
import { signOut } from "@/src/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AccountStatusPage() {
  const { user, profile, approved } = await getAccount();
  if (!user) redirect("/login");
  if (user.is_anonymous) redirect("/account/upgrade");
  if (approved) redirect("/");
  const verified = !!user.email_confirmed_at;
  const rejected = profile?.approval_status === "rejected";
  const title = !profile ? "Kontotilgang utilgjengelig" : rejected ? "Kontoen har ikke tilgang" : !verified ? "Bekreft e-postadressen din" : "Venter på godkjenning";
  const description = !profile
    ? "Vi fant ikke en gyldig kontoprofil. Kontakt administrator for å få hjelp."
    : rejected ? "Forespørselen din er vurdert. Kontoen har foreløpig ikke tilgang til RoutineFlow. Kontakt administrator hvis du mener dette bør vurderes på nytt."
    : !verified ? "Åpne bekreftelseslenken i e-posten vi sendte deg. Administrator må deretter godkjenne tilgangen."
    : "E-postadressen din er bekreftet. Forespørselen ligger til behandling hos administrator. Du får tilgang når kontoen er godkjent.";
  return <AuthShell title={title} description={description}>
    <div className="mb-6 space-y-4 border-y py-5 text-sm">
      <p className="break-all text-foreground/70">{user.email}</p>
      <p className="flex items-center gap-3">{verified ? <Check className="size-5 text-green-700" /> : <Clock3 className="size-5 text-primary" />}{verified ? "E-post bekreftet" : "E-post ikke bekreftet"}</p>
      <p className="flex items-center gap-3">{rejected ? <ShieldAlert className="size-5 text-primary" /> : <Clock3 className="size-5 text-primary" />}{rejected ? "Tilgang ikke godkjent" : "Tilgang avventer godkjenning"}</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button asChild className="flex-1"><a href="/account/status">Sjekk status</a></Button>
      <form action={signOut}><Button variant="outline" type="submit">Logg ut</Button></form>
    </div>
  </AuthShell>;
}
