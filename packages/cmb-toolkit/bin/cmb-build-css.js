#!/usr/bin/env node
/**
 * Compiles the Less of a language module to plain CSS, so that using the module
 * needs no stylesheet loaders in a bundler (see #509):
 *
 *   cmb-build-css src/style.less lib/css/wescheme.css --with-core
 *
 * `--with-core` lets the Less `@import "default-style.less"`, the editor's own
 * style (it is in `lib/less` of @bootstrapworld/codemirror-blocks). `--paths a,b`
 * adds other places to look for what is imported.
 */
const fs = require("fs");
const path = require("path");
const less = require("less");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const [from, to] = args.filter(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--paths")
);
if (!from || !to) {
  console.error("usage: cmb-build-css <input.less> <output.css> [--with-core]");
  process.exit(2);
}

const paths = (opt("paths") ?? "").split(",").filter(Boolean);
if (flag("with-core")) {
  const core = require.resolve(
    "@bootstrapworld/codemirror-blocks/package.json",
    {
      paths: [process.cwd()],
    }
  );
  paths.push(path.join(path.dirname(core), "lib", "less"));
}

less
  .render(fs.readFileSync(from, "utf8"), {
    filename: path.resolve(from),
    paths,
  })
  .then((result) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, result.css);
    process.stdout.write(`${to}  ${Math.round(result.css.length / 1024)} KB\n`);
  })
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
