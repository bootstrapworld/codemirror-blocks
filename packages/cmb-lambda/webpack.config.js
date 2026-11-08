const {
  getLanguageBundleConfig,
} = require("@bootstrapworld/cmb-toolkit/lib/webpack");

// dist/cmb-lambda-min.js: this language, for a page that loads it with a <script>
// tag after the editor's (the global `CMBLambda` is the language, which is
// also added to the editor, to be asked for by its id: "lambda")
module.exports = getLanguageBundleConfig({
  name: "cmb-lambda",
  global: "CMBLambda",
  entry: "./src/index.ts",
});
