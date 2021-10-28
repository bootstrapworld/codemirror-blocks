/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const {
  getWebpackDevServerConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");
const config = getWebpackDevServerConfig({
  entry: "./editor-example.js",
  context: path.resolve(__dirname, "..", "example"),
});

config.module.rules.push({
  test: /\.rkt$/,
  use: [{ loader: "raw-loader" }],
});

module.exports = config;
