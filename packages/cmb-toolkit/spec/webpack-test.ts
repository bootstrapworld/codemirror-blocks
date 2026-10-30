import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration, RuleSetRule } from "webpack";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import {
  getBaseConfig,
  getWebpackBundleConfig,
  getWebpackDevServerConfig,
} from "../src/webpack";
import * as toolkit from "../src";

const rules = (config: Configuration) =>
  (config.module?.rules ?? []) as RuleSetRule[];
const ruleFor = (config: Configuration, file: string) =>
  rules(config).filter((r) => r.test instanceof RegExp && r.test.test(file));

describe("the base configuration", () => {
  const base = getBaseConfig();

  it("sends each kind of file to the right loader", () => {
    const loaderName = (rule: RuleSetRule) =>
      rule.use && !Array.isArray(rule.use) && typeof rule.use === "object"
        ? (rule.use as { loader: string }).loader
        : undefined;
    expect(ruleFor(base, "style.less").map((r) => r.use)).toEqual([
      [
        { loader: "style-loader" },
        { loader: "css-loader" },
        { loader: "less-loader" },
      ],
    ]);
    expect(ruleFor(base, "a.css")).toHaveLength(1);
    expect(ruleFor(base, "Thing.tsx").map(loaderName)).toEqual(["ts-loader"]);
    expect(ruleFor(base, "thing.ts").map(loaderName)).toEqual(["ts-loader"]);
    expect(ruleFor(base, "thing.js").map(loaderName)).toEqual(["babel-loader"]);
    expect(ruleFor(base, "thing.jsx").map(loaderName)).toEqual([
      "babel-loader",
    ]);
    expect(ruleFor(base, "beep.mp3").map((r) => r.type)).toEqual(["asset"]);
  });

  it("transpiles TypeScript without checking it, and inlines only small audio", () => {
    const ts = ruleFor(base, "x.ts")[0].use as { options: unknown };
    expect(ts.options).toEqual({ transpileOnly: true });
    const mp3 = ruleFor(base, "beep.mp3")[0];
    expect(mp3.parser).toEqual({ dataUrlCondition: { maxSize: 10000 } });
  });

  it("resolves TypeScript before JavaScript, and finds loaders in the workspace root", () => {
    expect(base.resolve?.extensions).toEqual([".ts", ".tsx", ".js", ".jsx"]);
    const modules = base.resolveLoader?.modules as string[];
    expect(modules[0]).toBe("node_modules");
    expect(path.isAbsolute(modules[1])).toBe(true);
    // ...and it is a real directory, with the loaders in it
    expect(modules[1]).toBe(path.resolve(__dirname, "../../../node_modules"));
    for (const loader of ["style-loader", "css-loader", "less-loader"]) {
      expect(fs.existsSync(path.join(modules[1], loader))).toBe(true);
    }
    expect(base.experiments).toEqual({ typescript: false });
  });

  it("gives every caller a fresh object", () => {
    expect(getBaseConfig()).not.toBe(getBaseConfig());
    expect(getBaseConfig().module).not.toBe(getBaseConfig().module);
  });
});

describe("the bundle configuration", () => {
  const entry = { main: "./src/index.js" };
  const config = getWebpackBundleConfig({ entry });

  it("makes a minified production UMD library named CodeMirrorBlocks", () => {
    expect(config.name).toBe("bundle");
    expect(config.mode).toBe("production");
    expect(config.entry).toBe(entry);
    expect(config.optimization).toEqual({ minimize: true });
    expect(config.output).toEqual({
      filename: "[name]-min.js",
      clean: true,
      library: { name: "CodeMirrorBlocks", type: "umd", export: "default" },
    });
  });

  it("leaves CodeMirror to the page", () => {
    expect(config.externals).toEqual({
      codemirror: "codemirror",
      "codemirror/addon/search/search": "codemirror",
      "codemirror/addon/search/searchcursor": "codemirror",
    });
  });

  it("writes a bundle-size report without opening it", () => {
    const analyzers = (config.plugins ?? []).filter(
      (p) => p instanceof BundleAnalyzerPlugin
    ) as BundleAnalyzerPlugin[];
    expect(analyzers).toHaveLength(1);
    expect(analyzers[0].opts).toMatchObject({
      analyzerMode: "static",
      reportFilename: "bundle-sizes.html",
      generateStatsFile: true,
      openAnalyzer: false,
    });
  });

  it("keeps the base loaders", () => {
    expect(rules(config)).toHaveLength(rules(getBaseConfig()).length);
  });
});

