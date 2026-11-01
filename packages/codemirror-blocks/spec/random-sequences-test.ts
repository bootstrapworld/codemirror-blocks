import { act, fireEvent, screen } from "@testing-library/react";
import * as utils from "../src/utils";
import lambda from "../src/languages/lambda";
import wescheme from "../src/languages/wescheme";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import type { API } from "../src/CodeMirrorBlocks";
import type { ASTNode, Pos } from "../src/ast";
import type { AppStore } from "../src/state/store";
import { poscmp } from "../src/utils";
import type { DragMode } from "./helpers/dnd";
import { installFakeClipboard } from "./helpers/clipboard";
import { setEditableText } from "./helpers/editing";
import {
  dragOnto,
  dropOnWhitespace,
  dropTargets,
  pasteAtCursor,
  select,
  typeChar,
} from "./helpers/gestures";
import { findInvariantViolations } from "./helpers/invariants";
import { minimise, randomInt, seededRandom } from "./helpers/random";

/**
 * Randomized operation sequences (doc/internal/test-plan.md, section 12).
 *
 * Each test builds a sequence of random user operations from a seed (deletes,
 * cut and paste, editing in place, inserting beside a child, typing and pasting
 * at the top level, dragging blocks and toolbar entries, the trash can, undo
 * and redo, mode switches, collapsing), runs it on a fresh editor and checks,
 * after every step:
 *
 * - the invariants of `helpers/invariants.ts` (text parses to the AST, one
 *   block per node, focus not stranded, selections valid, ...),
 * - that nothing logged a `console.error` or threw.
 *
 * At the end it undoes everything (the text must be the document as it was
 * after the last mode switch, or at the start if there was none) and redoes
 * everything (the text must be the final text again), checking the invariants
 * after each of those too.
 *
 * Sequences are plain data (see `Step`), so a failure is reported with its seed
 * *and* shrunk to a short list of steps that can be replayed on its own.
 *
 * Environment variables:
 *   CMB_RANDOM_RUNS    how many sequences to run (default 12)
 *   CMB_RANDOM_STEPS   how many steps in each (default 25)
 *   CMB_RANDOM_SEED    the seed of the first sequence (default 1); the others
 *                      follow on from it
 *   CMB_RANDOM_REPLAY  a JSON sequence, as printed by a failure; runs only that
 *
 * For example, a long run (jsdom keeps ~40 MB per sequence alive, so give node
 * more memory, or run in batches with different CMB_RANDOM_SEED values):
 *   NODE_OPTIONS=--max-old-space-size=8192 CMB_RANDOM_RUNS=100 \
 *     CMB_RANDOM_STEPS=40 npx jest random-sequences
 */

const RUNS = Number(process.env.CMB_RANDOM_RUNS) || 12;
const STEPS = Number(process.env.CMB_RANDOM_STEPS) || 25;
const FIRST_SEED = Number(process.env.CMB_RANDOM_SEED) || 1;
const REPLAY = process.env.CMB_RANDOM_REPLAY;

// ---------------------------------------------------------------------------
// The world the operations act on

type World = {
  cmb: API;
  store: AppStore;
  clipboard: ReturnType<typeof installFakeClipboard>;
  /**
   * A refused edit (text that does not parse) logs its error and leaves the
   * box open, which is how the user is told. Operations call this after such a
   * refusal, so that the error is expected; anything else logged is not.
   */
  forgiveRefusal: () => void;
};

/** What an operation did, for the report. `undefined` if it did not apply. */
type Outcome = string | undefined;

type Operation = {
  name: string;
  /** how often to pick it, relative to the others (default 1) */
  weight?: number;
  /** true if the operation replaces the editor, so that undo cannot go back past it */
  startsHistory?: boolean;
  /** Must be a function of the world and `r` alone, so that steps replay. */
  run: (w: World, r: number[]) => Outcome;
};

const pick = <T>(items: readonly T[], n: number): T | undefined =>
  items.length ? items[n % items.length] : undefined;

/** `count` different items, chosen by `seed` */
const pickMany = <T>(items: readonly T[], count: number, seed: number) => {
  const random = seededRandom(seed);
  const left = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && left.length) {
    chosen.push(left.splice(randomInt(random, left.length), 1)[0]);
  }
  return chosen;
};

const label = (node: ASTNode) => {
  const text = node.toString().replace(/\s+/g, " ");
  return text.length > 24 ? `${text.slice(0, 21)}...` : text;
};

const blockElement = (node: ASTNode) =>
  document.getElementById(`block-node-${node.id}`);

/** The blocks a user could click on right now: not hidden inside a collapsed block */
const visibleNodes = (w: World) =>
  w.cmb
    .getAst()
    .rootNodes.flatMap((root) => [...root.descendants()])
    .filter((node) => {
      const el = blockElement(node);
      return !!el && !el.parentElement?.closest('[aria-expanded="false"]');
    });

/** Blocks that can be picked up: not one that is open for editing */
const draggableNodes = (w: World) =>
  visibleNodes(w).filter(
    (node) => blockElement(node)?.getAttribute("draggable") === "true"
  );

const visibleDropTargets = (w: World) =>
  dropTargets(w.cmb.getWrapperElement()).filter(
    (el) => !el.closest('[aria-expanded="false"]')
  );

