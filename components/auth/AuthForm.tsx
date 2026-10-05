"use client";

import Link from "next/link";
import { useActionState, useEffect, useId } from "react";
import { authenticate } from "@/src/auth/actions";
import type { AuthActionState } from "@/src/auth/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";
import { SubmitButton } from "./SubmitButton";

export interface AuthFormProps {
  mode: "login" | "register" | "forgot" | "reset" | "upgrade" | "resend";
}

const labels = {
  resend: ["Send ny bekreftelseslenke", "Sender …"],
  login: ["Logg inn", "Logger inn …"],
  register: ["Be om tilgang", "Sender forespørsel …"],
  forgot: ["Send tilbakestillingslenke", "Sender …"],
  reset: ["Lagre nytt passord", "Lagrer …"],
  upgrade: ["Bekreft e-post", "Sender …"],
} as const;

const linkClass = "rounded-sm font-medium text-[#771816] underline underline-offset-4 hover:text-[#601311] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#771816]";

export function AuthForm({ mode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(authenticate, {});
  useEffect(() => {
    // A fresh document discards business caches belonging to the previous user.
    if (state.redirectTo) window.location.replace(state.redirectTo);
  }, [state.redirectTo]);
  const id = useId();
  const registering = mode === "register" || mode === "upgrade";
  const newPassword = mode === "register" || mode === "reset";
  const errors = state.fieldErrors;

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5" lang="nb">
      <input type="hidden" name="mode" value={mode} />
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <legend className="sr-only">{labels[mode][0]}</legend>
        {registering && (
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>Fullt navn</Label>
            <Input id={`${id}-name`} name="fullName" autoComplete="name" required minLength={2} maxLength={100} aria-invalid={Boolean(errors?.fullName)} aria-describedby={errors?.fullName ? `${id}-name-error` : undefined} className="h-11 text-[16px] outline-none disabled:opacity-60 aria-invalid:border-red-700" />
            <div aria-live="polite" aria-atomic="true">{errors?.fullName && <p id={`${id}-name-error`} className="text-sm text-red-800">{errors.fullName}</p>}</div>
          </div>
        )}
        {mode !== "reset" && (
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`}>E-postadresse</Label>
            <Input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete={mode === "login" ? "username" : "email"} autoCapitalize="none" spellCheck={false} required maxLength={254} aria-invalid={Boolean(errors?.email)} aria-describedby={errors?.email ? `${id}-email-error` : undefined} className="h-11 text-[16px] outline-none disabled:opacity-60 aria-invalid:border-red-700" />
            <div aria-live="polite" aria-atomic="true">{errors?.email && <p id={`${id}-email-error`} className="text-sm text-red-800">{errors.email}</p>}</div>
          </div>
        )}
        {mode !== "forgot" && mode !== "upgrade" && mode !== "resend" && (
          <PasswordField id={`${id}-password`} name="password" label={newPassword ? "Nytt passord" : "Passord"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 12 : undefined} maxLength={128} hint={newPassword ? "12–128 tegn." : undefined} error={errors?.password} />
        )}
        {newPassword && (
          <PasswordField id={`${id}-confirm`} name="confirmPassword" label="Bekreft passord" autoComplete="new-password" required minLength={12} maxLength={128} error={errors?.confirmPassword} />
        )}
        {mode === "login" && <div className="text-right text-sm"><Link href="/forgot-password" className={linkClass}>Glemt passord?</Link></div>}
        {registering && <p className="border-l-2 border-[#d4ad46] pl-3 text-xs leading-relaxed text-slate-600">Du må bekrefte e-postadressen din. Kontoen må godkjennes av en administrator før du får tilgang.</p>}
        <SubmitButton pending={pending} pendingLabel={labels[mode][1]}>{labels[mode][0]}</SubmitButton>
      </fieldset>
      <div aria-live="polite" aria-atomic="true" className="space-y-2 empty:hidden">
        {pending ? <p className="sr-only">{labels[mode][1]}</p> : <>
          {state.error && <p className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">{state.error}</p>}
          {state.message && <p className="break-words rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-slate-700">{state.message}</p>}
        </>}
      </div>
      <nav aria-label="Kontotilgang" className="border-t border-stone-200 pt-4 text-center text-sm leading-relaxed text-slate-600">
        {mode === "login" ? <p>Har du ikke konto? <Link href="/register" className={linkClass}>Opprett konto</Link></p> : <Link href="/login" className={linkClass}>Tilbake til innlogging</Link>}
      </nav>
    </form>
  );
}

export default AuthForm;