describe("the dev server configuration", () => {
  const context = "/some/site";
  const config = getWebpackDevServerConfig({ entry: "./main.js", context });

  it("is a development build of the given entry, in the given directory", () => {
    expect(config.name).toBe("devServer");
    expect(config.mode).toBe("development");
    expect(config.entry).toBe("./main.js");
    expect(config.context).toBe(context);
    expect(config.devtool).toBe("cheap-module-source-map");
    expect(config.optimization).toEqual({ runtimeChunk: true });
  });

  it("makes a page for the code", () => {
    const pages = (config.plugins ?? []).filter(
      (p) => p instanceof HtmlWebpackPlugin
    ) as HtmlWebpackPlugin[];
    expect(pages).toHaveLength(1);
    expect(pages[0].userOptions.title).toBe("CMB Dev Page");
  });

  it("serves to anyone, with hot reloading", () => {
    expect(config.devServer).toMatchObject({
      hot: true,
      host: "0.0.0.0",
      allowedHosts: "all",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
    expect(config.devServer?.static).toMatchObject({
      publicPath: context,
      watch: true,
    });
  });
});

it("exports the two helpers that language modules use", () => {
  expect(toolkit.getWebpackBundleConfig).toBe(getWebpackBundleConfig);
  expect(toolkit.getWebpackDevServerConfig).toBe(getWebpackDevServerConfig);
});

describe("compiling with the built configuration", () => {
  // Run in a child process: less-loader imports ES modules dynamically, which
  // Jest's sandbox only allows with a Node flag. It also tests lib/, which is
  // what the example page and the WeScheme build load (`npm install` builds it).
  const lib = path.resolve(__dirname, "../lib/webpack.js");
  let dir: string;
  beforeAll(() => {
    expect(fs.existsSync(lib)).toBe(true);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmb-toolkit-"));
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, target: "es2019" } })
    );
    fs.writeFileSync(
      path.join(dir, "style.less"),
      "@c: red;\n.a { color: @c; }"
    );
    fs.writeFileSync(
      path.join(dir, "thing.ts"),
      "export const greet = (who: string): string => `hello ${who}`;"
    );
    fs.writeFileSync(
      path.join(dir, "main.js"),
      [
        'import "./style.less";',
        'import { greet } from "./thing";',
        'export default greet("blocks");',
      ].join("\n")
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const compile = (which: "bundle" | "devServer") => {
    const script = `
      const webpack = require(${JSON.stringify(require.resolve("webpack"))});
      const lib = require(${JSON.stringify(lib)});
      const config = ${
        which === "bundle"
          ? `lib.getWebpackBundleConfig({ entry: "./main.js" })`
          : `lib.getWebpackDevServerConfig({ entry: "./main.js", context: process.cwd() })`
      };
      config.context = process.cwd();
      config.output = { ...config.output, path: process.cwd() + "/out-${which}" };
      config.plugins = config.plugins.filter(
        (p) => !/BundleAnalyzer/.test(p.constructor.name)
      );
      webpack(config, (err, stats) => {
        const failed = err || stats.hasErrors();
        console.log(JSON.stringify({
          ok: !failed,
          problems: err ? String(err) : stats.toString({ all: false, errors: true }),
        }));
      });`;
    const out = execFileSync(process.execPath, ["-e", script], {
      cwd: dir,
      encoding: "utf8",
    });
    return JSON.parse(out.trim().split("\n").pop() as string) as {
      ok: boolean;
      problems: string;
    };
  };

  it("builds Less, TypeScript and JavaScript into a production bundle", () => {
    const result = compile("bundle");
    expect(result.problems).toBe("");
    expect(result.ok).toBe(true);
    const bundle = fs.readFileSync(
      path.join(dir, "out-bundle", "main-min.js"),
      "utf8"
    );
    expect(bundle).toContain("hello blocks");
    expect(bundle).toContain("color: red");
  }, 120_000);

  it("builds the same code for the dev server, with a page to load it", () => {
    const result = compile("devServer");
    expect(result.problems).toBe("");
    expect(result.ok).toBe(true);
    const files = fs.readdirSync(path.join(dir, "out-devServer"));
    expect(files).toContain("index.html");
    expect(files.some((f) => f.endsWith(".js"))).toBe(true);
  }, 120_000);
});
