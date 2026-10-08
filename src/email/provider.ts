import "server-only";

export type TransactionalEmail = { to: string; subject: string; text: string; idempotencyKey: string };

// Provider boundary: auth emails remain Supabase's responsibility.
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("email_configuration_missing");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": email.idempotencyKey },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
    signal: AbortSignal.timeout(10_000),
  });
  // Never log provider bodies: they can contain recipient details.
  if (!response.ok) throw new Error(`email_provider_http_${response.status}`);
}
