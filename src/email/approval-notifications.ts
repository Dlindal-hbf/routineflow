import "server-only";
import { createClient } from "@supabase/supabase-js";
import { applicationOrigin, authEnvironment } from "@/src/auth/server";
import { sendTransactionalEmail } from "./provider";

type Notification = { id: string; user_id: string; created_at: string; lease_token: string };

export async function deliverApprovalNotifications() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const recipient = process.env.ADMIN_APPROVAL_EMAIL;
  if (!serviceKey || !recipient || !process.env.EMAIL_PROVIDER_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("approval_notification_configuration_missing");
  }
  const origin = applicationOrigin();
  const { url } = authEnvironment();
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("claim_account_notifications", { batch_size: 5 });
  if (error) throw new Error("notification_claim_failed");
  let sent = 0;
  let failed = 0;
  for (const item of (data ?? []) as Notification[]) {
    try {
      const { data: profile, error: profileError } = await client.from("account_profiles").select("full_name,email,created_at").eq("id", item.user_id).single();
      if (profileError || !profile?.email) throw new Error("notification_profile_unavailable");
      await sendTransactionalEmail({
        to: recipient,
        subject: "Ny kontoforespørsel i RoutineFlow",
        text: [
          "En ny RoutineFlow-konto venter på administratorgodkjenning.",
          `Navn: ${profile.full_name || "Ikke oppgitt"}`,
          `E-post: ${profile.email}`,
          `Forespurt: ${item.created_at} (UTC)`,
          "E-postbekreftelse og godkjent tilgang er separate krav. Kontroller status på administratorsiden.",
          `Vurder forespørselen: ${origin}/admin/users?request=${item.user_id}`,
          "Du må logge inn med en godkjent administratorkonto for å behandle forespørselen.",
        ].join("\n\n"),
        idempotencyKey: `account-request/${item.id}`,
      });
      const { error: updateError } = await client.from("account_notification_outbox")
        .update({ sent_at: new Date().toISOString(), last_error: null, locked_until: null, lease_token: null })
        .eq("id", item.id).eq("lease_token", item.lease_token);
      if (updateError) throw new Error("notification_receipt_failed");
      sent++;
    } catch (error) {
      failed++;
      const safeCode = error instanceof Error && /^(email_|notification_)[a-z0-9_]+$/.test(error.message) ? error.message : "notification_delivery_failed";
      await client.from("account_notification_outbox")
        .update({ last_error: safeCode, locked_until: new Date(Date.now() + 5 * 60_000).toISOString(), lease_token: null })
        .eq("id", item.id).eq("lease_token", item.lease_token);
    }
  }
  return { sent, failed };
}
