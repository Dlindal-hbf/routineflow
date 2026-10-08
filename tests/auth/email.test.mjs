import test from "node:test";
import assert from "node:assert/strict";
import { sendTransactionalEmail } from "../../src/email/provider.ts";

test("notification adapter keeps credentials server-side and uses idempotent plain-text delivery", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.EMAIL_PROVIDER_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  try {
    process.env.EMAIL_PROVIDER_API_KEY = "test-only-not-a-key";
    process.env.EMAIL_FROM = "RoutineFlow <test@example.test>";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(options.headers["Idempotency-Key"], "account-request/test");
      assert.equal(options.headers.Authorization, "Bearer test-only-not-a-key");
      const body = JSON.parse(options.body);
      assert.deepEqual(body.to, ["approvals@example.test"]);
      assert.equal(body.text, "Applicant <script> is plain text");
      assert.equal(body.html, undefined);
      return new Response(JSON.stringify({ id: "test" }), { status: 200 });
    };
    const email = { to: "approvals@example.test", subject: "Request", text: "Applicant <script> is plain text", idempotencyKey: "account-request/test" };
    await sendTransactionalEmail(email);
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response("private provider details", { status: 503 });
    await assert.rejects(sendTransactionalEmail(email), { message: "email_provider_http_503" });
    delete process.env.EMAIL_PROVIDER_API_KEY;
    await assert.rejects(sendTransactionalEmail(email), { message: "email_configuration_missing" });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.EMAIL_PROVIDER_API_KEY; else process.env.EMAIL_PROVIDER_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previousFrom;
  }
});
