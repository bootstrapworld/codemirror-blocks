/**
 * The editor's stylesheet (`codemirror-blocks.css`) is all the style the editor
 * needs of its own, on a page that is not ours: the toolbar's icons are drawn
 * at their size, and what only a screenreader reads is hidden, by it. (They
 * were in a file that only our example pages used, and so were missing for
 * everyone else.) And it brings no page style of ours: Bootstrap is the example
 * pages'.
 */
import * as path from "path";
import { execFileSync } from "child_process";

describe("the stylesheet of the editor", () => {
  let css: string;
  beforeAll(() => {
    // (in a process of its own: Less, in a test page's window, loads files as a browser does)
    const file = path.resolve(__dirname, "../src/less/core.less");
    const script = `
      const file = ${JSON.stringify(file)};
      const less = require("module").createRequire(file)("less");
      less.render(require("fs").readFileSync(file, "utf8"), { filename: file })
        .then((r) => process.stdout.write(r.css));
    `;
    css = execFileSync(process.execPath, ["-e", script], { encoding: "utf8" });
  });

  it("sizes the icons of the toolbar", () => {
    expect(css).toMatch(/\.icon\s*\{[^}]*width: 16px/);
  });

  it("hides what only a screenreader reads", () => {
    expect(css).toMatch(
      /\.screenreader-only\s*\{[^}]*clip: rect\(0, 0, 0, 0\)/
    );
  });

  it("does not import the style of a page", () => {
    expect(css).not.toMatch(/@import/);
  });
});
