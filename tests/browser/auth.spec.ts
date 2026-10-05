import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
  test(`auth layout and password-manager semantics at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of ["/login", "/register", "/forgot-password", "/verify-email"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('input[name="email"]')).toHaveAttribute("autocomplete", route === "/login" ? "username" : "email");
      if (route === "/login" || route === "/register") {
        await expect(page.locator('input[name="password"]')).toHaveAttribute("autocomplete", route === "/login" ? "current-password" : "new-password");
        await page.getByRole("button", { name: route === "/login" ? "Vis passord" : "Vis nytt passord", exact: true }).click();
        await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
      }
      if (route === "/register") await expect(page.locator('input[name="fullName"]')).toHaveAttribute("autocomplete", "name");
      await page.screenshot({ path: `artifacts/auth-${route.slice(1)}-${viewport.width}.png`, fullPage: true });
    }
  });
}

test("unauthenticated protected pages redirect, APIs deny access", async ({ page, request }) => {
  for (const route of ["/", "/admin/users", "/account/status"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/account/access")).status()).toBe(403);
  expect((await request.get("/api/process-resets")).status()).toBe(403);
  expect((await request.post("/api/process-resets", { data: {} })).status()).toBe(403);
  expect((await request.get("/api/internal/approval-notifications")).status()).toBe(401);
});

test("registration validates mismatched passwords on the server", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Fullt navn").fill("Test Person");
  await page.getByLabel("E-postadresse").fill("validation@example.test");
  await page.getByLabel("Nytt passord", { exact: true }).fill("a valid password here");
  await page.getByLabel("Bekreft passord", { exact: true }).fill("a different password");
  await page.getByRole("button", { name: "Be om tilgang", exact: true }).click();
  await expect(page.getByText("Passordene er ikke like.")).toBeVisible();
});
