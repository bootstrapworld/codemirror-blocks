// The stylesheets are src/css/*.css (the source: plain CSS); each is also written as src/css/<name>-css.ts, a module that exports it as a
// string, so no bundler or test runner needs a loader for .css. Run after editing a sheet (a test checks the two agree).
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "src", "css");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".css"))) {
  const css = fs.readFileSync(path.join(dir, f), "utf8");
  fs.writeFileSync(
    path.join(dir, f.replace(/\.css$/, "-css.ts")),
    "// GENERATED from " +
      f +
      " by scripts/build-css.cjs: do not edit\nexport default " +
      JSON.stringify(css) +
      ";\n"
  );
}
