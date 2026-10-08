"use client";

import { useActionState, useState } from "react";
import { Check, X, LoaderCircle } from "lucide-react";
import { reviewAccount } from "@/src/auth/admin-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AccountProfile } from "@/src/auth/types";

export function ReviewAccountForm({ profile }: { profile: AccountProfile }) {
  const [state, action, pending] = useActionState(reviewAccount, {});
  const [decision, setDecision] = useState<"approved" | "rejected" | "suspended">("approved");
  return <Dialog>
    <div className="flex flex-wrap gap-2">
      {profile.approval_status !== "approved" && <DialogTrigger asChild><Button size="sm" disabled={!profile.email_verified_at} onClick={() => setDecision("approved")}><Check />Godkjenn</Button></DialogTrigger>}
      {profile.approval_status === "approved" && <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setDecision("suspended")}><X />Suspender</Button></DialogTrigger>}
      {profile.approval_status !== "rejected" && profile.approval_status !== "suspended" && <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => setDecision("rejected")}><X />Avslå</Button></DialogTrigger>}
    </div>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{decision === "approved" ? "Godkjenne tilgang?" : decision === "suspended" ? "Suspendere tilgang?" : "Avslå tilgang?"}</DialogTitle>
        <DialogDescription className="break-all">{profile.full_name} ({profile.email})</DialogDescription></DialogHeader>
      <p className="text-sm text-foreground/70">{decision === "approved" ? "Kontoen vil få tilgang til RoutineFlow." : decision === "suspended" ? "Kontoen mister tilgangen til RoutineFlow, men kontoen beholdes." : "Kontoen vil ikke ha tilgang til RoutineFlow. Du kan vurdere forespørselen på nytt senere."}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="userId" value={profile.id} />
        <input type="hidden" name="decision" value={decision} />
        <div aria-live="polite">{state.error && <p className="text-sm text-red-700">{state.error}</p>}{state.message && <p className="text-sm text-green-800">{state.message}</p>}</div>
        <DialogFooter><Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{decision === "approved" ? "Godkjenn tilgang" : decision === "suspended" ? "Suspender tilgang" : "Avslå tilgang"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
