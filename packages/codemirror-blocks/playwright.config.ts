import { defineConfig, devices } from "@playwright/test";

// Set PORT to run on another port, e.g. so two runs can coexist.
const port = Number(process.env.PORT) || 8123;

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
  // Native drag and drop in Chromium is timing-sensitive: with many pages open
  // at once (the default is half the cores, 8 on a 16-core laptop) real-mouse
  // drags are often dropped. Two workers is reliable and still quick.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // the editor reads the clipboard through a hidden textarea
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The example page imports the built library (lib/), so build it first.
    command: `npm run build && npm start -- --port ${port}`,
    url: `http://localhost:${port}`,
    // Always start fresh: a leftover server would serve a stale build of lib/
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
