/*
 * The soak runner's jsdom engine (scripts/soak.js, spec/soak.test.ts): one sequence of steps (spec/soak-gen.ts) through the editor's real API and
 * its key handlers, with the invariants checked after EVERY step. `runJsdom` returns the first violation, or null.
 */
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { walk } from "../src/doc";
import {
  checkLezerEditor,
  createLezerBlockEditor,
  LezerBlockEditor,
} from "../src/lezer-view";
import type { BNode, Slot } from "../src/types";
import { removeOracle, LANGS } from "./steps";
import { a11yProblems, focusProblem } from "./soak-dom";
import {
  at,
  makeSequence,
  Sequence,
  shrink,
  Step,
  Violation,
} from "./soak-gen";

const zeroRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  toJSON: () => ({}),
};
if (!Range.prototype.getClientRects)
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect)
  Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;

/*
 * jsdom's focus() differs from Chrome's in one way that matters here: when a blur handler moves the focus itself (the edit box that commits
 * and writes the text when focus leaves it, then focuses the block at that place), Chrome keeps where the handler put it, and gives up the
 * move it was making when its target left the document; jsdom finishes the move and ends with the focus on a detached element (the page
 * body). Without this, every focus move out of an open box that rewrites its target is reported as a lost focus (soak, triage of round 38).
 */
{
  const realFocus = HTMLElement.prototype.focus;
  let depth = 0;
  let inner: HTMLElement | null = null;
  const focusing = (el: HTMLElement, args: Parameters<typeof realFocus>) => {
    if (depth === 0) inner = null;
    depth++;
    try {
      realFocus.apply(el, args);
    } finally {
      depth--;
    }
    if (depth > 0) {
      inner = el;
      return;
    }
    const moved = inner as HTMLElement | null;
    inner = null;
    if (moved && moved !== el && moved.isConnected && !el.isConnected)
      realFocus.call(moved);
  };
  HTMLElement.prototype.focus = function (this: HTMLElement, ...args) {
    focusing(this, args);
  };
}

/** what a call may throw on purpose (the documented refusals of the editor's API): not a finding */
const REFUSALS =
  /cannot|can't|no place|inside|overlap|refus|only available|not between blocks|no closing bracket|does not go there|takes one block|needs a list|does not parse|would not parse|template string|no slot|not a list|unparse/i;

const mac = false;
function keyInit(spec: string): KeyboardEventInit & { key: string } {
  const parts = spec.split("+");
  let key = parts.pop() as string;
  if (spec.endsWith("++")) key = "+";
  const init: KeyboardEventInit & { key: string } = {
    key,
    bubbles: true,
    cancelable: true,
  };
  for (const m of parts) {
    if (m === "Shift") init.shiftKey = true;
    else if (m === "Alt") init.altKey = true;
    else if (m === "Control" || (m === "Mod" && !mac)) init.ctrlKey = true;
    else if (m === "Mod") init.metaKey = true;
  }
  if (key === "Space") init.key = " ";
  if (key === "[") init.code = "BracketLeft";
  if (key === "]") init.code = "BracketRight";
  return init;
}

const blocksOf = (ed: LezerBlockEditor): BNode[] => {
  const o: BNode[] = [];
  ed.roots().forEach((r) =>
    walk(r, (n) => {
      if (n.kind !== "error") o.push(n);
    })
  );
  return o;
};
const treeShape = (ed: LezerBlockEditor): string =>
  blocksOf(ed)
    .map((n) => `${n.kind}:${n.from}-${n.to}:${n.value ?? ""}`)
    .join("|");

/** where two tree shapes first differ: the blocks around it in each */
const firstDifference = (a: string, b: string): string => {
  const x = a.split("|");
  const y = b.split("|");
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const near = (l: string[]) => l.slice(Math.max(0, i - 1), i + 2).join("|");
  return `first difference at block ${i} of ${x.length} and ${y.length}: ${near(x).slice(0, 160)} vs ${near(y).slice(0, 160)}`;
};

