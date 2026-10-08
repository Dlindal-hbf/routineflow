import { after, NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/src/auth/server";
import { deliverApprovalNotifications } from "@/src/email/approval-notifications";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const supabase = await createAuthClient();
  let success = false;
  if (tokenHash && (type === "signup" || type === "email" || type === "recovery" || type === "email_change")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    success = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    success = !error;
  }
  const reset = type === "recovery" || type === "email_change" || params.get("next") === "/reset-password";
  if (success && type !== "recovery") after(async () => {
    try { await deliverApprovalNotifications(); }
    catch { console.error("[approval-email] delivery deferred; check worker configuration"); }
  });
  const path = success ? reset ? "/reset-password" : "/account/status" : "/login?link=invalid";
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
