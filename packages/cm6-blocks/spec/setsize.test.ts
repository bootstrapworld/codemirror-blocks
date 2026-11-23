/** @jest-environment jsdom */
/* aria-setsize / aria-posinset count the blocks that are drawn (a comment block among them; text that is not drawn, no). */
import { make } from "./helpers";
import { a11yProblems } from "./soak-dom";

const TEXTS: Record<string, Record<string, string>> = {
  scheme: {
    above: "; first\n(f 1)\n(g 2)\n",
    trailing: "(f 1) ; trailing\n(g 2)\n",
    own: "(f 1)\n\n; alone\n\n(g 2)\n",
  },
  javascript: {
    above: "// first\nf(1);\ng(2);\n",
    trailing: "f(1); // trailing\ng(2);\n",
    own: "f(1);\n\n// alone\n\ng(2);\n",
  },
  python: {
    above: "# first\nf(1)\ng(2)\n",
    trailing: "f(1)  # trailing\ng(2)\n",
    own: "f(1)\n\n# alone\n\ng(2)\n",
  },
};

/** [program, from, to, insert]: edits found by the soak that leave an `error` root among the blocks */
const BROKEN: Record<string, [string, number, number, string]> = {
  scheme: ["(define x 5)\n(f 1 2)\n(if (> x 1) 2 3)", 3, 5, ")"],
  javascript: [
    "class A {\n  m() {\n    return 1;\n  }\n}\nnew A().m();\n",
    16,
    17,
    '"',
  ],
  python: ["# c\nfact = lambda n: None\n\n", 8, 8, " g(2)"],
};

const top = (ed: ReturnType<typeof make>) =>
  Array.from(
    ed.view.dom.querySelectorAll(".cm-content > .cm-line > [role=treeitem]")
  ) as HTMLElement[];

describe.each(Object.keys(TEXTS))("aria-setsize of the top level: %s", (l) => {
  test.each(["above", "trailing", "own"])(
    "%s: it is the number of blocks drawn",
    (k) => {
      const ed = make(l, TEXTS[l][k]);
      const items = top(ed);
      expect(items.length).toBe(ed.roots().length);
      items.forEach((el, i) => {
        expect(el.getAttribute("aria-setsize")).toBe(String(items.length));
        expect(el.getAttribute("aria-posinset")).toBe(String(i + 1));
      });
      expect(a11yProblems()).toEqual([]);
    }
  );
  test("a comment that is a block of its own counts as one", () => {
    const ed = make(l, TEXTS[l].own);
    const kinds = top(ed).map((el) => el.classList.contains("blocks-comment"));
    expect(kinds).toEqual([false, true, false]);
    expect(top(ed)[0].getAttribute("aria-setsize")).toBe("3");
  });
  test("text that is not a block (an error between blocks) does not count, and numbers stay in step", () => {
    const [text, from, to, insert] = BROKEN[l];
    const ed = make(l, text);
    ed.view.dispatch({ changes: { from, to, insert } });
    expect(ed.roots().some((r) => r.kind === "error")).toBe(true);
    expect(a11yProblems()).toEqual([]);
    const items = top(ed);
    expect(items.length).toBe(
      ed.roots().filter((r) => r.kind !== "error").length
    );
    items.forEach((el, i) => {
      expect(el.getAttribute("aria-setsize")).toBe(String(items.length));
      expect(el.getAttribute("aria-posinset")).toBe(String(i + 1));
    });
  });
});

test("python: an error root (text that does not parse) is not counted, with a comment above and a block after", () => {
  const ed = make("python", "# a comment\ntotal = 0\nprint(total)\n");
  ed.view.dispatch({ changes: { from: 17, insert: " 1" } }); // "total 1 = 0"
  const roots = ed.roots();
  expect(roots.some((r) => r.kind === "error")).toBe(true);
  expect(a11yProblems()).toEqual([]);
  const items = top(ed);
  expect(items.length).toBe(roots.filter((r) => r.kind !== "error").length);
  expect(items[0].getAttribute("aria-setsize")).toBe(String(items.length));
});
