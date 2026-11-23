import { defineConfig } from "@playwright/test";

// The soak runner's Chromium worker (scripts/soak.js): the server is the runner's own, at CMB6_PORT; no web server is started here.
export default defineConfig({
  testDir: ".",
  testMatch: /soak\.e2e\.ts/,
  timeout: 0,
  workers: 1,
  reporter: [["null"]],
  use: { baseURL: `http://127.0.0.1:${process.env.CMB6_PORT}` },
});