/** Everywhere in the document that is not inside a root: where whitespace is */
const whitespacePositions = (w: World) => {
  const roots = w.cmb.getAst().rootNodes.map((n) => n.srcRange());
  // (a block comment is plain text: typing in the middle of `#| c |#` makes a
  // comment that never ends, and the language reports that, as it should)
  const comments = [...w.cmb.getValue().matchAll(/#\|[\s\S]*?\|#/g)].map(
    (m) => ({
      from: w.cmb.getCM().posFromIndex(m.index!),
      to: w.cmb.getCM().posFromIndex(m.index! + m[0].length),
    })
  );
  const positions: Pos[] = [];
  for (let line = 0; line <= w.cmb.lastLine(); line++) {
    for (let ch = 0; ch <= w.cmb.getLine(line).length; ch++) {
      const inside = [...roots, ...comments].some(
        ({ from, to }) =>
          poscmp(from, { line, ch }) < 0 && poscmp({ line, ch }, to) < 0
      );
      if (!inside) {
        positions.push({ line, ch });
      }
    }
  }
  return positions;
};

const toolbarEntries = () =>
  [...document.querySelectorAll(".Primitive")].filter((el) =>
    // plain names only: keywords such as `define` don't make a valid block
    /^[a-z][a-z0-9-]*$/.test(el.textContent ?? "")
  );

/** What goes between the text of a document and a statement added after it */
const separator = (w: World) =>
  w.cmb.getAst().language.id === "lambda" && w.cmb.getValue().trim() !== ""
    ? ";\n"
    : "\n";

/** The language's refusal of text it cannot parse, as the editor reports it */
const isRefusal = (e: unknown) =>
  /An invalid change was rejected/.test(String(e));

/** Things to type, paste and drop in: one block, a few blocks, or a list */
const schemeTexts = ["zzz", "7", "(g w)", "(h 1 2)", "foo bar", '"hi"'];
/** (lambda has no lists, and two names in a row are not a program) */
const lambdaTexts = ["zzz", "7", "x + 1", "!x", "true", '"hi"'];
/** the pool for the language of the sequence that is running */
let texts = schemeTexts;

/**
 * Text that is awkward to put into a block: unbalanced, empty, several blocks,
 * comments, newlines. Some of it is refused by the parser.
 */
const awkwardTexts = [
  "(",
  ")",
  "",
  "   ",
  "a b c d",
  "(a) (b)",
  "; note\nq",
  "q ; note",
  '"two words"',
  '"say \\"hi\\""',
  "'(1 2)",
  "#t",
  "(a\n b)",
  "\n\n",
  "[x]",
  "(f",
  "#| c |# z",
];

const isEditing = () =>
  document.activeElement?.getAttribute("contenteditable") === "true";

/** What a user does before reaching for a shortcut: finish typing */
const stopEditing = () => {
  // (an editing box can be left open without focus: a drag in jsdom doesn't
  // take focus from it, as a real press would)
  const box = document.querySelector('[contenteditable="true"]');
  if (box) {
    keyDown("Escape", {}, box);
  }
};

/**
 * What a user does before reaching for an editor shortcut when keyboard focus is
 * on the toolbar item they pressed (a drag that came to nothing leaves it there,
 * as a click would): they click back into the editor. Focus lost to the page
 * while a block is focused is a bug, and is not excused.
 */
const returnToEditor = (cmb: API) => {
  const inToolbar = Boolean(
    document.querySelector(".Toolbar")?.contains(document.activeElement)
  );
  if (inToolbar) {
    act(() => cmb.focus());
  }
};

/** Press a key where a user would be: on the block that has the focus */
const pressOnFocus = (w: World, key: string, props = {}) =>
  keyDown(key, props, w.cmb.getFocusedNode() ?? w.cmb.getAst().rootNodes[0]);

const clearSelection = (w: World) => {
  const first = visibleNodes(w)[0];
  if (first) {
    keyDown("Escape", {}, first);
  }
};

/** Select some blocks (replacing any earlier selection), return them */
const selectSome = (w: World, r: number[]) => {
  const nodes = pickMany(visibleNodes(w), 1 + (r[1] % 3), r[2]);
  clearSelection(w);
  nodes.forEach(select);
  return nodes;
};

const labels = (nodes: ASTNode[]) => nodes.map(label).join(", ");

/** How a top-level edit ends: committed, cancelled, or left open */
const finishTopLevelEdit = (w: World, n: number) => {
  switch (n % 3) {
    case 0:
      keyDown("Enter");
      w.forgiveRefusal();
      return "committed";
    case 1:
      keyDown("Escape");
      return "cancelled";
    default:
      return "left open";
  }
};

const operations: Operation[] = [
  {
    name: "delete",
    run: (w, r) => {
      const nodes = selectSome(w, r);
      if (!nodes.length) return;
      keyDown("Delete", {}, nodes[nodes.length - 1]);
      return `delete ${labels(nodes)}`;
    },
  },
  {
    name: "cut",
    run: (w, r) => {
      const nodes = selectSome(w, r);
      if (!nodes.length) return;
      keyDown("X", cmd_ctrl, nodes[nodes.length - 1]);
      return `cut ${labels(nodes)}`;
    },
  },
  {
    name: "copy",
    run: (w, r) => {
      const nodes = selectSome(w, r);
      if (!nodes.length) return;
      keyDown("C", cmd_ctrl, nodes[nodes.length - 1]);
      return `copy ${labels(nodes)}`;
    },
  },
  {
    name: "paste over a selection",
    run: (w, r) => {
      const [node] = selectSome(w, [r[0], 0, r[2]]);
      if (!node) return;
      w.clipboard.text = pick(texts, r[3])!;
      keyDown("V", cmd_ctrl, node);
      return `paste "${w.clipboard.text}" over ${label(node)}`;
    },
  },
  {
    name: "paste beside a block",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      if (r[2] % 2) {
        w.clipboard.text = pick(texts, r[3])!;
      }
      mouseDown(node);
      const before = r[3] % 2 === 1;
      keyDown("V", { ...cmd_ctrl, shiftKey: before }, node);
      return `paste "${w.clipboard.text}" ${before ? "before" : "after"} ${label(node)}`;
    },
  },
  {
    name: "edit a block in place",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      const compound = [...node.children()].length > 0;
      // Enter edits a literal (and folds a compound block); Cmd-Enter edits anything
      keyDown("Enter", compound ? cmd_ctrl : {}, node);
      if (!isEditing()) return `Enter on ${label(node)} (not editable)`;
      const text = pick(texts, r[2])!;
      setEditableText(text);
      keyDown("Enter");
      w.forgiveRefusal(); // (the texts are for wescheme: lambda refuses some)
      return `edit ${label(node)} to "${text}"`;
    },
  },
  {
    name: "insert beside a block",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      const right = r[2] % 2 === 0;
      keyDown(right ? "]" : "[", { ctrlKey: true }, node);
      if (!isEditing())
        return `Ctrl-${right ? "]" : "["} on ${label(node)} (no gap)`;
      const text = pick(texts, r[3])!;
      setEditableText(text);
      keyDown("Enter");
      w.forgiveRefusal();
      return `insert "${text}" ${right ? "after" : "before"} ${label(node)}`;
    },
  },
  {
    name: "type at the top level",
    run: (w, r) => {
      const pos = pick(whitespacePositions(w), r[1]);
      if (!pos) return;
      w.cmb.setCursor(pos);
      typeChar(w.cmb, pick([..."abxy19"], r[2])!);
      const text = pick(texts, r[3])!;
      setEditableText(text);
      return `type "${text}" at ${pos.line}:${pos.ch}, ${finishTopLevelEdit(w, r[0])}`;
    },
  },
  {
    name: "paste at the top level",
    run: (w, r) => {
      const pos = pick(whitespacePositions(w), r[1]);
      if (!pos) return;
      w.cmb.setCursor(pos);
      const text = pick(texts, r[2])!;
      pasteAtCursor(w.cmb, text);
      return `paste "${text}" at ${pos.line}:${pos.ch}, ${finishTopLevelEdit(w, r[3])}`;
    },
  },
  {
    name: "drag a block onto a block",
    run: (w, r) => {
      const nodes = visibleNodes(w);
      const src = pick(draggableNodes(w), r[1]);
      const dst = pick(nodes, r[2]);
      if (!src || !dst) return;
      dragOnto(blockElement(src)!, blockElement(dst)!);
      return `drag ${label(src)} onto ${label(dst)}`;
    },
  },
  {
    name: "drag a block onto a drop target",
    run: (w, r) => {
      const src = pick(draggableNodes(w), r[1]);
      const target = pick(visibleDropTargets(w), r[2]);
      if (!src || !target) return;
      dragOnto(blockElement(src)!, target);
      return `drag ${label(src)} onto a drop target`;
    },
  },
  {
    name: "drag a block onto whitespace",
    run: (w, r) => {
      const src = pick(draggableNodes(w), r[1]);
      const pos = pick(whitespacePositions(w), r[2]);
      if (!src || !pos) return;
      dropOnWhitespace(w.cmb, blockElement(src)!, pos);
      return `drag ${label(src)} to ${pos.line}:${pos.ch}`;
    },
  },
  {
    name: "drag a block to the trash can",
    run: (w, r) => {
      const src = pick(draggableNodes(w), r[1]);
      if (!src) return;
      dragOnto(blockElement(src)!, document.querySelector(".TrashCan")!);
      return `trash ${label(src)}`;
    },
  },
  {
    name: "drag from the toolbar onto a block",
    run: (w, r) => {
      const entry = pick(toolbarEntries(), r[1]);
      const dst = pick(visibleNodes(w), r[2]);
      if (!entry || !dst) return;
      dragOnto(entry, blockElement(dst)!);
      return `drag toolbar "${entry.textContent}" onto ${label(dst)}`;
    },
  },
  {
    name: "drag from the toolbar onto a drop target",
    run: (w, r) => {
      const entry = pick(toolbarEntries(), r[1]);
      const target = pick(visibleDropTargets(w), r[2]);
      if (!entry || !target) return;
      dragOnto(entry, target);
      return `drag toolbar "${entry.textContent}" onto a drop target`;
    },
  },
  {
    name: "drag from the toolbar onto whitespace",
    run: (w, r) => {
      const entry = pick(toolbarEntries(), r[1]);
      const pos = pick(whitespacePositions(w), r[2]);
      if (!entry || !pos) return;
      dropOnWhitespace(w.cmb, entry, pos);
      return `drag toolbar "${entry.textContent}" to ${pos.line}:${pos.ch}`;
    },
  },
  {
    name: "undo",
    weight: 3,
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      if (r[1] % 2) {
        keyDown("Z", cmd_ctrl);
        return "undo (keyboard)";
      }
      w.cmb.undo();
      return "undo (API)";
    },
  },
  {
    name: "redo",
    weight: 2,
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      if (r[1] % 2) {
        keyDown("Y", { ctrlKey: true });
        return "redo (keyboard)";
      }
      w.cmb.redo();
      return "redo (API)";
    },
  },
  {
    name: "collapse or expand",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      const keys: [string, object][] = [
        ["ArrowLeft", {}],
        ["ArrowRight", {}],
        ["ArrowLeft", { shiftKey: true }],
        ["ArrowRight", { shiftKey: true }],
        ["ArrowLeft", { shiftKey: true, altKey: true }],
        ["ArrowRight", { shiftKey: true, altKey: true }],
        ["Enter", {}],
      ];
      const [key, mods] = pick(keys, r[2])!;
      keyDown(key, mods, node);
      return `${Object.keys(mods).join("-")}${key} on ${label(node)}`;
    },
  },
  {
    name: "move around",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      const key = pick(["ArrowDown", "ArrowUp", "Home", "End"], r[2])!;
      keyDown(key, {}, node);
      return `${key} from ${label(node)}`;
    },
  },
  {
    name: "change the text through the API",
    run: (w, r) => {
      const text = pick(texts, r[1])!;
      // (the new statement joins lambda's one program block, so an edit box
      // left open at the end of the document would end up inside it)
      if (w.cmb.getAst().language.id === "lambda") stopEditing();
      const line = w.cmb.lastLine();
      // (lambda statements are separated by `;`: without it the text is refused)
      const sep = separator(w);
      try {
        w.cmb.replaceRange(`${sep}${text}`, {
          line,
          ch: w.cmb.getLine(line).length,
        });
      } catch (e) {
        // (the API refuses text the language cannot parse, such as a leading
        // `;` after lambda comments: it throws, and leaves the document alone)
        if (w.cmb.getAst().language.id !== "lambda" || !isRefusal(e)) throw e;
        return `API: refused to add "${text}" at the end`;
      }
      return `API: add "${text}" at the end`;
    },
  },
  {
    name: "edit a block to awkward text",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      keyDown("Enter", cmd_ctrl, node);
      if (!isEditing()) return `Cmd-Enter on ${label(node)} (not editable)`;
      const text = pick(awkwardTexts, r[2])!;
      setEditableText(text);
      const how = r[3] % 3;
      keyDown(how === 2 ? "Escape" : "Enter");
      if (how !== 2) w.forgiveRefusal();
      return `edit ${label(node)} to ${JSON.stringify(text)}, ${how === 2 ? "cancelled" : "committed"}`;
    },
  },
  {
    name: "paste awkward text",
    run: (w, r) => {
      const text = pick(awkwardTexts, r[3])!;
      w.clipboard.text = text;
      if (r[0] % 3 === 0) {
        const pos = pick(whitespacePositions(w), r[1]);
        if (!pos) return;
        w.cmb.setCursor(pos);
        pasteAtCursor(w.cmb, text);
        const commit = r[2] % 2 === 0;
        keyDown(commit ? "Enter" : "Escape");
        w.forgiveRefusal();
        return `paste ${JSON.stringify(text)} at ${pos.line}:${pos.ch}, ${commit ? "committed" : "cancelled"}`;
      }
      const [node] = selectSome(w, [r[0], 0, r[1]]);
      if (!node) return;
      if (r[2] % 2) {
        keyDown("V", cmd_ctrl, node);
        return `paste ${JSON.stringify(text)} over ${label(node)}`;
      }
      keyDown("V", { ...cmd_ctrl, shiftKey: r[2] % 4 === 0 }, node);
      return `paste ${JSON.stringify(text)} beside ${label(node)}`;
    },
  },
  {
    name: "select many blocks, then cut, copy, delete or paste",
    run: (w, r) => {
      const nodes = visibleNodes(w);
      const chosen =
        r[1] % 4 === 0 ? nodes : pickMany(nodes, 2 + (r[1] % 5), r[2]);
      if (!chosen.length) return;
      clearSelection(w);
      chosen.forEach(select);
      const last = chosen[chosen.length - 1];
      const how = r[3] % 5;
      if (how === 0) keyDown("Delete", {}, last);
      else if (how === 1) keyDown("X", cmd_ctrl, last);
      else if (how === 2) keyDown("C", cmd_ctrl, last);
      else if (how === 3) keyDown("Backspace", {}, last);
      else keyDown("V", cmd_ctrl, last);
      const verb = ["delete", "cut", "copy", "backspace", "paste over"][how];
      return `select ${chosen.length} blocks, ${verb}`;
    },
  },
  {
    name: "walk the keyboard",
    run: (w, r) => {
      const node = pick(visibleNodes(w), r[1]);
      if (!node) return;
      mouseDown(node);
      const keys: [string, object][] = [
        ["ArrowDown", {}],
        ["ArrowUp", {}],
        ["Home", {}],
        ["End", {}],
        ["ArrowRight", {}],
        ["ArrowLeft", {}],
        ["\\", {}],
        ["\\", { shiftKey: true }],
        ["Tab", { shiftKey: true }],
        [" ", {}],
        ["Escape", {}],
      ];
      const random = seededRandom(r[2]);
      const pressed: string[] = [];
      for (let i = 0; i < 2 + (r[3] % 6); i++) {
        const [key, mods] = keys[randomInt(random, keys.length)];
        const on = w.cmb.getFocusedNode() ?? node;
        keyDown(key, mods, on);
        pressed.push(key);
      }
      return `keys ${pressed.join(" ")} from ${label(node)}`;
    },
  },
  {
    name: "collapse a block, then change around it",
    run: (w, r) => {
      const compounds = visibleNodes(w).filter((n) => [...n.children()].length);
      const node = pick(compounds, r[1]);
      if (!node) return;
      mouseDown(node);
      keyDown("ArrowLeft", {}, node);
      const then = r[2] % 6;
      let what: string;
      switch (then) {
        case 0: {
          // text changed through the API inside the collapsed block
          const inner = pick([...node.descendants()].slice(1), r[3]);
          if (!inner) return `collapse ${label(node)}`;
          try {
            w.cmb.replaceRange(pick(texts, r[0])!, inner.from, inner.to);
          } catch (e) {
            // (lambda refuses text that does not parse in that place)
            if (w.cmb.getAst().language.id !== "lambda" || !isRefusal(e)) {
              throw e;
            }
          }
          what = "replace a part of it through the API";
          break;
        }
        case 1:
          keyDown("Delete", {}, node);
          what = "delete it";
          break;
        case 2: {
          const parent = w.cmb.getAst().getNodeParent(node) ?? node;
          mouseDown(parent);
          keyDown("Delete", {}, parent);
          what = "delete what contains it";
          break;
        }
        case 3:
          keyDown("Enter", cmd_ctrl, node);
          if (isEditing()) setEditableText(pick(texts, r[3])!);
          keyDown("Enter");
          what = "edit it";
          break;
        case 4:
          keyDown("]", { ctrlKey: true }, node);
          if (isEditing()) setEditableText(pick(texts, r[3])!);
          keyDown("Enter");
          what = "insert beside it";
          break;
        default:
          what = "leave it";
      }
      // then expand, if the block is still there
      const again = w.cmb
        .getAst()
        .rootNodes.flatMap((root) => [...root.descendants()])
        .find(
          (n) => blockElement(n)?.getAttribute("aria-expanded") === "false"
        );
      if (again && r[0] % 2) {
        mouseDown(again);
        keyDown("ArrowRight", r[0] % 4 === 1 ? { shiftKey: true } : {}, again);
        what += ", then expand";
      }
      return `collapse ${label(node)}, ${what}`;
    },
  },
  {
    name: "undo or redo several times",
    weight: 2,
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      const n = 2 + (r[1] % 4);
      const redo = r[2] % 3 === 0;
      for (let i = 0; i < n; i++) {
        if (r[3] % 2)
          keyDown(redo ? "Y" : "Z", redo ? { ctrlKey: true } : cmd_ctrl);
        else if (redo) w.cmb.redo();
        else w.cmb.undo();
      }
      return `${redo ? "redo" : "undo"} ${n} times`;
    },
  },
  {
    name: "switch modes several times",
    startsHistory: true,
    run: (w, r) => {
      // sometimes with an editing box or a quarantine open
      let open = "";
      const node = pick(visibleNodes(w), r[1]);
      if (r[0] % 3 === 1 && node) {
        mouseDown(node);
        keyDown("Enter", cmd_ctrl, node);
        open = isEditing() ? ` with ${label(node)} open for editing` : "";
        if (open) setEditableText(pick(texts, r[2])!);
      } else if (r[0] % 3 === 2) {
        const pos = pick(whitespacePositions(w), r[1]);
        if (pos) {
          w.cmb.setCursor(pos);
          typeChar(w.cmb, "q");
          if (w.cmb.getAst().language.id === "lambda" && isEditing()) {
            // (lambda has no two blocks side by side: statements need a `;`)
            const start = pos.line === 0 && pos.ch === 0;
            setEditableText(start ? "q;" : ";q");
          }
          open = ` with a quarantine open at ${pos.line}:${pos.ch}`;
        }
      }
      const n = 1 + (r[3] % 4);
      for (let i = 0; i < n; i++) {
        w.cmb.setBlockMode(false);
        w.cmb.setBlockMode(true);
      }
      return `switch to text mode and back ${n} times${open}`;
    },
  },
  {
    name: "search for text",
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      const nodes = visibleNodes(w);
      const from = pick(nodes, r[0]);
      if (from) mouseDown(from);
      const words = ["x", "f", "a", "zzz", "(", "[", "1", '"', ".*", "^", ""];
      const text =
        r[1] % 3 === 0 && from
          ? from.toString().slice(0, 3)
          : pick(words, r[1])!;
      pressOnFocus(w, "F3");
      const input = screen.queryByLabelText("Search String");
      if (!input) return `F3 (no dialog)`;
      fireEvent.change(input, { target: { value: text } });
      const options = ["Ignore case", "Exact match", "Regex"];
      const flags = r[2] % 8;
      options.forEach((o, i) => {
        if (flags & (1 << i)) fireEvent.click(screen.getByLabelText(o));
      });
      const end = r[3] % 4;
      fireEvent.keyUp(input, { key: end === 3 ? "Escape" : "Enter" });
      const steps = r[3] % 3;
      for (let i = 0; i < steps; i++) {
        pressOnFocus(w, r[2] % 2 ? "PageDown" : "PageUp");
      }
      return `search ${JSON.stringify(text)} (flags ${flags}), ${end === 3 ? "escape" : "enter"}, then ${steps} steps`;
    },
  },
  {
    name: "search for a block type",
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      pressOnFocus(w, "F3");
      const tab = screen.queryByRole("tab", { name: "Search by block" });
      if (!tab) return "F3 (no dialog)";
      fireEvent.click(tab);
      const select = screen.queryByRole("combobox") as HTMLSelectElement | null;
      if (!select) return "search by block (no list of types)";
      const type = pick(
        [...select.options].map((o) => o.value),
        r[1]
      );
      if (type === undefined) {
        fireEvent.keyUp(select, { key: "Escape" });
        return "search by block (no types)";
      }
      fireEvent.change(select, { target: { name: "blockType", value: type } });
      fireEvent.keyUp(select, { key: r[2] % 4 ? "Enter" : "Escape" });
      const steps = r[3] % 4;
      for (let i = 0; i < steps; i++) {
        pressOnFocus(w, r[3] % 2 ? "PageDown" : "PageUp");
      }
      return `search by block type ${type}, ${steps} steps`;
    },
  },
  {
    name: "step through search results",
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      const node = pick(visibleNodes(w), r[1]);
      if (node) mouseDown(node);
      const n = 1 + (r[2] % 4);
      for (let i = 0; i < n; i++) {
        pressOnFocus(w, r[3] % 2 ? "PageDown" : "PageUp");
      }
      return `${r[3] % 2 ? "PageDown" : "PageUp"} ${n} times`;
    },
  },
  {
    name: "turn the search rotor",
    run: (w, r) => {
      stopEditing();
      returnToEditor(w.cmb);
      const n = 1 + (r[1] % 3);
      for (let i = 0; i < n; i++) {
        pressOnFocus(w, "F3", {
          ctrlKey: true,
          shiftKey: r[2] % 2 === 1,
        });
      }
      if (r[3] % 2) pressOnFocus(w, "PageDown");
      return `Ctrl-F3 ${n} times${r[3] % 2 ? ", PageDown" : ""}`;
    },
  },
  {
    name: "open the search dialog and leave it",
    run: (w, r) => {
      pressOnFocus(w, "F3");
      const input = screen.queryByLabelText("Search String");
      if (!input) return "F3 (no dialog)";
      if (r[1] % 2) {
        fireEvent.change(input, { target: { value: pick(texts, r[2])! } });
      }
      const how = r[3] % 3;
      if (how === 0) fireEvent.keyUp(input, { key: "Escape" });
      else if (how === 1) fireEvent.click(screen.getByText("Close"));
      return `open the search dialog, ${["close with Escape", "close with Close", "leave it open"][how]}`;
    },
  },
  {
    name: "touch-drag a block",
    run: (w, r) => {
      const src = pick(draggableNodes(w), r[1]);
      if (!src) return;
      const mode: DragMode = r[3] % 5 === 0 ? "early-touch" : "touch";
      const el = blockElement(src)!;
      switch (r[0] % 4) {
        case 0: {
          const dst = pick(visibleNodes(w), r[2]);
          if (!dst) return;
          dragOnto(el, blockElement(dst)!, undefined, mode);
          return `${mode} drag ${label(src)} onto ${label(dst)}`;
        }
        case 1: {
          const target = pick(visibleDropTargets(w), r[2]);
          if (!target) return;
          dragOnto(el, target, undefined, mode);
          return `${mode} drag ${label(src)} onto a drop target`;
        }
        case 2: {
          const pos = pick(whitespacePositions(w), r[2]);
          if (!pos) return;
          dropOnWhitespace(w.cmb, el, pos, mode);
          return `${mode} drag ${label(src)} to ${pos.line}:${pos.ch}`;
        }
        default:
          dragOnto(el, document.querySelector(".TrashCan")!, undefined, mode);
          return `${mode} trash ${label(src)}`;
      }
    },
  },
  {
    name: "touch-drag from the toolbar",
    run: (w, r) => {
      const entry = pick(toolbarEntries(), r[1]);
      if (!entry) return;
      const mode: DragMode = r[3] % 5 === 0 ? "early-touch" : "touch";
      if (r[0] % 2) {
        const dst = pick(visibleNodes(w), r[2]);
        if (!dst) return;
        dragOnto(entry, blockElement(dst)!, undefined, mode);
        return `${mode} drag toolbar "${entry.textContent}" onto ${label(dst)}`;
      }
      const pos = pick(whitespacePositions(w), r[2]);
      if (!pos) return;
      dropOnWhitespace(w.cmb, entry, pos, mode);
      return `${mode} drag toolbar "${entry.textContent}" to ${pos.line}:${pos.ch}`;
    },
  },
];

