#!/usr/bin/env node
/**
 * Compiles the Less of the package to plain CSS, in `lib/css`, so that using it
 * needs no stylesheet loaders in a bundler (see #509):
 *
 *   lib/css/codemirror-blocks.css      the editor itself: panes, toolbar, trash can,
 *                                      dialogs, the dragged block, and react-tabs'
 *   lib/css/languages/<id>.css         one language's style (it includes the default
 *                                      style, under the language's own class)
 *   lib/css/example-page.css           the style of our example pages (and of the
 *   lib/css/debug-page.css             WeScheme site): page chrome, not the editor
 *
 * The Less sources are in `lib` too (babel copies them), for a project that wants
 * to compile them with its own variables.
 */
const fs = require("fs");
const path = require("path");
const less = require("less");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "lib", "css");

const languages = ["example", "lambda", "routine", "wescheme"];

const targets = [
  {
    from: "src/less/core.less",
    to: "codemirror-blocks.css",
    // (the stylesheet of react-tabs, which the search dialog uses)
    prepend: () =>
      fs.readFileSync(
        require.resolve("react-tabs/style/react-tabs.css"),
        "utf8"
      ),
  },
  ...languages.map((id) => ({
    from: `src/languages/${id}/style.less`,
    to: `languages/${id}.css`,
  })),
  { from: "src/less/example.less", to: "example-page.css" },
  { from: "src/toolkit/debug-page.less", to: "debug-page.css" },
];

async function main() {
  for (const { from, to, prepend } of targets) {
    const file = path.join(root, from);
    const source = fs.readFileSync(file, "utf8");
    const result = await less.render(source, { filename: file });
    const dest = path.join(out, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, (prepend ? prepend() + "\n" : "") + result.css);
    process.stdout.write(
      `lib/css/${to}  ${Math.round(result.css.length / 1024)} KB\n`
    );
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
