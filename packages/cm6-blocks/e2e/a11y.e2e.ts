// Fifth round, step 5: what Chromium's accessibility tree says of the blocks, after an insert, a delete, a selection and an undo, and
// what focus events the editor's focus restore makes. Evidence about the tree and about events; NOT about a real screen reader.
// Writes e2e/a11y-results.json and e2e/a11y-outline-<lang>.txt (the outline of the first snapshot).
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const SMALL: Record<string, string> = {
  scheme: "(f 1 (g 2) 3)\n(h 4)\n",
  javascript: "f(1, g(2), 3);\nh(4);\n",
  python: "f(1, g(2), 3)\nh(4)\n",
};
const results: Record<string, any> = {};

type AX = {
  nodeId: string;
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  properties?: { name: string; value: { value: any } }[];
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
};

for (const lang of Object.keys(SMALL)) {
  test(`accessibility: ${lang}`, async ({ page, context }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForSelector(".cm-content [role=treeitem]");
    const load = (t: string) =>
      page.evaluate((t) => {
        const d = (window as any).demo;
        d.ed.view.dispatch({
          changes: { from: 0, to: d.ed.view.state.doc.length, insert: t },
        });
      }, t);
    await load(SMALL[lang]);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Accessibility.enable");

    /** the accessibility tree under the editor's `tree`, as indented lines */
    const outlineOf = async (
      cdp: any
    ): Promise<{ lines: string[]; problems: string[]; staticText: number }> => {
      const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
        nodes: AX[];
      };
      const byId = new Map(nodes.map((n) => [n.nodeId, n]));
      const prop = (n: AX, k: string) =>
        n.properties?.find((p) => p.name === k)?.value.value;
      const tree = nodes.find((n) => n.role?.value === "tree");
      const lines: string[] = [];
      const problems: string[] = [];
      let staticText = 0;
      if (!tree)
        return {
          lines,
          problems: ["no tree in the accessibility tree"],
          staticText,
        };
      const walk = (n: AX, depth: number, itemDepth: number): void => {
        const role = n.role?.value ?? "?";
        if (n.ignored) {
          for (const c of n.childIds ?? [])
            walk(byId.get(c)!, depth, itemDepth);
          return;
        }
        let d = depth;
        let id = itemDepth;
        if (role === "treeitem") {
          id = itemDepth + 1;
          const flags = [
            prop(n, "level") !== undefined ? `level=${prop(n, "level")}` : "",
            prop(n, "selected") ? "selected" : "",
            prop(n, "expanded") !== undefined
              ? `expanded=${prop(n, "expanded")}`
              : "",
            prop(n, "focused") ? "FOCUSED" : "",
          ].filter(Boolean);
          lines.push(
            `${"  ".repeat(depth)}treeitem "${n.name?.value ?? ""}" [${flags.join(", ")}]`
          );
          if (!n.name?.value) problems.push("a treeitem has no name");
          if (prop(n, "level") !== id)
            problems.push(
              `treeitem "${n.name?.value}": level ${prop(n, "level")}, nesting depth ${id}`
            );
          d = depth + 1;
        } else if (
          role === "StaticText" ||
          role === "text" ||
          role === "InlineTextBox" ||
          role === "LineBreak"
        ) {
          staticText++;
        } else if (role !== "generic" && role !== "none" && role !== "group") {
          lines.push(`${"  ".repeat(depth)}${role} "${n.name?.value ?? ""}"`);
          d = depth + 1;
        }
        for (const c of n.childIds ?? []) walk(byId.get(c)!, d, id);
      };
      lines.push(
        `tree "${tree.name?.value}" [multiselectable=${prop(tree, "multiselectable")}]`
      );
      for (const c of tree.childIds ?? []) walk(byId.get(c)!, 1, 0);
      return { lines, problems, staticText };
    };

    const outline = () => outlineOf(cdp);

    /** aria-setsize / aria-posinset / expanded / selected of every drawn block, from the DOM (Chromium does not put set sizes in this tree) */
    const domChecks = (): Promise<string[]> =>
      page.evaluate(() => {
        const out: string[] = [];
        const items = Array.from(
          document.querySelectorAll(".cm-content [role=treeitem]")
        ) as HTMLElement[];
        const groups = new Map<Element, HTMLElement[]>();
        for (const it of items) {
          // (a comment is not counted: no set size, no position; one that goes with a block is not a treeitem at all)
          if (it.classList.contains("blocks-comment")) {
            if (
              it.hasAttribute("aria-posinset") ||
              it.hasAttribute("aria-setsize")
            )
              out.push(
                `${it.getAttribute("aria-label")}: a comment has a count`
              );
            continue;
          }
          const parentItem =
            it.parentElement?.closest("[role=treeitem]") ?? null;
          const holder = parentItem
            ? ((it.parentElement as Element).closest("[data-slot]") ??
              parentItem)
            : document.querySelector(".cm-content")!;
          const k = parentItem
            ? holder
            : (document.querySelector(".cm-content") as Element);
          groups.set(k, [...(groups.get(k) ?? []), it]);
        }
        for (const [, g] of groups) {
          g.forEach((it, i) => {
            if (Number(it.getAttribute("aria-posinset")) !== i + 1)
              out.push(
                `${it.getAttribute("aria-label")}: posinset ${it.getAttribute("aria-posinset")}, position ${i + 1}`
              );
            if (Number(it.getAttribute("aria-setsize")) !== g.length)
              out.push(
                `${it.getAttribute("aria-label")}: setsize ${it.getAttribute("aria-setsize")}, siblings ${g.length}`
              );
          });
        }
        for (const it of items) {
          const compound =
            it.classList.contains("blocks-compound") ||
            it.classList.contains("blocks-comment");
          if (compound !== it.hasAttribute("aria-expanded"))
            out.push(
              `${it.getAttribute("aria-label")}: aria-expanded ${it.getAttribute("aria-expanded")} on a ${compound ? "compound" : "leaf"} block`
            );
          if (
            !["true", "false"].includes(it.getAttribute("aria-selected") ?? "")
          )
            out.push(`${it.getAttribute("aria-label")}: no aria-selected`);
          if (!it.getAttribute("aria-label"))
            out.push("a block has no aria-label");
        }
        return out;
      });

    /** the same text in a fresh editor (a second page), with the same blocks selected: its outline must be the live one (nothing stale, nothing twice) */
    const page2 = await context.newPage();
    await page2.goto(`/index.html?lang=${lang}`);
    await page2.waitForSelector(".cm-content [role=treeitem]");
    const cdp2 = await context.newCDPSession(page2);
    await cdp2.send("Accessibility.enable");
    const freshOutline = async (): Promise<string[]> => {
      const state = await page.evaluate(() => {
        const d = (window as any).demo;
        return {
          text: d.ed.view.state.doc.toString(),
          sel: d.ed.selectedBlocks().map((n: any) => [n.from, n.to, n.kind]),
        };
      });
      await page2.evaluate((s) => {
        (window as any).demo.show(s.text);
        const d = (window as any).demo;
        for (const [from, to, kind] of s.sel) {
          let hit: any = null;
          d.ed.roots().forEach((r: any) => {
            const w = (n: any) => {
              if (n.from === from && n.to === to && n.kind === kind)
                hit = hit ?? n;
              n.slots.forEach((q: any) => q.nodes.forEach(w));
            };
            w(r);
          });
          if (hit) d.ed.toggleSelect(hit);
        }
      }, state);
      await page2.waitForSelector(".cm-content [role=treeitem]");
      await page.bringToFront();
      return (await outlineOf(cdp2)).lines;
    };

    // focus events, recorded in the page (target, where focus goes, and what is active when the event fires)
    await page.evaluate(() => {
      const desc = (e: any): string =>
        !e
          ? "null"
          : e === document.body
            ? "BODY"
            : e === document.documentElement
              ? "HTML"
              : e.getAttribute?.("aria-label")
                ? `block(${e.getAttribute("aria-label")})`
                : e.tagName?.toLowerCase() +
                  (e.className ? "." + String(e.className).split(" ")[0] : "");
      (window as any).__focus = [];
      for (const t of ["focusin", "focusout"])
        document.addEventListener(
          t,
          (e: any) =>
            (window as any).__focus.push(
              `${t} ${desc(e.target)} -> ${desc(e.relatedTarget)} (active ${desc(document.activeElement)})`
            ),
          true
        );
      (window as any).__desc = desc;
    });
    const clearFocusLog = () =>
      page.evaluate(() => ((window as any).__focus = []));
    /** run `f`, then watch `activeElement` for 5 frames: a frame where it is the body would be a moment without focus */
    const watch = async (f: () => Promise<void>) => {
      await clearFocusLog();
      await page.evaluate(() => {
        (window as any).__frames = [];
        let n = 0;
        const tick = () => {
          (window as any).__frames.push(
            (window as any).__desc(document.activeElement)
          );
          if (++n < 6) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await f();
      await page.waitForTimeout(160);
      return page.evaluate(() => ({
        events: (window as any).__focus as string[],
        frames: (window as any).__frames as string[],
        restores: (window as any).demo.ed.stats().focusRestores as number,
      }));
    };

    const cases: Record<string, any> = {};
    const record = async (name: string, f: () => Promise<void>) => {
      const before = await page.evaluate(
        () => (window as any).demo.ed.stats().focusRestores
      );
      const w = await watch(f);
      const o = await outline();
      const dom = await domChecks();
      const fresh = await freshOutline();
      const same =
        JSON.stringify(
          fresh.map((l) => l.replace(/ FOCUSED/g, "").replace(/, *\]/, "]"))
        ) ===
        JSON.stringify(
          o.lines.map((l) => l.replace(/ FOCUSED/g, "").replace(/, *\]/, "]"))
        );
      cases[name] = {
        treeProblems: o.problems,
        domProblems: dom,
        sameAsAFreshEditor: same,
        staticTextNodesInTree: o.staticText,
        focusEvents: w.events,
        activeElementPerFrame: w.frames,
        focusRestoresDuringTheCase: w.restores - before,
        treeitems: o.lines.filter((l) => l.includes("treeitem")).length,
      };
      if (!same)
        cases[name].diff = o.lines
          .filter((l, i) => l !== fresh[i])
          .slice(0, 4)
          .concat(
            ["--- fresh"],
            fresh.filter((l, i) => l !== o.lines[i]).slice(0, 4)
          );
      return o;
    };
    const lit = (t: string) =>
      page
        .locator(".cm-content .blocks-literal", {
          hasText: new RegExp(`^${t}$`),
        })
        .first();

    // 0: the program as loaded
    const first = await record("0 loaded", async () => {});
    fs.writeFileSync(
      path.join(__dirname, `a11y-outline-${lang}.txt`),
      first.lines.join("\n") + "\n"
    );
    // focus the 2 (inside g(2)), then insert a 7 into f's arguments through the editor
    await lit("2").click({ modifiers: ["Shift"] });
    await record("1 insert (a block is focused in the same call)", async () => {
      await page.evaluate(() => {
        const d = (window as any).demo;
        const call = (() => {
          let hit: any = null;
          d.ed.roots().forEach((r: any) => {
            const w = (n: any) => {
              if (!hit && n.slots.some((s: any) => s.name === "args")) hit = n;
              n.slots.forEach((s: any) => s.nodes.forEach(w));
            };
            w(r);
          });
          return hit;
        })();
        d.ed.insertText(
          call.slots.find((s: any) => s.name === "args"),
          1,
          "7"
        );
      });
    });
    // delete the 3 with the key
    await lit("3").click({ modifiers: ["Shift"] });
    await record(
      "2 delete (the focused block: selected with Space, then the Delete key)",
      async () => {
        await page.keyboard.press("Space");
        await page.keyboard.press("Delete");
      }
    );
    // select two blocks with Space
    await lit("1").click({ modifiers: ["Shift"] });
    await record("3 selection (Space on 1 and on 4)", async () => {
      await page.keyboard.press("Space");
      await lit("4").click({ modifiers: ["Shift"] });
      await page.keyboard.press("Space");
    });
    // undo the delete
    await record("4 undo (Ctrl/Cmd-Z)", async () => {
      await page.keyboard.press("ControlOrMeta+z");
    });
    results[lang] = cases;
    fs.writeFileSync(
      path.join(__dirname, "a11y-results.json"),
      JSON.stringify(results, null, 1)
    );
    // the checks that must hold
    for (const [name, c] of Object.entries(cases)) {
      expect(c.treeProblems, name).toEqual([]);
      expect(c.domProblems, name).toEqual([]);
      expect(c.sameAsAFreshEditor, name).toBe(true);
    }
  });
}