// Operations that start a new undo history (a mode switch replaces the editor)
const modeSwitch: Operation = {
  name: "switch to text mode and back",
  startsHistory: true,
  run: (w, r) => {
    stopEditing();
    w.cmb.setBlockMode(false);
    let edit = "";
    if (r[1] % 3 === 0) {
      // edit the text while in text mode
      const text = pick(texts, r[2])!;
      const line = w.cmb.lastLine();
      // (lambda statements are separated by `;`: without it the text is refused)
      const sep = separator(w);
      w.cmb.replaceRange(`${sep}${text}`, {
        line,
        ch: w.cmb.getLine(line).length,
      });
      edit = ` (adding "${text}" in text mode)`;
    }
    w.cmb.setBlockMode(true);
    return `switch to text mode and back${edit}`;
  },
};
const allOperations = [...operations, modeSwitch];

// ---------------------------------------------------------------------------
// Sequences

type Step = { op: string; r: number[] };
/** `language` is "wescheme" when a (older) replay does not say */
type Sequence = { code: string; language?: LanguageId; steps: Step[] };
type LanguageId = "wescheme" | "lambda";

const languages = { wescheme, lambda };

type Doc = { code: string; language?: LanguageId };
const flat = (n: number) =>
  `(f ${Array.from({ length: n }, (_, i) => `a${i}`).join(" ")})`;
