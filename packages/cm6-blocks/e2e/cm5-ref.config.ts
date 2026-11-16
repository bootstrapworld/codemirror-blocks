// Config for the throwaway reference shots of the existing (CodeMirror 5) editor: no web server of its own.
// Start that editor's example page yourself: `cd packages/codemirror-blocks && npx webpack serve --config webpack/example.config.js --port 8190`
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: /.*cm5-(ref|dump)\.e2e\.ts/,
  timeout: 120000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:8190", viewport: { width: 1100, height: 1300 }, reducedMotion: "reduce" },
});
