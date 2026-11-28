import {
  PARSERS,
  applyEdit,
  changeOf,
  compareTrees,
  flatten,
  incrementalParse,
  lostText,
  rawDiverges,
  shrinkString,
  topNodes,
  windowDiffers,
} from "../scripts/parse-fuzz";

const js = PARSERS.javascript;

describe("parse-fuzz comparison helpers", () => {
  it("an incremental parse of a small edit equals the fresh one", () => {
    const old = "let x = 1;\nf(x, 3);\nlet y = 2;\n";
    const e = { from: 4, to: 5, insert: "abc" };
    const after = applyEdit(old, e);
    const inc = incrementalParse(js, js.parse(old), after, [changeOf(e)]);
    expect(compareTrees(inc, js.parse(after), after, [changeOf(e)])).toBeNull();
    expect(rawDiverges("javascript", old, e)).toBe(false);
    expect(topNodes(inc).length).toBe(3);
    expect(flatten(inc).length % 4).toBe(0);
  });

  it("a different tree is found, and where", () => {
    const a = "f(1);\ng(2);\n";
    const b = "f(1);\ng(2)\nh(3);\n";
    const ch = [{ fromA: 0, toA: 0, fromB: 0, toB: 0 }];
    const d = compareTrees(js.parse(a), js.parse(b), b, ch);
    expect(d).not.toBeNull();
    expect(d!.where).toBe("after");
  });

  it("finds text that no top-level node covers", () => {
    expect(lostText(js.parse("f(1);\ng(2);\n"), "f(1);\ng(2);\n")).toBe(false);
    expect(lostText(js.parse("f(1);\n"), "f(1);\nzzz")).toBe(true);
  });

  it("the window check sees nothing in a plain edit, and the shrinker keeps what the test needs", () => {
    const old = "a();\nb();\nc();\n";
    const e = { from: 5, to: 5, insert: "x" };
    const after = applyEdit(old, e);
    const inc = incrementalParse(js, js.parse(old), after, [changeOf(e)]);
    expect(windowDiffers(js, inc, after, [changeOf(e)], 1)).toBe(false);
    expect(
      shrinkString("aa\nbXb\ncc\n", (t) => t.includes("X"), { n: 500 })
    ).toBe("X");
  });
});
