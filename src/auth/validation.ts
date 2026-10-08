import type { AuthActionState, AuthMode } from "./types";

export function validateAuthForm(mode: AuthMode, form: FormData) {
  const value = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
  const email = value("email").trim().toLowerCase();
  const fullName = value("fullName").trim();
  const password = value("password");
  const confirmation = value("confirmPassword");
  const fieldErrors: NonNullable<AuthActionState["fieldErrors"]> = {};
  if (mode !== "reset" && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    fieldErrors.email = "Skriv inn en gyldig e-postadresse.";
  }
  if (mode === "register" || mode === "upgrade") {
    if (fullName.length < 2 || fullName.length > 100) fieldErrors.fullName = "Navnet må inneholde 2–100 tegn.";
  }
  if (mode !== "forgot" && mode !== "upgrade" && mode !== "resend") {
    if (!password || password.length > 128 || (mode !== "login" && password.length < 12)) {
      fieldErrors.password = mode === "login" ? "Skriv inn passordet ditt." : "Bruk et passord med 12–128 tegn.";
    }
    if (mode !== "login" && password !== confirmation) fieldErrors.confirmPassword = "Passordene er ikke like.";
  }
  return { email, fullName, password, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}
