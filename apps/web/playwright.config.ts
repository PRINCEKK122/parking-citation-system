import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const CI = Boolean(process.env.CI);

/**
 * End-to-end tests (card S1-14) run against a production build served by `vite preview`,
 * with the mock API on, so they exercise exactly what the preview deploy (S1-16) ships.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Same settings as the preview deploy (netlify.toml).
    env: { VITE_USE_MOCKS: "true", VITE_GATEWAY_URL: "/gateway" },
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
