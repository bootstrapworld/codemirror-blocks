const path = require("path");
const {
  getWebpackDevServerConfig,
  getWebpackBundleConfig,
} = require("codemirror-blocks/lib/toolkit/webpack");

const devServerConfig = getWebpackDevServerConfig({
  context: path.resolve(__dirname, "dev-server"),
  entry: "./index.js",
});
const bundleConfig = getWebpackBundleConfig({
  entry: {
    CodeMirrorBlocks: path.resolve(
      __dirname,
      "src",
      "languages",
      "wescheme",
      "index"
    ),
  },
});

const alias = {
  jsnums: "wescheme-js/src/runtime/js-numbers",
  lex: "wescheme-js/src/lex",
  types: "wescheme-js/src/runtime/types",
  structs: "wescheme-js/src/structures",
};

devServerConfig.module.rules.push({
  test: /\.rkt$/,
  use: [{ loader: "raw-loader" }],
});

// Add aliases needed by WeschemeParser.js
// TODO(pcardune): stop using aliases and just import
// directly from the right place...?
devServerConfig.resolve.alias = alias;
bundleConfig.resolve.alias = alias;

bundleConfig.externals = {
  codemirror: "codemirror",
  "codemirror/addon/search/search": "codemirror",
  "codemirror/addon/search/searchcursor": "codemirror",
  "wescheme-js/src/runtime/js-numbers": "jsnums",
  "wescheme-js/src/lex": {
    commonjs: "plt.compiler",
    commonjs2: "plt.compiler",
    root: ["plt", "compiler"],
  },
  "wescheme-js/src/runtime/types": "types",
  "wescheme-js/src/structures": {
    commonjs: "plt.compiler",
    commonjs2: "plt.compiler",
    root: ["plt", "compiler"],
  },
};

module.exports = [devServerConfig, bundleConfig];
