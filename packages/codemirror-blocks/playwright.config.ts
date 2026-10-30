import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests, for what jsdom can't do: layout and scrolling (CodeMirror only
 * keeps the lines in view in the page), real focus, native drag and drop, real
 * keyboard input and selections. They drive the example page.
 *
 * Run with `npm run test:e2e` (from the repository root).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:8123",
    trace: "retain-on-failure",
    // the editor reads the clipboard through a hidden textarea
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The example page imports the built library (lib/), so build it first.
    command: "npm run build && npm start -- --port 8123",
    url: "http://localhost:8123",
    // Always start fresh: a leftover server would serve a stale build of lib/
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
