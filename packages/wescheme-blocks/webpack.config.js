/* eslint-disable @typescript-eslint/no-var-requires */
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
  use: [{ loader: "raw-loader" }],
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

// TODO(pcardune): figure out what needs to be part of the bundle
// for wescheme.org
// bundleConfig.externals = {
//   codemirror: "codemirror",
//   "codemirror/addon/search/search": "codemirror",
//   "codemirror/addon/search/searchcursor": "codemirror",
//   "wescheme-js/src/runtime/js-numbers": "jsnums",
//   "wescheme-js/src/lex": {
//     commonjs: "plt.compiler",
//     commonjs2: "plt.compiler",
//     root: ["plt", "compiler"],
//   },
//   "wescheme-js/src/runtime/types": "types",
//   "wescheme-js/src/structures": {
//     commonjs: "plt.compiler",
//     commonjs2: "plt.compiler",
//     root: ["plt", "compiler"],
//   },
// };

module.exports = [devServerConfig, bundleConfig];
