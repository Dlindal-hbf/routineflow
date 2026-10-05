import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.AUTH_TEST_BASE_URL || "http://localhost:3100", trace: "retain-on-failure" },
});
