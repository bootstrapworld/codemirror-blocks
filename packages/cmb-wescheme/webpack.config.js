const {
  getLanguageBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// dist/cmb-wescheme-min.js: this language, for a page that loads it with a <script>
// tag after the editor's (the global `CMBWeScheme` is the language, which is
// also added to the editor, to be asked for by its id: "wescheme")
module.exports = getLanguageBundleConfig({
  name: "cmb-wescheme",
  global: "CMBWeScheme",
  entry: "./src/index.ts",
});