export interface JsdomOptions {
  /** a step that takes longer than this (ms) is "stuck" */
  stepTimeoutMs?: number;
  /** check that undoing everything returns to the initial text, and redoing restores the end (default true) */
  undoAll?: boolean;
  /** invariants not to check (a known finding that hides others) */
  skip?: string[];
  /** called after each step (for debugging a failure by hand: what the text is, which mode) */
  onStep?: (i: number, step: Step, ed: LezerBlockEditor) => void;
}

export function runJsdom(
  seq: Sequence,
  options: JsdomOptions = {}
): Violation | null {
  const L = LANGS[seq.language];
  const skip = new Set(options.skip ?? []);
  // (jsdom is very slow at the work a long document needs, such as one block that takes thousands of children, one at a time: about 14 s
  // for a 29 KB document, 0.2 s in Chromium. The limit grows with the size of the document, so that a real hang is still found)
  const stepTimeout =
    options.stepTimeoutMs ?? 10000 + 2 * (seq.code?.length ?? 0);
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => errors.push(`uncaught: ${e.message}`);
  window.addEventListener("error", onError);
  const realError = console.error;
  const realWarn = console.warn;
  const collect =
    (kind: string) =>
    (...a: unknown[]) => {
      const text = a.map(String).join(" ");
      if (!/Not implemented/.test(text))
        errors.push(`console.${kind}: ${text.slice(0, 300)}`);
    };
  console.error = collect("error");
  console.warn = collect("warn");
  let ed: LezerBlockEditor | null = null;
  let freshHost: HTMLElement | null = null;
  const done = (v: Violation | null): Violation | null => {
    console.error = realError;
    console.warn = realWarn;
    window.removeEventListener("error", onError);
    try {
      ed?.destroy();
    } catch (_) {
      /* already broken: the violation is the report */
    }
    parent.remove();
    freshHost?.remove();
    return v;
  };
  try {
    ed = createLezerBlockEditor(parent, seq.code, L.opts);
  } catch (e) {
    return done({
      invariant: "exception",
      message: `creating the editor: ${(e as Error).message}`,
      step: -1,
      op: "create",
    });
  }
  const view = ed.view;
  const text = () => view.state.doc.toString();
  const inBlocks = () => ed!.mode === "blocks";
  const log: string[] = [];
  const press = (spec: string, target?: Element | null) => {
    const el =
      target ??
      view.dom.querySelector(".blocks-edit") ??
      (ed!.focusedNode() && ed!.renderer.element(ed!.focusedNode()!).isConnected
        ? ed!.renderer.element(ed!.focusedNode()!)
        : null) ??
      (document.activeElement && view.dom.contains(document.activeElement)
        ? document.activeElement
        : view.contentDOM);
    el.dispatchEvent(new KeyboardEvent("keydown", keyInit(spec)));
  };
  const box = (): HTMLInputElement | HTMLTextAreaElement | null =>
    view.dom.querySelector(".blocks-edit");
  const fill = (b: HTMLInputElement | HTMLTextAreaElement, v: string) => {
    b.value = v;
    b.dispatchEvent(new Event("input", { bubbles: true }));
  };
  /** an open box: type `t` into it, then Enter (accept) or Escape */
  const finishBox = (t: string, accept: boolean) => {
    const b = box();
    if (!b) return;
    fill(b, t);
    press(accept ? "Enter" : "Escape", b);
  };
  const nodeAt = (a: unknown): BNode | null => {
    const all = blocksOf(ed!);
    const i = at(a, all.length);
    return i < 0 ? null : all[i];
  };
  const listSlots = (): Slot[] =>
    blocksOf(ed!)
      .flatMap((n) => n.slots)
      .filter((s) => s.kind === "list" && !s.pieces);
  const gapOf = (
    a: unknown,
    b: unknown
  ): { slot: Slot; index: number } | null => {
    const ss = listSlots();
    const i = at(a, ss.length);
    if (i < 0) return null;
    return {
      slot: ss[i],
      index: Math.floor(Number(b) * (ss[i].nodes.length + 1)),
    };
  };

  let noUndoCheck = false;
  let armed = false;
  const toolbarOk = false;

  /** the mode switch of a step; the old editor's rule: blocks mode after text edits starts the history over (the undo-all check is then off) */
  const switchMode = (to: "text" | "blocks"): void => {
    const before = undoDepth(view.state);
    ed!.setMode(to);
    if (before > 0 && undoDepth(view.state) === 0) noUndoCheck = true;
  };
  /** a copy, cut or paste event as the browser sends it for Mod+c, Mod+x and Mod+v; returns the text a copy or cut put on the clipboard */
  const clipEvent = (
    el: Element,
    type: "copy" | "cut" | "paste",
    text = ""
  ): string => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
      clipboardData: unknown;
    };
    let out = "";
    e.clipboardData = {
      getData: () => text,
      setData: (_: string, v: string) => (out = v),
    };
    el.dispatchEvent(e);
    return out;
  };

  const exec = (s: Step): void => {
    const blocks = inBlocks();
    switch (s.op) {
      case "focus": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n) ed!.focusNode(n);
        return;
      }
      case "key": {
        if (!blocks && !/^Mod\+/.test(String(s.key))) return;
        press(String(s.key));
        return;
      }
      case "editBox":
      case "typeIntoBlock": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (!n) return;
        ed!.focusNode(n);
        press(s.op === "editBox" ? "Enter" : String(s.text)[0]);
        finishBox(String(s.text), !!s.accept);
        return;
      }
      case "comment": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (!n) return;
        ed!.focusNode(n);
        press("Control+Shift+]");
        finishBox(String(s.text), !!s.accept);
        return;
      }
      case "collapse": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n && n.slots.length) ed!.collapse(n, !!s.on);
        return;
      }
      case "collapseAll":
        if (blocks) ed!.collapseAll(!!s.on);
        return;
      case "toggleMode": {
        switchMode(blocks ? "text" : "blocks");
        return;
      }
      case "brokenText": {
        // text mode, broken syntax at a place of the text, then back to blocks (refused while it does not parse: the editor stays in text mode)
        if (blocks) switchMode("text");
        const len = view.state.doc.length;
        const from = Math.min(len, Math.floor(Number(s.a) * (len + 1)));
        view.dispatch({
          changes: { from, insert: (s.nl ? "\n" : "") + String(s.w) },
        });
        if (s.back) switchMode("blocks");
        return;
      }
      case "undoRun":
        for (let k = 0; k < Number(s.n); k++) (s.redo ? redo : undo)(view);
        return;
      case "collapseBurst": {
        if (!blocks) return;
        for (let k = 0; k < Number(s.n); k++) {
          const n = nodeAt((Number(s.a) + k * 0.137) % 1);
          if (n && n.slots.length) ed!.collapse(n, !!s.on);
        }
        return;
      }
      case "collapseAllThen":
        if (!blocks) return;
        ed!.collapseAll(!!s.on);
        exec({ op: "editBox", a: s.a, text: s.text, accept: s.accept });
        return;
      case "multiSelect": {
        if (!blocks) return;
        let last: BNode | null = null;
        for (let k = 0; k < Number(s.n); k++) {
          const n = nodeAt((Number(s.a) + k * 0.137) % 1);
          if (n && ed!.toggleSelect(n) === "selected") last = n;
        }
        if (!last) return;
        ed!.focusNode(last);
        const el = () => ed!.renderer.element(ed!.focusedNode() ?? last!);
        if (s.then === "delete") {
          press("Delete");
        } else {
          // cut / copy and paste through the clipboard events the browser sends for Mod+x, Mod+c and Mod+v
          const out = clipEvent(el(), s.then === "copyPaste" ? "copy" : "cut");
          if (s.then !== "delete" && out) {
            ed!.clearSelection();
            const n = nodeAt(s.b);
            if (n) {
              ed!.focusNode(n);
              clipEvent(el(), "paste", out);
            }
          }
        }
        return;
      }
      case "commentNear": {
        if (!blocks) return;
        const all = blocksOf(ed!);
        const comments = all
          .map((n, i) => (n.kind === "comment" ? i : -1))
          .filter((i) => i >= 0);
        let n: BNode | null;
        if (comments.length) {
          const c = comments[at(s.a, comments.length)];
          n = all[Math.max(0, Math.min(all.length - 1, c + Number(s.dir)))];
        } else n = nodeAt(s.a);
        if (!n) return;
        ed!.focusNode(n);
        press("Control+Shift+]");
        finishBox(String(s.text), !!s.accept);
        return;
      }
      case "pasteMulti": {
        // (the same as a paste at the top level: `topLevelType` with several forms)
        exec({ ...s, op: "topLevelType", how: "paste" });
        return;
      }
      case "undo":
        undo(view);
        return;
      case "redo":
        redo(view);
        return;
      case "search": {
        if (!blocks) return;
        press("F3");
        const dlg = document.querySelector(".blocks-search");
        const input = dlg?.querySelector(
          "input[type=text]"
        ) as HTMLInputElement | null;
        if (input) {
          fill(input, String(s.text));
          press("Enter", input);
          if (s.next)
            press(
              "PageDown",
              ed!.focusedNode()
                ? ed!.renderer.element(ed!.focusedNode()!)
                : view.contentDOM
            );
          press("Escape", input);
        }
        return;
      }
      case "textEdit": {
        const len = view.state.doc.length;
        const from = Math.min(len, Math.floor(Number(s.a) * (len + 1)));
        const to = Math.min(len, from + Number(s.len));
        view.dispatch({ changes: { from, to, insert: String(s.w) } });
        return;
      }
      case "select": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n) ed!.toggleSelect(n);
        return;
      }
      case "clearSelection":
        if (blocks) ed!.clearSelection();
        return;
      case "topLevelType": {
        if (!blocks) return;
        const len = view.state.doc.length;
        let pos = Math.min(len, Math.floor(Number(s.a) * (len + 1)));
        const start = pos;
        while (pos <= len && !ed!.isWhitespaceAt(pos)) pos++;
        if (pos > len) {
          pos = start;
          while (pos >= 0 && !ed!.isWhitespaceAt(pos)) pos--;
          if (pos < 0) return;
        }
        view.dispatch({
          changes: { from: pos, insert: String(s.text) },
          userEvent: s.how === "paste" ? "input.paste" : "input.type",
        });
        ed!.flushTopLevel();
        const b = view.dom.querySelector(
          ".blocks-pending .blocks-edit"
        ) as HTMLInputElement | null;
        if (b) {
          fill(b, String(s.text));
          press(s.accept ? "Enter" : "Escape", b);
        }
        return;
      }
      // ---- the API ----
      case "insertText": {
        if (!blocks) return;
        const g = gapOf(s.a, s.b);
        if (g) ed!.insertText(g.slot, g.index, String(s.text));
        return;
      }
      case "removeNode": {
        if (!blocks) return;
        const lists = listSlots().filter((q) => q.nodes.length);
        const q = lists[at(s.a, lists.length)];
        if (!q) return;
        const n =
          q.nodes[
            Math.floor(Number(s.b ?? s.a) * q.nodes.length) % q.nodes.length
          ];
        removeOracle(ed!, [n], log, seq.language !== "scheme", () =>
          ed!.removeNode(n)
        );
        return;
      }
      case "removeSelection": {
        if (!blocks) return;
        const sel = ed!.selectedBlocks().filter((n) => n.slot);
        if (sel.length)
          removeOracle(ed!, sel, log, seq.language !== "scheme", () =>
            ed!.removeNodes(sel)
          );
        return;
      }
      case "moveNode": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        const g = gapOf(s.b, s.a);
        if (n && g) ed!.moveNode(n, g);
        return;
      }
      case "moveSelection": {
        if (!blocks) return;
        const sel = ed!.selectedBlocks();
        const g = gapOf(s.a, s.a);
        if (sel.length && g) ed!.moveNodes(sel, g);
        return;
      }
      case "pasteText": {
        if (!blocks) return;
        ed!.pasteText(nodeAt(s.a), String(s.text), !!s.before);
        return;
      }
      case "replaceText": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n) ed!.replaceText(n, String(s.text));
        return;
      }
      case "replaceWithTexts": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n) ed!.replaceWithTexts(n, s.texts as string[]);
        return;
      }
      case "insertTemplate": {
        if (!blocks) return;
        const ts = ed!.templates();
        const t = ts[at(s.t, ts.length)];
        if (t) ed!.insertTemplate(t.name, nodeAt(s.a));
        return;
      }
      case "insertTemplateAt": {
        if (!blocks) return;
        const ts = ed!.templates();
        const t = ts[at(s.t, ts.length)];
        const g = gapOf(s.a, s.b);
        if (t && g) ed!.insertTemplateAt(t.name, g);
        return;
      }
      case "setComment": {
        if (!blocks) return;
        const n = nodeAt(s.a);
        if (n) ed!.setComment(n, String(s.text));
        return;
      }
      case "replaceDoc":
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: String(s.text),
          },
          // (CodeMirror maps a range that lies inside the replaced text to one that ends before it starts, and its own Delete then throws:
          // a host that replaces the document sets the selection)
          selection: { anchor: 0 },
        });
        return;
      default:
        throw new Error(`unknown step ${s.op}`);
    }
  };

  /** the invariants; the first one that does not hold, else null */
  const checkAll = (): { invariant: string; message: string } | null => {
    if (errors.length) {
      const m = errors.splice(0).join(" | ");
      return { invariant: "exception", message: m };
    }
    if (inBlocks()) {
      const problems = checkLezerEditor(ed!);
      if (problems.length)
        return {
          invariant: "consistency",
          message: problems.slice(0, 3).join(" | "),
        };
      // the text read again from nothing gives the blocks that are shown
      const host = document.createElement("div");
      document.body.appendChild(host);
      freshHost = host;
      let fresh: LezerBlockEditor | null = null;
      try {
        fresh = createLezerBlockEditor(host, text(), L.opts);
        const a = treeShape(ed!);
        const b = treeShape(fresh);
        // (a text with a parse error, which a document cut from a real file can have: Lezer's incremental parse is not guaranteed to
        // recover from an error the way a fresh parse does, and the editor draws what its own tree gives: checkLezerEditor holds it to that)
        if (
          a !== b &&
          ed!.modeProblem() === null &&
          fresh.modeProblem() === null
        )
          return {
            invariant: "reparse",
            message: `the blocks differ from a fresh parse of the text ${JSON.stringify(text().slice(0, 80))}: ${firstDifference(a, b)}`,
          };
      } finally {
        fresh?.destroy();
        host.remove();
        freshHost = null;
      }
      // selection: every selected and focused block is in the tree
      const live = new Set<BNode>();
      ed!.roots().forEach((r) => walk(r, (n) => live.add(n)));
      const bad = ed!.selection().find((n) => !live.has(n));
      if (bad)
        return {
          invariant: "selection",
          message: `a selected ${bad.kind} [${bad.from},${bad.to}) is not in the tree`,
        };
      const fn = ed!.focusedNode();
      if (fn && !live.has(fn))
        return {
          invariant: "selection",
          message: `the focused ${fn.kind} [${fn.from},${fn.to}) is not in the tree`,
        };
      const a11y = a11yProblems();
      if (a11y.length) return { invariant: "a11y", message: a11y.join(" | ") };
    }
    if (view.dom.contains(document.activeElement)) armed = true;
    if (armed) {
      const fp = focusProblem(toolbarOk);
      if (fp) return { invariant: "focus", message: fp };
    }
    return null;
  };

  const check = () => {
    const v = checkAll();
    return v && skip.has(v.invariant) ? null : v;
  };

  // ---- the sequence ----
  const initial = text();
  const first = check();
  if (first) return done({ ...first, step: -1, op: "initial" });
  for (let i = 0; i < seq.steps.length; i++) {
    const step = seq.steps[i];
    const t0 = Date.now();
    try {
      exec(step);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (!REFUSALS.test(msg))
        return done({
          invariant: "exception",
          message: `${msg}\n${((e as Error).stack ?? "").split("\n").slice(1, 4).join(" | ")}`,
          step: i,
          op: step.op,
        });
    }
    if (Date.now() - t0 > stepTimeout)
      return done({
        invariant: "stuck",
        message: `the step took ${Date.now() - t0} ms`,
        step: i,
        op: step.op,
      });
    options.onStep?.(i, step, ed);
    const v = check();
    if (v) return done({ ...v, step: i, op: step.op });
  }
  // ---- undo everything, redo everything ----
  if (options.undoAll !== false && !noUndoCheck) {
    const stop = view.dom.querySelector(".blocks-edit");
    if (stop) press("Escape", stop);
    ed.clearSelection?.();
    const final = text();
    // (a sequence that ends with an undo has a redo history of its own: redoing as many as were undone then reaches another state than the end)
    const redoLeft = redoDepth(view.state) > 0;
    let n = 0;
    while (undoDepth(view.state) > 0 && n < 1000) {
      undo(view);
      n++;
    }
    const undone = n;
    if (text() !== initial)
      return done({
        invariant: "undo-all",
        message: `undoing every step left ${JSON.stringify(text().slice(0, 80))}, not the start ${JSON.stringify(initial.slice(0, 80))}`,
        step: seq.steps.length,
        op: "undo-all",
      });
    // (as many as were undone: the sequence itself may have ended with an undo)
    for (let k = 0; k < undone && redoDepth(view.state) > 0; k++) redo(view);
    if (!redoLeft && text() !== final)
      return done({
        invariant: "redo-all",
        message: `redoing everything left ${JSON.stringify(text().slice(0, 80))}, not ${JSON.stringify(final.slice(0, 80))}`,
        step: seq.steps.length,
        op: "redo-all",
      });
    const v = check();
    if (v) return done({ ...v, step: seq.steps.length, op: "after undo/redo" });
  }
  return done(null);
}

