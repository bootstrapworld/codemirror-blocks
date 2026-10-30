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
};

/** What an operation did, for the report. `undefined` if it did not apply. */
type Outcome = string | undefined;

type Operation = {
  name: string;
  /** how often to pick it, relative to the others (default 1) */
  weight?: number;
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
  const positions: Pos[] = [];
  for (let line = 0; line <= w.cmb.lastLine(); line++) {
    for (let ch = 0; ch <= w.cmb.getLine(line).length; ch++) {
      const inside = roots.some(
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

/** Things to type, paste and drop in: one block, a few blocks, or a list */
const texts = ["zzz", "7", "(g w)", "(h 1 2)", "foo bar", '"hi"'];

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
const finishTopLevelEdit = (n: number) => {
  switch (n % 3) {
    case 0:
      keyDown("Enter");
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
      return `type "${text}" at ${pos.line}:${pos.ch}, ${finishTopLevelEdit(r[0])}`;
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
      return `paste "${text}" at ${pos.line}:${pos.ch}, ${finishTopLevelEdit(r[3])}`;
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
      const line = w.cmb.lastLine();
      w.cmb.replaceRange(`\n${text}`, { line, ch: w.cmb.getLine(line).length });
      return `API: add "${text}" at the end`;
    },
  },
];

// Operations that start a new undo history (a mode switch replaces the editor)
const modeSwitch: Operation = {
  name: "switch to text mode and back",
  run: (w, r) => {
    stopEditing();
    w.cmb.setBlockMode(false);
    let edit = "";
    if (r[1] % 3 === 0) {
      // edit the text while in text mode
      const text = pick(texts, r[2])!;
      const line = w.cmb.lastLine();
      w.cmb.replaceRange(`\n${text}`, { line, ch: w.cmb.getLine(line).length });
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
type Sequence = { code: string; steps: Step[] };

const documents = [
  "(f x y)\n(g z)\nw",
  "a b c",
  "(define (sq n) (* n n))\n(sq 4)",
  "(f (g x) (h y z))\n\n42",
  "(if (< a b) a b) c",
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
  const code = documents[randomInt(random, documents.length)];
  const steps = Array.from({ length }, () => ({
    op: chooseOperation(big()).name,
    r: [big(), big(), big(), big()],
  }));
  return { code, steps };
}

type Failure = {
  /** what went wrong, first line first */
  message: string;
  /** where: a step number, or the undo/redo walk at the end */
  at: string;
};
type RunResult = { failure?: Failure; trace: string[] };

/** Run one sequence on a fresh editor, stopping at the first problem. */
function runSequence(sequence: Sequence): RunResult {
  const { cmb, store } = mountCMB(wescheme);
  const clipboard = installFakeClipboard("zzz");
  const world: World = { cmb, store, clipboard };
  const errors = jest.spyOn(console, "error");
  const trace: string[] = [];
  const text = () => cmb.getValue();

  // What is wrong with the editor right now, if anything
  let errorsSeen = errors.mock.calls.length;
  const problem = (): string | undefined => {
    if (errors.mock.calls.length > errorsSeen) {
      const logged = errors.mock.calls[errorsSeen].map(String).join(" ");
      errorsSeen = errors.mock.calls.length;
      return `console.error: ${logged}`;
    }
    const violations = findInvariantViolations();
    return violations.length ? violations.join("\n") : undefined;
  };
  const fail = (at: string, message: string): RunResult => ({
    failure: { at, message },
    trace,
  });

  try {
    cmb.setValue(sequence.code);
    cmb.clearHistory();
    // the text that undoing everything should lead back to
    let baseline = text();

    for (const [i, step] of sequence.steps.entries()) {
      const op = allOperations.find((o) => o.name === step.op);
      if (!op) throw new Error(`no such operation: ${step.op}`);
      const at = `step ${i + 1} (${step.op})`;
      let outcome: Outcome;
      try {
        outcome = op.run(world, step.r);
      } catch (e) {
        trace.push(`${step.op}: threw`);
        return fail(at, `threw ${e instanceof Error ? e.stack : e}`);
      }
      trace.push(
        `${outcome ?? `${step.op}: not applicable`}\n       text: ${JSON.stringify(text())}`
      );
      if (op === modeSwitch) {
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
    clipboard.restore();
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
    `  document:  ${JSON.stringify(sequence.code)}`,
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
});

describe("random sequences of operations", () => {
  if (REPLAY) {
    it("replays the sequence in CMB_RANDOM_REPLAY", () => {
      check(JSON.parse(REPLAY) as Sequence);
    }, 120_000);
    return;
  }
  const seeds = Array.from({ length: RUNS }, (_, i) => FIRST_SEED + i);
  it.each(seeds)(
    `seed %i (${STEPS} steps) keeps the editor consistent, and undoes and redoes cleanly`,
    (seed) => {
      check(generate(seed, STEPS), seed);
    },
    120_000
  );
});