const nested = (depth: number) =>
  Array.from({ length: depth }).reduceRight<string>(
    (inner, _, i) => `(n${i} ${inner})`,
    "x"
  );

const documents: Doc[] = [
  { code: "(f x y)\n(g z)\nw" },
  { code: "a b c" },
  { code: "(define (sq n) (* n n))\n(sq 4)" },
  { code: "(f (g x) (h y z))\n\n42" },
  { code: "(if (< a b) a b) c" },
  { code: "" },
  { code: "; only a comment\n#| and another |#" },
  { code: flat(60) },
  { code: nested(8) },
  { code: Array.from({ length: 30 }, (_, i) => `(r${i} ${i})`).join("\n") },
  { code: `(${"long-name ".repeat(25)}end) ${"word ".repeat(40)}` },
  { code: "; before\n(f x) ; after\n#| two |# (g y) ; tail\n; last" },
  { code: '"two words" "say \\"hi\\" now" "tab\\there" "" (f "x y")' },
  { code: "'(a b) `(x ,y ,@z) (quote q) 'sym" },
  { code: "(local [(define a 1) (define (g b) (+ a b))] (g 2))\n(local [] x)" },
  { code: "(case x [(1 2) 'a] [(3) 'b] [else 'c])\n(case y [else z])" },
  {
    code: "(define-struct posn (x y))\n(define p (make-posn 1 2))\n((lambda (a b) (+ a b)) 1 2)",
  },
  { code: "(provide f)\n(define-values (a b) (values 1 2))\n(f a b)" },
  // (the lambda language gives no block to calls such as f(1, 2), sugar such as
  // `let f(n) ...`, and more than one statement, so the invariants fail on those
  // before any step: only documents that load cleanly are used)
  { code: "1 + 2", language: "lambda" },
  { code: "lambda (x) x + 1", language: "lambda" },
  { code: "let (a = 1, b = 2) a + b", language: "lambda" },
  { code: "if a then b else c", language: "lambda" },
  { code: "x = 1", language: "lambda" },
  // (not "# a comment\n1 + 2": lambda drops a comment when it makes blocks, so
  // the text and the blocks' positions part ways)
];

