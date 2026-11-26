import { defineConfig } from "@playwright/test";

// CMB6_SOAK_BROWSER=chromium|firefox|webkit (default chromium): the browser of the Chromium worker. Firefox and WebKit must be installed
// (`npx playwright install firefox webkit`); the steps that need Chromium's DevTools protocol (a finger's long press and drag, the IME,
// the page zoom) and its clipboard permissions are left out there (e2e/soak-run.ts).
const BROWSERS = ["chromium", "firefox", "webkit"] as const;
const raw = (process.env.CMB6_SOAK_BROWSER || "chromium").toLowerCase();
if (!(BROWSERS as readonly string[]).includes(raw))
  throw new Error(
    `CMB6_SOAK_BROWSER=${raw}: expected one of ${BROWSERS.join(", ")}`
  );
const browserName = raw as (typeof BROWSERS)[number];

// The soak runner's Chromium worker (scripts/soak.js): the server is the runner's own, at CMB6_PORT; no web server is started here.
export default defineConfig({
  testDir: ".",
  testMatch: /soak\.e2e\.ts/,
  timeout: 0,
  workers: 1,
  reporter: [["null"]],
  use: { browserName, baseURL: `http://127.0.0.1:${process.env.CMB6_PORT}` },
});