/** a record of a failure (what a worker writes, what `--promote` replays) */
export interface SoakRecord extends Sequence {
  invariant: string;
  message: string;
  step: number;
  op: string;
  /** the number of steps the sequence had before it was shrunk */
  originalSteps: number;
}

/** run seed `seed`; on a violation, shrink the steps (same invariant) and return the record */
export async function soakSeed(
  seed: number,
  nSteps: number,
  opts: {
    language?: Sequence["language"];
    shrinkRuns?: number;
    motion?: boolean;
    skip?: string[];
  } = {}
): Promise<SoakRecord | null> {
  const seq = makeSequence("jsdom", seed, nSteps, opts);
  const v = runJsdom(seq, opts);
  if (!v) return null;
  let steps =
    v.step >= 0 && v.step < seq.steps.length
      ? seq.steps.slice(0, v.step + 1)
      : seq.steps;
  let found = v;
  const same = (c: Violation | null) => !!c && c.invariant === v.invariant;
  steps = await shrink(
    steps,
    async (cand) => {
      const c = runJsdom({ ...seq, steps: cand }, opts);
      if (same(c)) found = c!;
      return same(c);
    },
    opts.shrinkRuns ?? 60
  );
  // the violation of the shrunk steps is the one to report
  const last = runJsdom({ ...seq, steps }, opts);
  if (same(last)) found = last!;
  return { ...seq, steps, ...found, originalSteps: seq.steps.length };
}

/** replay a record: throws the violation's message (for the test `--promote` prints) */
export function replayJsdom(record: Sequence): void {
  const v = runJsdom(record);
  if (v)
    throw new Error(
      `${v.invariant} after step ${v.step} (${v.op}): ${v.message}`
    );
}