const totalWeight = allOperations.reduce((n, op) => n + (op.weight ?? 1), 0);
const chooseOperation = (n: number) => {
  let left = n % totalWeight;
  for (const op of allOperations) {
    left -= op.weight ?? 1;
    if (left < 0) return op;
  }
  return allOperations[0];
};

function generate(seed: number, length: number): Sequence {
  const random = seededRandom(seed);
  const big = () => randomInt(random, 1_000_000_000);
  const { code, language } = documents[randomInt(random, documents.length)];
  const steps = Array.from({ length }, () => ({
    op: chooseOperation(big()).name,
    r: [big(), big(), big(), big()],
  }));
  return language ? { code, language, steps } : { code, steps };
}

type Failure = {
  /** what went wrong, first line first */
  message: string;
  /** where: a step number, or the undo/redo walk at the end */
  at: string;
};
type RunResult = { failure?: Failure; trace: string[] };

/**
 * jsdom reports every element as 0 pixels tall, so CodeMirror thinks all lines
 * are at the same height and that only the last one is on screen: it draws the
 * last ten lines, and cannot redraw one above them after a change. Give each
 * line of text a height, and the (mocked) 1000 pixel wrapper shows a whole
 * screenful. Returns the function that puts things back.
 */
const giveLinesHeight = () => {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const rect = original.call(this);
    if (!this.parentElement?.classList.contains("CodeMirror-code")) {
      return rect;
    }
    return { ...rect, height: 20, bottom: rect.top + 20 };
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
};

