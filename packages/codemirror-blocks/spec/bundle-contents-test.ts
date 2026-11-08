/**
 * The editor comes with no languages: someone who uses it, and not WeScheme (or
 * lambda, or Routine), should not ship the parser of one. Each is a package of
 * its own (`@bootstrapworld/wescheme`, ...), and nothing in the editor's
 * main entry point may pull one in.
 */ import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const toolkit = path.resolve(root, "..", "cmb-toolkit", "lib", "webpack");

describe("a bundle of the main entry point", () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmb-bundle-"));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const bundle = (entry: string) => {
    const script = `
      const webpack = require(${JSON.stringify(require.resolve("webpack"))});
      const lib = require(${JSON.stringify(toolkit)});
      const config = lib.getWebpackBundleConfig({ entry: ${JSON.stringify(entry)} });
      config.context = ${JSON.stringify(root)};
      config.output = { ...config.output, path: ${JSON.stringify(dir)}, filename: "out.js" };
      config.plugins = config.plugins.filter((p) => !/BundleAnalyzer/.test(p.constructor.name));
      webpack(config, (err, stats) => {
        console.log(JSON.stringify({ ok: !(err || stats.hasErrors()), problems: err ? String(err) : stats.toString({ all: false, errors: true }) }));
      });`;
    const out = execFileSync(process.execPath, ["-e", script], {
      cwd: root,
      encoding: "utf8",
    });
    const result = JSON.parse(out.trim().split("\n").pop() as string);
    expect(result.problems).toBe("");
    return fs.readFileSync(path.join(dir, "out.js"), "utf8");
  };

  // (strings that only a language has: WeScheme's structure names, lambda's
  // title, Routine's classes)
  const MARKERS: Record<string, { entry: string; strings: string[] }> = {
    wescheme: {
      entry: "wescheme",
      strings: ["unsupportedExpr", "callExpr", "letrecExpr"],
    },
    lambda: { entry: "lambda", strings: ["Your Lambda Program"] },
    routine: {
      entry: "routine",
      strings: ["routine-steps", "routine-body"],
    },
  };
  const languageEntry = (name: string) =>
    path.resolve(root, "..", MARKERS[name].entry, "src", "index.ts");

  it("contains none of the languages", () => {
    const code = bundle("./src/CodeMirrorBlocks.tsx");
    for (const { strings } of Object.values(MARKERS)) {
      for (const marker of strings) expect(code).not.toContain(marker);
    }
  });

  it.each(Object.keys(MARKERS))(
    "does when the %s language is asked for (so the check can fail)",
    (name) => {
      const code = bundle(languageEntry(name));
      for (const marker of MARKERS[name].strings) {
        expect(code).toContain(marker);
      }
    }
  );
});
