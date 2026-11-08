const {
  getLanguageBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// dist/routine-min.js: this language, for a page that loads it with a <script>
// tag after the editor's (the global `CMBRoutine` is the language, which is
// also added to the editor, to be asked for by its id: "routine")
module.exports = getLanguageBundleConfig({
  name: "routine",
  global: "CMBRoutine",
  entry: "./src/index.ts",
});
