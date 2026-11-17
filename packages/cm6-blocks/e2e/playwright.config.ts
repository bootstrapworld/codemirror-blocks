import { defineConfig } from "@playwright/test";

// (CMB6_PORT lets the tests run while something else, such as `npm run serve`, has 8177)
const port = process.env.CMB6_PORT || "8177";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.e2e\.ts/,
  testIgnore: /profile\.e2e\.ts/,
  timeout: 120000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1100, height: 800 },
  },
  webServer: {
    command:
      "npm run build:min --silent -w @bootstrapworld/cm6-blocks && node serve.js",
    url: `http://127.0.0.1:${port}/index.html`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
