import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Explicit opt-in: credentials are obtained from a local CLI, never production.
test("local Supabase registration, verification, approval, rejection and recovery", async ({ page, browser }) => {
  test.skip(process.env.AUTH_INTEGRATION !== "1", "Requires the disposable local Supabase stack and mail catcher");
  test.setTimeout(120_000);
  const status = JSON.parse(execFileSync(process.env.SUPABASE_CLI || "supabase", ["status", "-o", "json"], { encoding: "utf8" }));
  const url = status.API_URL;
  expect(["localhost", "127.0.0.1"]).toContain(new URL(url).hostname);
  const service = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const member = createClient(url, status.ANON_KEY, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const email = `member-${suffix}@example.test`;
  const adminEmail = `admin-${suffix}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const userIds: string[] = [];
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const mailUrl = status.MAILPIT_URL || status.INBUCKET_URL;

  async function login(target: Page, address: string, secret: string) {
    await target.goto("/login");
    await target.getByLabel("E-postadresse").fill(address);
    await target.getByLabel("Passord", { exact: true }).fill(secret);
    await target.getByRole("button", { name: "Logg inn", exact: true }).click();
  }
  async function emailLink(type: "signup" | "recovery") {
    let link = "";
    await expect.poll(async () => {
      const inbox = await (await fetch(`${mailUrl}/api/v1/messages`)).json();
      for (const message of inbox.messages ?? []) {
        if (!message.To?.some((to: { Address: string }) => to.Address === email)) continue;
        const detail = await (await fetch(`${mailUrl}/api/v1/message/${message.ID}`)).json();
        const found = String(detail.HTML).match(/href="([^"]*token_hash=[^"]+)"/);
        if (found) {
          const candidate = found[1].replaceAll("&amp;", "&");
          if (new URL(candidate).searchParams.get("type") === type) { link = candidate; return true; }
        }
      }
      return false;
    }, { timeout: 15_000 }).toBe(true);
    return link;
  }
  try {
    const admin = await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: "Test Administrator" } });
    expect(admin.error).toBeNull();
    userIds.push(admin.data.user!.id);
    expect((await service.from("account_profiles").update({ approval_status: "approved", approved_at: new Date().toISOString() }).eq("id", admin.data.user!.id)).error).toBeNull();
    expect((await service.from("account_admins").insert({ user_id: admin.data.user!.id })).error).toBeNull();

    await page.goto("/register");
    await page.getByLabel("Fullt navn").fill("Test Applicant");
    await page.getByLabel("E-postadresse").fill(email);
    await page.getByLabel("Nytt passord", { exact: true }).fill(password);
    await page.getByLabel("Bekreft passord", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Be om tilgang", exact: true }).click();
    await expect(page.getByText(/Hvis adressen kan registreres/)).toBeVisible();
    const profile = await service.from("account_profiles").select("*").eq("email", email).single();
    expect(profile.error).toBeNull();
    const id = profile.data.id;
    userIds.push(id);
    expect(profile.data.approval_status).toBe("pending");
    expect(profile.data.email_verified_at).toBeNull();
    expect((await service.from("account_notification_outbox").select("id").eq("user_id", id)).data).toHaveLength(1);
    expect((await member.auth.signInWithPassword({ email, password })).error?.code).toBe("email_not_confirmed");

    const confirmation = await emailLink("signup");
    await page.goto(confirmation);
    await expect(page.getByRole("heading", { name: "Venter på godkjenning" })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "artifacts/auth-pending-mobile.png", fullPage: true });
    for (const route of ["/", "/admin/users"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/account\/status$/);
    }
    expect((await member.auth.signInWithPassword({ email, password })).error).toBeNull();
    for (const table of ["task_lists", "tasks", "task_history", "inventory_items", "inventory_snapshots", "customers", "customer_interactions", "work_log_entries", "activity_history_entries"]) {
      const result = await member.from(table).select("*");
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
    expect((await member.from("task_lists").insert({ user_id: id, app_id: "blocked", title: "Blocked" })).error).not.toBeNull();
    expect((await member.from("account_profiles").update({ approval_status: "approved" }).eq("id", id)).error).not.toBeNull();
    expect((await member.rpc("review_account_request", { target_user_id: id, decision: "approved" })).error).not.toBeNull();

    await login(adminPage, adminEmail, password);
    await expect(adminPage).toHaveURL(/\/$/);
    await adminPage.goto(`/admin/users?request=${id}`);
    await expect(adminPage.getByRole("heading", { name: "Test Applicant" })).toBeVisible();
    await adminPage.setViewportSize({ width: 375, height: 812 });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await adminPage.screenshot({ path: "artifacts/auth-admin-mobile.png", fullPage: true });
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await adminPage.screenshot({ path: "artifacts/auth-admin-desktop.png", fullPage: true });
    await adminPage.getByRole("button", { name: "Godkjenn", exact: true }).click();
    await adminPage.getByRole("button", { name: "Godkjenn tilgang", exact: true }).click();
    await expect.poll(async () => (await service.from("account_profiles").select("approval_status").eq("id", id).single()).data?.approval_status).toBe("approved");
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Logg ut" })).toBeVisible();
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/$/);
    expect((await member.rpc("review_account_request", { target_user_id: admin.data.user!.id, decision: "rejected" })).error).not.toBeNull();
    expect((await member.from("task_lists").insert({ user_id: id, app_id: "owned-test", title: "Preserved owned data" })).error).toBeNull();

    await adminPage.goto(`/admin/users?request=${id}`);
    await adminPage.getByRole("button", { name: "Avslå", exact: true }).click();
    await adminPage.getByRole("button", { name: "Avslå tilgang", exact: true }).click();
    await expect.poll(async () => (await service.from("account_profiles").select("approval_status").eq("id", id).single()).data?.approval_status).toBe("rejected");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Kontoen har ikke tilgang" })).toBeVisible();
    expect((await member.from("task_lists").select("*")).data).toEqual([]);

    await page.goto("/forgot-password");
    await page.getByLabel("E-postadresse").fill(email);
    await page.getByRole("button", { name: "Send tilbakestillingslenke" }).click();
    await expect(page.getByText(/Hvis adressen er registrert/)).toBeVisible();
    await page.goto(await emailLink("recovery"));
    await expect(page.getByRole("heading", { name: "Velg nytt passord" })).toBeVisible();
    const nextPassword = `Reset-${randomUUID()}!`;
    await page.getByLabel("Nytt passord", { exact: true }).fill(nextPassword);
    await page.getByLabel("Bekreft passord", { exact: true }).fill(nextPassword);
    await page.getByRole("button", { name: "Lagre nytt passord" }).click();
    await expect(page).toHaveURL(/\/login\?password=updated$/);
    await login(page, email, nextPassword);
    await expect(page.getByRole("heading", { name: "Kontoen har ikke tilgang" })).toBeVisible();

    await adminPage.goto(`/admin/users?request=${id}`);
    await adminPage.getByRole("button", { name: "Godkjenn", exact: true }).click();
    await adminPage.getByRole("button", { name: "Godkjenn tilgang", exact: true }).click();
    await expect.poll(async () => (await service.from("account_profiles").select("approval_status").eq("id", id).single()).data?.approval_status).toBe("approved");
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    expect((await member.auth.signInWithPassword({ email, password: nextPassword })).error).toBeNull();
    expect((await member.from("task_lists").select("title").eq("app_id", "owned-test")).data).toEqual([{ title: "Preserved owned data" }]);
    await page.getByRole("button", { name: "Logg ut" }).click();
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await adminContext.close();
    for (const id of userIds.reverse()) await service.auth.admin.deleteUser(id);
  }
});
