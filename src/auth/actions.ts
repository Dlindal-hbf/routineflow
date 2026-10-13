"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { deliverApprovalNotifications } from "@/src/email/approval-notifications";
import { applicationOrigin, createAuthClient } from "./server";
import { validateAuthForm } from "./validation";
import type { AuthActionState, AuthMode } from "./types";

function logAuthFailure(mode: AuthMode, error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; status?: unknown; name?: unknown };
    console.error("[auth] request failed", {
      mode,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      status: typeof candidate.status === "number" ? candidate.status : undefined,
      name: typeof candidate.name === "string" ? candidate.name : undefined,
    });
    return;
  }
  console.error("[auth] request failed", { mode, code: "unknown_error" });
}

export async function authenticate(_previous: AuthActionState, form: FormData): Promise<AuthActionState> {
  const mode = form.get("mode") as AuthMode;
  if (!["login", "register", "forgot", "reset", "upgrade", "resend"].includes(mode)) return { error: "Ugyldig forespørsel." };
  const { email, password, fullName, valid, fieldErrors } = validateAuthForm(mode, form);
  if (!valid) return { fieldErrors };
  let destination: string | null = null;
  try {
    const supabase = await createAuthClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === "email_not_confirmed") return { error: "Bekreft e-postadressen din før du logger inn. Se etter bekreftelsesmeldingen i innboksen." };
        return { error: "Kunne ikke logge inn. Kontroller e-post og passord, eller prøv igjen senere." };
      }
      destination = "/account/status";
    } else if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${applicationOrigin()}/auth/confirm` },
      });
      if (error && !["user_already_exists", "email_exists"].includes(error.code ?? "")) {
        logAuthFailure(mode, error);
        return { error: error.code === "weak_password" ? "Velg et sterkere passord med minst 12 tegn." : "Forespørselen kunne ikke sendes. Prøv igjen senere." };
      }
      if (!error && data.user?.identities?.length) {
        after(async () => {
          try { await deliverApprovalNotifications(); }
          catch { console.error("[approval-email] delivery deferred; check worker configuration"); }
        });
      }
      // Do not expose whether Supabase returned an existing/obfuscated user.
      return { message: "Hvis adressen kan registreres, får du en e-post med en bekreftelseslenke. Deretter må en administrator godkjenne tilgangen. Har du allerede en konto, kan du logge inn eller tilbakestille passordet." };
    } else if (mode === "resend") {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${applicationOrigin()}/auth/confirm` } });
      if (error) {
        logAuthFailure(mode, error);
        return { error: "Bekreftelsesmeldingen kunne ikke sendes akkurat nå. Prøv igjen senere." };
      }
      return { message: "Hvis kontoen venter på e-postbekreftelse, får du en ny lenke i innboksen." };
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${applicationOrigin()}/auth/confirm?next=/reset-password` });
      if (error) {
        logAuthFailure(mode, error);
        return { error: "Tilbakestillingsmeldingen kunne ikke sendes akkurat nå. Prøv igjen senere." };
      }
      return { message: "Hvis adressen er registrert, får du en e-post med en lenke for å velge et nytt passord." };
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return { error: "Lenken eller økten er utløpt. Start på nytt." };
      if (mode === "upgrade") {
        if (!user.is_anonymous) return { error: "Denne kontoen er allerede registrert. Logg inn med e-postadressen din." };
        const { error } = await supabase.auth.updateUser({ email, data: { full_name: fullName } }, {
          emailRedirectTo: `${applicationOrigin()}/auth/confirm?next=/reset-password`,
        });
        if (error) return { error: "Kunne ikke oppgradere kontoen. Kontroller opplysningene eller kontakt administrator." };
        return { message: "Bekreft e-postadressen din via lenken vi har sendt. Deretter velger du passord. Kontoens eksisterende data beholdes, og tilgangen må godkjennes." };
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: "Kunne ikke endre passordet. Velg et annet passord eller be om en ny lenke." };
      await supabase.auth.signOut();
      destination = "/login?password=updated";
    }
  } catch (error) {
    logAuthFailure(mode, error);
    if (mode === "forgot" || mode === "register" || mode === "resend") {
      return { error: "E-posttjenesten er midlertidig utilgjengelig. Kontroller e-postoppsettet og prøv igjen senere." };
    }
    return { error: "Tjenesten er midlertidig utilgjengelig. Prøv igjen senere." };
  }
  if (destination) {
    revalidatePath("/", "layout");
    // Password reset clears cookies. Redirect in the action before the guarded
    // reset page can rerender as unauthenticated and send the user backwards.
    if (mode === "reset") redirect(destination);
    return { redirectTo: destination };
  }
  return {};
}

export async function signOut() {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Kunne ikke logge ut. Prøv igjen.");
  revalidatePath("/", "layout");
  redirect("/login");
}
