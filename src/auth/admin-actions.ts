"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "./server";
import type { AuthActionState } from "./types";

export async function reviewAccount(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const { supabase, user } = await requireAdministrator();
  const id = String(form.get("userId") ?? "");
  const decision = form.get("decision");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !["approved", "rejected"].includes(String(decision)) || id === user!.id) {
    return { error: "Ugyldig forespørsel." };
  }
  const { error } = await supabase.rpc("review_account_request", { target_user_id: id, decision });
  if (error) return { error: "Endringen kunne ikke lagres. Kontroller at e-posten er bekreftet, og prøv igjen." };
  revalidatePath("/admin/users");
  return { message: decision === "approved" ? "Tilgangen er godkjent." : "Tilgangen er avslått." };
}
