/**
 * Someone who uses the editor but not the WeScheme language should not ship
 * WeScheme's parser: the languages are separate entry points
 * (`lib/languages/wescheme`), and nothing in the main one may pull them in.
 */
import { execFileSync } from "child_process";
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

  // (strings that only WeScheme's parser has: its structure names)
  const WESCHEME_PARSER = ["unsupportedExpr", "callExpr", "letrecExpr"];

  it("does not contain the WeScheme parser", () => {
    const code = bundle("./src/CodeMirrorBlocks.tsx");
    for (const marker of WESCHEME_PARSER) {
      expect(code).not.toContain(marker);
    }
  });

  it("does when the WeScheme language is asked for (so the check can fail)", () => {
    const code = bundle("./src/languages/wescheme/index.ts");
    for (const marker of WESCHEME_PARSER) {
      expect(code).toContain(marker);
    }
  });
});
