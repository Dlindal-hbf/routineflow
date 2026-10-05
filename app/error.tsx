"use client";

import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6">
    <h1 className="text-2xl font-semibold text-primary">Kunne ikke laste RoutineFlow</h1>
    <p>Vi kunne ikke kontrollere kontotilgangen akkurat nå. Prøv igjen eller kontakt administrator.</p>
    <Button onClick={reset}>Prøv igjen</Button>
  </main>;
}