/** Run one sequence on a fresh editor, stopping at the first problem. */
function runSequence(sequence: Sequence): RunResult {
  texts = sequence.language === "lambda" ? lambdaTexts : schemeTexts;
  const { cmb, store } = mountCMB(languages[sequence.language ?? "wescheme"]);
  const restoreLayout = giveLinesHeight();
  // jsdom has no scrollIntoView, which the editor calls to keep a focused block in view
  const hadScroll = "scrollIntoView" in Element.prototype;
  if (!hadScroll) {
    Element.prototype.scrollIntoView = () => {};
  }
  const clipboard = installFakeClipboard("zzz");
  const world: World = {
    cmb,
    store,
    clipboard,
    forgiveRefusal: () => {
      // (the user reads the message, and cancels)
      if (document.querySelector('[contenteditable="true"]')) {
        errorsSeen = errors.mock.calls.length;
        stopEditing();
      }
    },
  };
  const errors = jest.spyOn(console, "error");
  // (search beeps; no sound in jsdom)
  const sounds = jest.spyOn(utils, "playSound").mockImplementation(() => {});
  // An error thrown in an event handler is not thrown back at the operation:
  // the page reports it, and jest would fail the test with no sequence to replay
  const uncaught: string[] = [];
  const onError = (e: ErrorEvent) => {
    e.preventDefault();
    uncaught.push(String(e.error?.stack ?? e.message));
  };
  window.addEventListener("error", onError);
  const trace: string[] = [];
  const text = () => cmb.getValue();

  // What is wrong with the editor right now, if anything
  let errorsSeen = errors.mock.calls.length;
  const problem = (): string | undefined => {
    if (uncaught.length) return `threw ${uncaught.shift()}`;
    if (errors.mock.calls.length > errorsSeen) {
      const logged = errors.mock.calls[errorsSeen].map(String).join(" ");
      errorsSeen = errors.mock.calls.length;
      // lambda has no two blocks side by side, so many edits that wescheme
      // takes are refused by its parser; the editor says so, and carries on
      const refusal =
        sequence.language === "lambda" &&
        /^Error: (Expecting|Unexpected|Can't handle|js:raw).* \(\d+:\d+\)$/.test(
          logged
        );
      if (!refusal) return `console.error: ${logged}`;
    }
    const violations = findInvariantViolations();
    return violations.length ? violations.join("\n") : undefined;
  };
  const fail = (at: string, message: string): RunResult => ({
    failure: { at, message },
    trace,
  });

  try {
    try {
      cmb.setValue(sequence.code);
    } catch (e) {
      return fail(
        "loading the document",
        `threw ${e instanceof Error ? e.stack : e}`
      );
    }
    cmb.clearHistory();
    // the text that undoing everything should lead back to
    let baseline = text();

    if (process.env.CMB_RANDOM_TRACE) {
      process.stderr.write(`document ${JSON.stringify(sequence)}\n`);
    }
    for (const [i, step] of sequence.steps.entries()) {
      const op = allOperations.find((o) => o.name === step.op);
      if (!op) throw new Error(`no such operation: ${step.op}`);
      const at = `step ${i + 1} (${step.op})`;
      if (process.env.CMB_RANDOM_TRACE) {
        // (to find the step that hangs: it prints before running each)
        process.stderr.write(`${at} ${JSON.stringify(step.r)}\n`);
      }
      let outcome: Outcome;
      try {
        outcome = op.run(world, step.r);
        // A drag swallows the click that a browser sends right after it, and
        // forgets it on the next timer tick. A synchronous sequence has no tick
        // between its steps, so the next step's click would be the one swallowed.
        window.dispatchEvent(new MouseEvent("click"));
      } catch (e) {
        trace.push(`${step.op}: threw`);
        return fail(at, `threw ${e instanceof Error ? e.stack : e}`);
      }
      trace.push(
        `${outcome ?? `${step.op}: not applicable`}\n       text: ${JSON.stringify(text())}`
      );
      if (op.startsHistory) {
        // (going back to blocks sets the text again, which drops the history,
        // unless it prints just as it was, as lambda often does: drop it here)
        cmb.clearHistory();
        baseline = text();
      }
      const wrong = problem();
      if (wrong) return fail(at, wrong);
    }

    // Finish typing, so that what is left is the document alone
    stopEditing();
    const wrong = problem();
    if (wrong) return fail("the end", wrong);

    // Walk the whole history one way: every state on the way must be sound
    const walk = (which: "undo" | "redo"): RunResult | undefined => {
      const [key, props] =
        which === "undo" ? ["Z", cmd_ctrl] : ["Y", { ctrlKey: true }];
      let guard = cmb.historySize()[which] + 2;
      while (cmb.historySize()[which] > 0 && guard-- > 0) {
        const size = cmb.historySize()[which];
        // (a search dialog left open has the keys: undo would go to its input)
        const input = screen.queryByLabelText("Search String");
        if (input) fireEvent.keyUp(input, { key: "Escape" });
        // (and so has an edit box left open: the keys would go to its text)
        stopEditing();
        returnToEditor(cmb);
        // (nothing has had focus since the mode switch: the user clicks in)
        if (document.activeElement === document.body) act(() => cmb.focus());
        keyDown(key, props);
        trace.push(
          `${which} (walking the whole history)\n       text: ${JSON.stringify(text())}`
        );
        const wrong = problem();
        if (wrong) return fail(`${which}ing everything`, wrong);
        if (cmb.historySize()[which] >= size) {
          return fail(`${which}ing everything`, `${key} did not ${which}`);
        }
      }
    };
    const mismatch = (what: string, expected: string): RunResult | undefined =>
      text() === expected
        ? undefined
        : fail(
            what,
            `the text is not what it should be.\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(text())}`
          );

    // Redo whatever the sequence left undone, to get to the very end
    let failed = walk("redo");
    if (failed) return failed;
    const final = text();
    // Undo everything: the document goes back to where it started
    failed = walk("undo") ?? mismatch("undoing everything", baseline);
    if (failed) return failed;
    // Redo everything: the document goes back to the end
    failed = walk("redo") ?? mismatch("redoing everything", final);
    if (failed) return failed;
    return { trace };
  } finally {
    window.removeEventListener("error", onError);
    clipboard.restore();
    sounds.mockRestore();
    restoreLayout();
    if (!hadScroll) {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    teardown();
    // The spy keeps every logged error (and the DOM they refer to) alive, which
    // adds up over hundreds of runs. Anything logged during the unmount stays,
    // so that the check after the test still sees it.
    if (errors.mock.calls.length === errorsSeen) {
      errors.mockClear();
    }
  }
}

/** The part of a message that says what kind of problem it is (not which node) */
const kindOf = (failure: Failure) =>
  failure.message
    .split("\n")[0]
    .replace(/\bnode [0-9a-f]+/g, "node #") // ids are hex
    .replace(/\d+/g, "#")
    .replace(/"[^"]*"/g, '""')
    .slice(0, 60);

/** Run a sequence; on failure shrink it and describe it so it can be replayed. */
function check(sequence: Sequence, seed?: number) {
  const result = runSequence(sequence);
  if (!result.failure) return;
  const original = result.failure;
  const stillFails = (steps: readonly Step[]) => {
    // every replay leaves some memory behind: give up shrinking before it runs out
    if (process.memoryUsage().heapUsed > 2.5e9) return false;
    const again = runSequence({ ...sequence, steps: [...steps] }).failure;
    return !!again && kindOf(again) === kindOf(original);
  };
  const steps = minimise(sequence.steps, stillFails);
  const shrunk = { ...sequence, steps };
  const final = runSequence(shrunk);
  const failure = final.failure ?? original;
  const lines = [
    "A randomized sequence of operations broke the editor.",
    seed === undefined
      ? ""
      : `  seed:      ${seed} (${sequence.steps.length} steps)`,
    `  document:  ${JSON.stringify(sequence.code)}${sequence.language ? ` (${sequence.language})` : ""}`,
    `  failed at: ${failure.at}`,
    `  problem:   ${failure.message.split("\n").join("\n             ")}`,
    "",
    `Shrunk to ${steps.length} of ${sequence.steps.length} steps:`,
    ...final.trace.map((t, i) => `  ${i + 1}. ${t}`),
    "",
    "Replay just this with:",
    `  CMB_RANDOM_REPLAY='${JSON.stringify(shrunk)}' npx jest random-sequences`,
  ];
  throw new Error(lines.filter((l) => l !== "").join("\n"));
}

// ---------------------------------------------------------------------------

describe("the helpers", () => {
  it("a seed always gives the same sequence", () => {
    expect(generate(5, 10)).toEqual(generate(5, 10));
    expect(generate(5, 10)).not.toEqual(generate(6, 10));
  });

  it("the shrinker keeps just the steps that matter", () => {
    const calls: number[][] = [];
    const fails = (items: readonly number[]) => {
      calls.push([...items]);
      return items.includes(3) && items.includes(8);
    };
    expect(minimise([1, 2, 3, 4, 5, 6, 7, 8, 9], fails)).toEqual([3, 8]);
    expect(minimise([1, 2, 3], (items) => items.length >= 0)).toEqual([]);
  });

  it("every operation is used by some sequence", () => {
    const used = new Set(
      Array.from({ length: 60 }, (_, i) => generate(i, 40)).flatMap((s) =>
        s.steps.map((step) => step.op)
      )
    );
    expect([...used].sort()).toEqual(allOperations.map((o) => o.name).sort());
  });
});

// Sequences that once broke the editor, shrunk by the random runs below. Each
// replays the exact steps, so they keep guarding what they found.
describe("sequences that once broke the editor", () => {
  const code = "(define (sq n) (* n n))\n(sq 4)";

  it("seed 528: a toolbar block dropped on whitespace while a literal is being edited, then undo and redo (once a harness artifact: an editing box left open without focus)", () => {
    check({
      code,
      steps: [
        {
          op: "collapse or expand",
          r: [356990582, 526874239, 573162785, 314379581],
        },
        {
          op: "drag from the toolbar onto whitespace",
          r: [677634825, 465503431, 927214367, 319805837],
        },
      ],
    });
  }, 120_000);

  it("seeds 310005, 310037: a paste into a comment, committed in a document with no blocks (focus fell to the page, so undo did nothing)", () => {
    check({
      code: "; only a comment\n#| and another |#",
      steps: [
        {
          op: "paste at the top level",
          r: [641877420, 786084055, 837963356, 227470698],
        },
      ],
    });
  }, 120_000);

  it("seed 532: cut, a trash-can drag, a cancelled paste, then undo (focus lost with no block left)", () => {
    check({
      code,
      steps: [
        { op: "cut", r: [231072944, 296978715, 484121717, 903425249] },
        {
          op: "drag a block to the trash can",
          r: [751373927, 678114516, 27050808, 846244032],
        },
        {
          op: "paste at the top level",
          r: [167531244, 314972969, 757373562, 710069929],
        },
      ],
    });
  }, 120_000);

  it("seed 1004: toolbar drops, drags and pastes in a document taller than ten lines, then typing at the top (once a harness artifact: jsdom drew only the last ten lines)", () => {
    const steps: [string, number[]][] = [
      [
        "drag from the toolbar onto whitespace",
        [503941451, 417273881, 229797668, 363567101],
      ],
      [
        "change the text through the API",
        [707947101, 478545661, 267694682, 459274848],
      ],
      ["delete", [119689298, 615457887, 321493929, 307682063]],
      [
        "switch to text mode and back",
        [898763887, 727522677, 286283587, 238667908],
      ],
      ["paste at the top level", [601698510, 819559902, 203586231, 56064530]],
      [
        "drag from the toolbar onto a drop target",
        [329822487, 27058804, 330365877, 975673329],
      ],
      [
        "drag from the toolbar onto whitespace",
        [627244688, 1818273, 574587487, 963113636],
      ],
      [
        "drag a block onto whitespace",
        [562348669, 700023561, 394664304, 83593553],
      ],
      [
        "drag from the toolbar onto whitespace",
        [415560249, 493486677, 921364815, 555391405],
      ],
      [
        "drag from the toolbar onto a drop target",
        [617815379, 679945935, 567340964, 673158199],
      ],
      ["paste over a selection", [257644778, 153769131, 718376213, 712889752]],
      ["paste beside a block", [910429805, 76658236, 330685378, 44777485]],
      ["delete", [560921410, 679388851, 374350916, 171650568]],
      [
        "drag a block onto a block",
        [626672414, 439262612, 391280086, 625723930],
      ],
      ["type at the top level", [924906978, 807525467, 258656173, 354956959]],
    ];
    check({
      code: "(f x y)\n(g z)\nw",
      steps: steps.map(([op, r]) => ({ op, r })),
    });
  }, 120_000);

  it("seed 11091: deleting every part of an unrecognised expression (the printer threw on the empty list)", () => {
    check({
      code: "(f x y)\n(g z)\nw",
      steps: [
        {
          op: "change the text through the API",
          r: [847361539, 160455525, 792783203, 646824441],
        },
        {
          op: "paste beside a block",
          r: [559567038, 490967443, 990440111, 101965375],
        },
        { op: "undo", r: [948128637, 830180611, 585762165, 1435229] },
        { op: "delete", r: [31388739, 282762804, 162580369, 956265754] },
        { op: "delete", r: [116882089, 442597137, 674036963, 933230459] },
        {
          op: "drag from the toolbar onto a block",
          r: [672017864, 346665341, 549369081, 994102360],
        },
        { op: "delete", r: [227266182, 118142998, 411797776, 345797588] },
      ],
    });
  }, 120_000);

  it("seed 20329: Enter on a literal, the text changed through the API, then a move (the box stayed open with the focus gone, so the keyboard was stranded)", () => {
    check({
      code: "a b c",
      steps: [
        {
          op: "collapse or expand",
          r: [974686041, 393099030, 159656678, 71107698],
        },
        {
          op: "change the text through the API",
          r: [563141818, 628907888, 90985575, 723781785],
        },
        { op: "move around", r: [927520137, 596705251, 494365265, 398110040] },
      ],
    });
  }, 120_000);

  it("seed 17540: Enter on a literal, the text changed through the API, then a cancelled paste", () => {
    check({
      code: "(f x y)\n(g z)\nw",
      steps: [
        {
          op: "collapse or expand",
          r: [598336489, 826457895, 507273010, 265504131],
        },
        {
          op: "change the text through the API",
          r: [129186773, 631025327, 466153341, 909719125],
        },
        {
          op: "paste at the top level",
          r: [481923635, 580240645, 98672362, 292911046],
        },
      ],
    });
  }, 120_000);

  it("seed 20155: Enter on a literal, the text changed through the API, then typing and an insert beside a block (an orphaned editing box left a block undrawn)", () => {
    check({
      code: "(f x y)\n(g z)\nw",
      steps: [
        {
          op: "collapse or expand",
          r: [597559473, 410646331, 644857653, 17131297],
        },
        {
          op: "change the text through the API",
          r: [494936315, 80101048, 510348461, 824699950],
        },
        {
          op: "type at the top level",
          r: [217412442, 798088282, 13642044, 905774059],
        },
        {
          op: "insert beside a block",
          r: [522170540, 946118736, 798589169, 434503753],
        },
      ],
    });
  }, 120_000);

  it("seed 10096: an edit left open by an API text change, then editing again (blurring the box re-focused it, forever)", () => {
    check({
      code: "(define (sq n) (* n n))\n(sq 4)",
      steps: [
        { op: "delete", r: [425276332, 847047575, 115290901, 501611723] },
        {
          op: "paste beside a block",
          r: [424724473, 571898969, 948509515, 932128352],
        },
        {
          op: "change the text through the API",
          r: [243142801, 832701041, 992931897, 906643422],
        },
        {
          op: "type at the top level",
          r: [448890938, 631538996, 244411110, 963922414],
        },
        {
          op: "change the text through the API",
          r: [79583931, 622989793, 113965123, 747364256],
        },
        {
          op: "edit a block in place",
          r: [188323108, 570099567, 489579569, 968891330],
        },
      ],
    });
  }, 120_000);

  it("seed 78904: a lambda `let` whose block stopped before its body, so the top level seemed to reach into the program (typing there, then a text change through the API)", () => {
    check({
      code: "let (a = 1, b = 2) a + b",
      language: "lambda",
      steps: [
        {
          op: "type at the top level",
          r: [767286620, 21939603, 982529548, 881103949],
        },
        {
          op: "change the text through the API",
          r: [736564383, 406726763, 821664896, 272203532],
        },
      ],
    });
  }, 120_000);

  it("seed 79138: pasting a statement over itself shrank the block marker of the program that holds it", () => {
    check({
      code: "lambda (x) x + 1",
      language: "lambda",
      steps: [
        {
          op: "switch to text mode and back",
          r: [354887366, 798517515, 4435561, 804792238],
        },
        {
          op: "paste over a selection",
          r: [595669659, 842733167, 369410184, 617543750],
        },
      ],
    });
  }, 120_000);
});

describe("random sequences of operations", () => {
  if (REPLAY) {
    it("replays the sequence in CMB_RANDOM_REPLAY", () => {
      check(JSON.parse(REPLAY) as Sequence);
    }, 120_000);
    return;
  }
  // the default run uses a few consecutive seeds; CMB_RANDOM_SEED starts elsewhere
  const seeds = process.env.CMB_RANDOM_SEED
    ? Array.from({ length: RUNS }, (_, i) => FIRST_SEED + i)
    : Array.from({ length: Math.min(RUNS, 12) }, (_, i) => i + 1);
  it.each(seeds)(
    `seed %i (${STEPS} steps) keeps the editor consistent, and undoes and redoes cleanly`,
    (seed) => {
      check(generate(seed, STEPS), seed);
    },
    120_000
  );
});
