import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AccountProfile } from "./types";

export function authEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  return { url, key };
}

export function applicationOrigin() {
  const configured = process.env.APP_URL;
  if (!configured) throw new Error("APP_URL is required.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("APP_URL must use HTTPS outside localhost.");
  }
  return url.origin;
}

export async function createAuthClient() {
  const store = await cookies();
  const { url, key } = authEnvironment();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; proxy refreshes them first.
        }
      },
    },
  });
}

export async function getAccount() {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, profile: null, approved: false, admin: false };
  const { data: profile, error: profileError } = await supabase.from("account_profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error("Unable to verify application access.");
  const approved = !!user.email_confirmed_at && !user.is_anonymous && profile?.approval_status === "approved";
  let admin = false;
  if (approved) {
    const result = await supabase.rpc("is_account_admin");
    if (result.error) throw new Error("Unable to verify administrator access.");
    admin = result.data === true;
  }
  return { supabase, user, profile: profile as AccountProfile | null, approved, admin };
}

export async function requireApprovedAccount() {
  const account = await getAccount();
  if (!account.user) redirect("/login");
  if (!account.approved) redirect("/account/status");
  return account;
}

export async function requireAdministrator() {
  const account = await requireApprovedAccount();
  if (!account.admin) redirect("/");
  return account;
}
