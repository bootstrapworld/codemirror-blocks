const {
  getLanguageBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// dist/example-min.js: this language, for a page that loads it with a <script>
// tag after the editor's (the global `CMBExample` is the language, which is
// also added to the editor, to be asked for by its id: "example")
module.exports = getLanguageBundleConfig({
  name: "example",
  global: "CMBExample",
  entry: "./src/index.ts",
});
