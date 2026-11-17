/** @jest-environment jsdom */
/* Eighth round, step 1: search, modelled on the old editor's spec/search-test.tsx and spec/searchers-test.tsx. */
import { make } from "./helpers";
import { walk } from "../src/doc";
import { checkLezerEditor, LezerBlockEditor } from "../src/lezer-view";
import { queryOf } from "../src/search";
import type { SoundEvent, SoundName } from "../src/sound";
import type { BNode } from "../src/types";

const LANGS = ["scheme", "javascript", "python"];
const SRC: Record<string, string> = {
  scheme: "(f x)\n(g xy x)\nx",
  javascript: "f(x);\ng(xy, x);\nx;",
  python: "f(x)\ng(xy, x)\nx",
};
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) =>
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      cancelable: true,
      ...mods,
    })
  );
const all = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) => walk(r, (n) => o.push(n)));
  return o.filter((n) => n.kind !== "error");
};
const text = (ed: LezerBlockEditor) => ed.view.state.doc.toString();

function rig(l: string, src = SRC[l]) {
  const heard: [SoundName, SoundEvent][] = [];
  const ed = make(l, src, { playSound: (s, e) => heard.push([s, e]) });
  const first = ed.roots().find((r) => r.kind !== "error")!;
  if (first) ed.focusNode(first);
  /** a key where a person is: on the block that has the focus */
  const press = (k: string, mods: Partial<KeyboardEventInit> = {}) =>
    key(
      ed.focusedNode() ? ed.renderer.element(ed.focusedNode()!) : ed.view.dom,
      k,
      mods
    );
  const dlg = () =>
    document.querySelector(".blocks-search") as HTMLElement | null;
  const input = () =>
    dlg()!.querySelector("input[type=text]") as HTMLInputElement;
  const typeIn = (v: string) => {
    input().value = v;
    input().dispatchEvent(new Event("input", { bubbles: true }));
  };
  const tick = (name: string) => {
    const cb = dlg()!.querySelector(`input[name=${name}]`) as HTMLInputElement;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const enter = () => key(document.activeElement ?? dlg()!, "Enter");
  const searchFor = (v: string) => {
    press("F3");
    typeIn(v);
    enter();
  };
  const at = () => ed.focusedNode()!.from;
  const said = () => ed.said.slice();
  return {
    ed,
    heard,
    press,
    dlg,
    input,
    typeIn,
    tick,
    enter,
    searchFor,
    at,
    said,
    first,
  };
}

test("queryOf: plain text is escaped, exact adds word boundaries, an unfinished pattern matches nothing", () => {
  const s = {
    searchString: "a.b",
    isRegex: false,
    isExactMatch: false,
    isIgnoreCase: false,
  };
  expect("a.b axb".match(queryOf(s)!)).toEqual(["a.b"]);
  expect("xa.b a.bc a.b".match(queryOf({ ...s, isExactMatch: true })!)).toEqual(
    ["a.b"]
  );
  expect("axb".match(queryOf({ ...s, isRegex: true })!)).toEqual(["axb"]);
  expect(queryOf({ ...s, searchString: "(", isRegex: true })).toBeNull();
  expect(queryOf({ ...s, searchString: "" })).toBeNull();
  expect(
    "AB".match(queryOf({ ...s, searchString: "ab", isIgnoreCase: true })!)
  ).toEqual(["AB"]);
});

describe.each(LANGS)("search: %s", (l) => {
  const xs = (ed: LezerBlockEditor) =>
    [...text(ed).matchAll(/x/g)].map((m) => m.index!);

  describe("the dialog", () => {
    test.each([
      ["F3", {}],
      ["f", { ctrlKey: true }],
      ["f", { metaKey: true }],
    ])(
      "opens with %s %j: a labelled dialog with the two tabs, the text box has the focus",
      (k, mods) => {
        const { press, dlg, input } = rig(l);
        press(k, mods);
        const d = dlg()!;
        expect(d).not.toBeNull();
        expect(d.getAttribute("role")).toBe("dialog");
        expect(d.getAttribute("aria-modal")).toBe("true");
        expect(d.getAttribute("aria-label")).toBe("Search Settings");
        expect(
          Array.from(d.querySelectorAll("[role=tab]")).map((t) => t.textContent)
        ).toEqual(["Search by string", "Search by block"]);
        expect(d.textContent).toContain(
          "What should PgUp and PgDown search for?"
        );
        expect(document.activeElement).toBe(input());
        expect(
          Array.from(d.querySelectorAll("label")).map((x) => x.textContent)
        ).toEqual(["Ignore case", "Exact match", "Regex"]);
      }
    );

    test("Escape closes it, goes nowhere, and the focus comes back to the block", () => {
      const { ed, press, dlg, typeIn, first } = rig(l);
      press("F3");
      typeIn("x");
      key(dlg()!.querySelector("input")!, "Escape");
      expect(dlg()).toBeNull();
      expect(ed.focusedNode()).toBe(first);
      expect(document.activeElement).toBe(ed.renderer.element(first));
    });

    test("the Close button closes it, and goes nowhere", () => {
      const { ed, press, dlg, first } = rig(l);
      press("F3");
      (dlg()!.querySelector(".closeDialog") as HTMLElement).click();
      expect(dlg()).toBeNull();
      expect(ed.focusedNode()).toBe(first);
    });

    test("keeps what was searched for the next time it opens; Tab stays inside while it is open", () => {
      const { press, dlg, input, searchFor } = rig(l);
      searchFor("xy");
      press("F3");
      expect(input().value).toBe("xy");
      const inside = Array.from(
        dlg()!.querySelectorAll<HTMLElement>("input, select, button")
      ).filter((e) => e.tabIndex >= 0 && !e.closest("[hidden]"));
      for (let i = 0; i < inside.length + 2; i++) {
        key(document.activeElement!, "Tab");
        expect(dlg()!.contains(document.activeElement)).toBe(true);
      }
      key(document.activeElement!, "Tab", { shiftKey: true });
      expect(dlg()!.contains(document.activeElement)).toBe(true);
    });

    test("Left and Right change the kind of search (the tabs); the keys of the dialog do not reach the editor", () => {
      const { ed, press, dlg } = rig(l);
      press("F3");
      const tab0 = dlg()!.querySelector("[role=tab]") as HTMLElement;
      tab0.focus();
      key(tab0, "ArrowRight");
      expect(
        dlg()!.querySelectorAll("[role=tab]")[1].getAttribute("aria-selected")
      ).toBe("true");
      expect(ed.search.settings().mode).toBe("block");
      expect(ed.search.settings().block.blockType).not.toBe(""); // (the first type of the list)
      key(document.activeElement!, "ArrowLeft");
      expect(ed.search.settings().mode).toBe("text");
      // (Left in the editor would have moved the focus to a parent or collapsed the block)
      expect(dlg()).not.toBeNull();
    });

    test("it is only opened where there is a block with the focus: a key in text mode does nothing", () => {
      const { ed, dlg } = rig(l);
      ed.setBlockMode(false);
      key(ed.view.contentDOM, "F3");
      expect(dlg()).toBeNull();
    });
  });

  describe("by text", () => {
    test("Enter closes the dialog and goes to the first match after the focus", () => {
      const { ed, searchFor, dlg, at } = rig(l);
      searchFor("x");
      expect(dlg()).toBeNull();
      expect(at()).toBe(xs(ed)[0]);
      expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
        "x"
      );
      expect(ed.said).toContain(
        "Searching for next match. Use PageUp and PageDown to search forwards and backwards"
      );
    });

    test("PageDown and PageUp step through the matches (the block that holds each)", () => {
      const { ed, searchFor, press, at } = rig(l);
      searchFor("x");
      const p = xs(ed);
      expect(p.length).toBe(4);
      expect(at()).toBe(p[0]);
      press("PageDown");
      expect(at()).toBe(p[1]);
      expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
        "xy"
      ); // (the block "xy", not the x in it)
      press("PageDown");
      expect(at()).toBe(p[2]);
      press("PageDown");
      expect(at()).toBe(p[3]);
      press("PageUp");
      expect(at()).toBe(p[2]);
      press("PageUp");
      expect(at()).toBe(p[1]);
      expect(checkLezerEditor(ed)).toEqual([]);
    });

    test("goes on from the other end at the end, with the wrap sound; the same backwards", () => {
      const { ed, searchFor, press, at, heard } = rig(l);
      searchFor("x");
      for (let i = 0; i < 3; i++) press("PageDown");
      expect(at()).toBe(xs(ed)[3]);
      expect(heard).toEqual([]);
      press("PageDown");
      expect(at()).toBe(xs(ed)[0]);
      expect(heard).toEqual([["wrap", "wrapped"]]);
      press("PageUp");
      expect(at()).toBe(xs(ed)[3]);
      expect(heard).toEqual([
        ["wrap", "wrapped"],
        ["wrap", "wrapped"],
      ]);
    });

    test("beeps when there is nothing to find, and stays where it is", () => {
      const { ed, searchFor, heard, first } = rig(l);
      searchFor("zzz");
      expect(heard).toEqual([["beep", "no-match"]]);
      expect(ed.focusedNode()).toBe(first);
      expect(ed.said).toContain("No match found");
    });

    test("beeps when the only match is the block that has the focus", () => {
      const { ed, searchFor, press, heard } = rig(l);
      searchFor("g");
      expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
        "g"
      );
      heard.length = 0;
      press("PageDown");
      expect(heard).toEqual([["beep", "no-match"]]);
      expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
        "g"
      );
    });

    test("ignore case, exact match (a whole word), regex", () => {
      const { ed, press, typeIn, tick, enter, at, searchFor } = rig(l);
      press("F3");
      typeIn("X");
      tick("isIgnoreCase");
      enter();
      expect(at()).toBe(xs(ed)[0]);

      // the focus is on the first x: "xy" is skipped, it is not the word x
      press("F3");
      typeIn("x");
      tick("isIgnoreCase"); // (off again)
      tick("isExactMatch");
      enter();
      expect(at()).toBe(xs(ed)[2]);

      press("F3");
      typeIn("[fg]");
      tick("isExactMatch"); // (off)
      tick("isRegex");
      enter();
      // nothing after the x at that place... g is before it: on from the start of the document, f
      expect(text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)).toBe(
        "f"
      );
      // a pattern that is not finished matches nothing
      searchFor("(");
      expect(ed.search.find(true)).toBeNull();
    });

    test("with nothing typed, steps through the blocks one by one", () => {
      const { ed, press, tick, enter, first } = rig(l);
      press("F3");
      tick("isIgnoreCase"); // (chooses this search)
      tick("isIgnoreCase");
      enter();
      const order = all(ed);
      expect(ed.focusedNode()).toBe(order[order.indexOf(first) + 1]);
      press("PageDown");
      expect(ed.focusedNode()).toBe(order[order.indexOf(first) + 2]);
      press("PageUp");
      expect(ed.focusedNode()).toBe(order[order.indexOf(first) + 1]);
    });

    test("skips matches inside a collapsed block; the block's own text still counts", () => {
      const { ed, searchFor, first, at, press } = rig(l);
      ed.collapse(first, true);
      searchFor("x");
      expect(at()).toBe(xs(ed)[1]); // (the x inside the collapsed first block is not reachable)
      searchFor("f");
      // f is in the collapsed block (hidden); the only other f is none: nothing found
      expect(
        text(ed).slice(ed.focusedNode()!.from, ed.focusedNode()!.to)
      ).not.toBe("f");
      ed.collapse(first, false);
      ed.focusNode(ed.roots().filter((r) => r.kind !== "error")[1]);
      press("PageDown");
      expect(ed.focusedNode()).not.toBeNull();
    });
  });

  describe("by block type", () => {
    const choose = (r: ReturnType<typeof rig>, type: string) => {
      r.press("F3");
      const tab = r.dlg()!.querySelectorAll<HTMLElement>("[role=tab]")[1];
      tab.click();
      const sel = r.dlg()!.querySelector("select") as HTMLSelectElement;
      sel.value = type;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      key(sel, "Enter");
    };

    test("lists the types of block there are, by their labels, in order", () => {
      const r = rig(l);
      r.press("F3");
      r.dlg()!.querySelectorAll<HTMLElement>("[role=tab]")[1].click();
      const options = Array.from(r.dlg()!.querySelectorAll("option")).map(
        (o) => o.textContent
      );
      expect(options).toEqual([...options].sort());
      expect(options).toEqual(r.ed.search.types());
      expect(options).toContain("call");
      expect(options.length).toBeGreaterThanOrEqual(2);
    });

    test("goes to the next block of the type, and on from the end with the wrap sound; PageUp goes back", () => {
      const r = rig(l);
      const order = all(r.ed);
      const calls = order.filter((n) => n.kind === "call");
      expect(calls.length).toBe(2);
      choose(r, "call");
      // (the block that has the focus is never the match: the first call AFTER it, in the order of the blocks)
      const after = calls.find(
        (c) => order.indexOf(c) > order.indexOf(r.first)
      )!;
      expect(r.ed.focusedNode()).toBe(after);
      const other = calls.find((c) => c !== after)!;
      r.heard.length = 0;
      if (order.indexOf(other) > order.indexOf(after)) {
        r.press("PageDown");
        expect(r.ed.focusedNode()).toBe(other);
        expect(r.heard).toEqual([]);
        r.press("PageDown");
      } else {
        r.press("PageDown"); // no more calls: back to the first
      }
      expect(r.ed.focusedNode()).toBe(calls[0]);
      expect(r.heard).toEqual([["wrap", "wrapped"]]);
      r.press("PageUp");
      expect(r.ed.focusedNode()).toBe(calls[1]);
      expect(r.heard.length).toBe(2);
    });
  });

  describe("before anything is chosen", () => {
    test("PageDown and PageUp beep and say so, and stay", () => {
      const { ed, press, heard, first } = rig(l);
      press("PageDown");
      press("PageUp");
      expect(ed.focusedNode()).toBe(first);
      expect(heard).toEqual([
        ["beep", "no-match"],
        ["beep", "no-match"],
      ]);
      expect(ed.said).toContain("No search settings have been selected");
    });
  });

  describe("the search rotor", () => {
    test("starts at the first type, goes forwards with a wrap, and the same backwards", () => {
      const { ed, press } = rig(l);
      const ts = ed.search.types();
      const n = ts.length;
      for (let i = 0; i <= n; i++) press("F3", { ctrlKey: true });
      expect(ed.said.filter((s) => s.startsWith("Searching by"))).toEqual([
        ...ts.map((t, i) => `Searching by ${t}, ${i + 1} of ${n}`),
        `Searching by ${ts[0]}, 1 of ${n}`,
      ]);
      const r2 = rig(l);
      for (let i = 0; i < 2; i++)
        r2.press("F3", { ctrlKey: true, shiftKey: true });
      expect(r2.said().filter((s) => s.startsWith("Searching by"))).toEqual([
        `Searching by ${ts[n - 1]}, ${n} of ${n}`,
        `Searching by ${ts[n - 2]}, ${n - 1} of ${n}`,
      ]);
    });

    test("makes PageDown go to the next block of the chosen type", () => {
      const { ed, press } = rig(l);
      const ts = ed.search.types();
      const i = ts.indexOf("call");
      for (let k = 0; k <= i; k++) press("F3", { ctrlKey: true });
      expect(ed.search.settings().block.blockType).toBe("call");
      press("PageDown");
      expect(ed.focusedNode()!.kind).toBe("call");
      expect(ed.focusedNode()).not.toBe(ed.roots()[0]);
    });

    test("a text search from the dialog is the last entry, and the rotor lands on it", () => {
      const { ed, searchFor, press } = rig(l);
      searchFor("xy");
      const n = ed.search.types().length + 1;
      ed.said.length = 0;
      press("F3", { ctrlKey: true }); // from the text search: on to the first type
      press("F3", { ctrlKey: true, shiftKey: true }); // and back
      expect(ed.said).toEqual([
        `Searching by ${ed.search.types()[0]}, 1 of ${n}`,
        `Searching for text 'xy', ${n} of ${n}`,
      ]);
    });

    test("says so when there is nothing to search for", () => {
      const { ed } = rig(l, "");
      ed.search.rotor(true);
      expect(ed.said).toContain("No search types available");
    });
  });

  test("a search through the API: set, then next, with no dialog", () => {
    const { ed, at } = rig(l);
    ed.search.set({ searchString: "xy" });
    expect(ed.search.settings().mode).toBe("text");
    expect(ed.search.next()).toBe(true);
    expect(at()).toBe(text(ed).indexOf("xy"));
  });

  test("the keys are in the key table, so the help dialog lists them", () => {
    const { press } = rig(l);
    press("?", { ctrlKey: true, shiftKey: true, code: "Slash" });
    const help = document.querySelector(
      ".blocks-help:not(.blocks-search)"
    ) as HTMLElement;
    for (const w of [
      "F3",
      "Ctrl-F",
      "PageDown",
      "PageUp",
      "Ctrl-F3",
      "Shift-Ctrl-F3",
    ])
      expect(help.textContent).toContain(w);
  });
});
