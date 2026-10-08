import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const userId = required("BOOTSTRAP_ADMIN_USER_ID");
const email = required("BOOTSTRAP_ADMIN_EMAIL").trim().toLowerCase();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
  throw new Error("BOOTSTRAP_ADMIN_USER_ID must be a UUID");
}

const supabase = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
if (userError) throw new Error(`Could not load user: ${userError.message}`);
const user = userData.user;
if (!user || user.email?.trim().toLowerCase() !== email) {
  throw new Error("The user ID and email do not identify the same account");
}
if (!user.email_confirmed_at || user.is_anonymous) {
  throw new Error("The target account must be email-confirmed and non-anonymous");
}

const { error: profileError } = await supabase.from("account_profiles").upsert({
  id: user.id,
  full_name: user.user_metadata?.full_name ?? null,
  email: user.email,
  approval_status: "approved",
  email_verified_at: user.email_confirmed_at,
  approved_at: new Date().toISOString(),
}, { onConflict: "id" });
if (profileError) throw new Error(`Could not provision account profile: ${profileError.message}`);

const { error: adminError } = await supabase.from("account_admins").upsert(
  { user_id: user.id },
  { onConflict: "user_id" },
);
if (adminError) throw new Error(`Could not provision administrator role: ${adminError.message}`);

console.log(`Bootstrapped administrator ${user.email} (${user.id})`);
