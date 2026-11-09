const path = require("path");
const {
  getWebpackBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// EXPERIMENT: the editor for a <script> tag, with Preact in place of React (which is
// most of the bundle: react-dom is half of codemirror-blocks-min.js). Everything
// that asks for react or react-dom gets preact/compat. Not the build that is shipped.
const compat = path.resolve(__dirname, "preact-compat.js");
const config = getWebpackBundleConfig({
  entry: { "codemirror-blocks-lite": "./src/umd.ts" },
});
config.output = {
  ...config.output,
  path: path.resolve(__dirname, "..", "dist", "lite"),
};
config.resolve = {
  ...config.resolve,
  alias: {
    ...config.resolve?.alias,
    // (exact: `react-dom/client` is Preact's own)
    react$: compat,
    "react-dom$": compat,
    "react-dom/client": "preact/compat/client",
    "react/jsx-runtime": "preact/compat/jsx-runtime",
  },
};
module.exports = config;
