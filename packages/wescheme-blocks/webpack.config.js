const path = require("path");
const {
  getWebpackDevServerConfig,
  getBaseConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

const devServerConfig = getWebpackDevServerConfig({
  context: path.resolve(__dirname, "dev-server"),
  entry: "./index.js",
});
devServerConfig.module.rules.push({
  test: /\.rkt$/,
  type: "asset/source",
});

const baseConfig = getBaseConfig();

const bundleConfig = {
  ...baseConfig,
  name: "bundle",
  mode: "production",
  entry: {
    CodeMirrorBlocks: path.resolve(__dirname, "src", "wescheme.org"),
  },
  output: {
    filename: "WeschemeBlocks.js",
    clean: true,
    library: {
      name: "WeschemeBlocks",
      type: "window",
      export: "default",
    },
  },
  devtool: "source-map",
};

module.exports = [devServerConfig, bundleConfig];
