const {
  getWebpackBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// dist/codemirror-blocks-min.js: the editor, with no language, for a page that
// loads it with a <script> tag (a language is another file: see cmb-wescheme, ...)
module.exports = getWebpackBundleConfig({
  entry: { "codemirror-blocks": "./src/umd.ts" },
});
