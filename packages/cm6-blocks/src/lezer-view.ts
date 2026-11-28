/*
 * EXPERIMENT. The editor with Lezer as the source of the tree (compare view.ts,
 * which keeps its own tree with hand-made operations).
 *
 * One StateField holds the Lezer tree (reparsed incrementally with
 * `TreeFragment.applyChanges`), the block roots, and the decorations of the
 * roots. After EVERY transaction that changes the document the field:
 *   1. reparses incrementally;
 *   2. builds blocks only for the top-level Lezer nodes that are new or changed;
 *      an old root keeps its BNode (and so its element) when its range, mapped
 *      through the change, equals a new top-level node's range and its source
 *      text is unchanged (Lezer gives no identity to statements: they live in
 *      buffers). A changed root is rebuilt whole;
 *   3. fixes the positions of the kept roots (absolute offsets: a walk of the
 *      roots after the change), maps the decorations and adds/drops only the
 *      ones that changed.
 * Every edit made through the editor (insertText, removeNode, replaceText) is a
 * plain text change computed from node ranges and the table's separators,
 * dispatched as an ordinary transaction. There is no separate path for them.
 *
 * Caveat: the field mutates BNodes in place (positions of kept roots), so a
 * state computed by `state.update` and then dropped has already changed them.
 */
import {
  ChangeDesc,
  Compartment,
  EditorSelection,
  EditorState,
  Extension,
  StateEffect,
  StateField,
  Text,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
  redoDepth,
  undoDepth,
} from "@codemirror/commands";
import { Tree, TreeFragment } from "@lezer/common";
import type { Parser, SyntaxNode } from "@lezer/common";
import { walk } from "./doc";
import { userMarks } from "./user-marks";
import { forwardView, ViewSurface } from "./view-surface";
import {
  InnerCand,
  BlockTable,
  fillTemplate,
  insertChange,
  insertEmptyChange,
  LezerLanguage,
  lezerLanguage,
  removeChanges,
  separatorFor,
  keyOfNode,
  hasError,
} from "./lezer";
import { Renderer } from "./render";
import { RootWidget } from "./view";
import { attachInteraction } from "./interact";
import type { Search } from "./search";
import {
  ActivityExport,
  createRecorder,
  DEFAULT_LIMIT,
  LogEntry,
} from "./activity";
import { browserPlayer, SoundEvent, SoundName, SoundPlayer } from "./sound";
import { makeNode } from "./node";
import { contentHash } from "./hash";
import { errorOf, RECENT_MS, reportText, watchUncaught } from "./error-report";
import type { ErrorReport } from "./error-report";
import { describeKinds, summarizeProgram } from "./summary";
import type { Kind } from "./summary";
import { END_MESSAGE, errorsIn, explainError, place, refusal } from "./explain";
import { Bail, compatible, reconcile, ReconcileEnv } from "./reconcile";
import type { BNode, Doc, Slot, TextChange } from "./types";
import coreCss from "./css/core.css";

/**
 * The editor's sheets go into the root its element is in (the document, or a shadow root), once each: a `<style data-cm6-blocks="core">` and
 * one for the language (`table.css`). Nothing else in the page is touched.
 */
export function injectSheets(
  el: Element,
  table: { lang?: string; css?: string }
): void {
  const root = el.getRootNode() as Document | ShadowRoot;
  const host: Node = (root as Document).head ?? root;
  const doc = el.ownerDocument;
  const put = (name: string, css: string | undefined): void => {
    if (!css) return;
    const have = Array.from(
      root.querySelectorAll?.("style[data-cm6-blocks]") ?? []
    ).some((s) => s.getAttribute("data-cm6-blocks") === name);
    if (have) return;
    const st = doc.createElement("style");
    st.setAttribute("data-cm6-blocks", name);
    st.textContent = css;
    host.appendChild(st);
  };
  put("core", coreCss);
  put(table.lang ?? "lang", table.css);
}

export interface LezerOptions {
  parser: Parser;
  table: BlockTable;
  /** CodeMirror 6's own configuration (an alternative to the arguments `parent` and `text`): where the editor goes; the program text (`doc`, or `value`, an alias); the extensions the page adds (keymaps, decorations, themes, `lineNumbers()`, ...); see `ed.reconfigure` */
  parent?: HTMLElement;
  doc?: string | Text;
  value?: string;
  extensions?: Extension;
  /** start with every block collapsed */
  collapseAll?: boolean;
  /** lay a touched root over its old nodes (reconcile.ts); false rebuilds it whole, as before the fourth round (for measuring) */
  reconcile?: boolean;
  /** inside a touched root, take old nodes over without building them where the change is not near (the fifth round); false builds the whole root and compares it (for measuring) */
  anchors?: boolean;
  /** edits after a document with no parse error: look for errors in the roots built again only, not in the whole tree after the change; false walks it (for measuring) */
  fastErrors?: boolean;
  /** roots that no change is near are taken from the old tree without reading their part of the new one; false reads every top-level node of the new tree (for measuring) */
  skipRoots?: boolean;
  /** Shift-Tab on a block calls this (the old editor moves the focus to its toolbar); without it the key does what the browser does */
  focusToolbar?: () => void;
  /** sounds (the old editor's beep and wrap sound) are played; false: none (also `ed.setSounds`). Default true */
  sounds?: boolean;
  /** what plays a sound; the default is the browser's Audio (sound.ts). A test passes one that records what was asked for which event */
  playSound?: SoundPlayer;
  /**
   * The error notice's report form (forty-fourth round). NOTHING is sent by the editor. The form shows the report text (the error, the program,
   * the activity log, the browser) for the person to copy; if `onReport` is given, it also has a "Send" button that calls it with the report.
   * The old editor opened a new issue of the project's GitHub in a tab: there is no address of anyone's here.
   */
  onReport?: (report: ErrorReport) => void;
  /** called whenever the notice is raised, before the person does anything (a page that logs errors; the old editor's `setLogReporter`) */
  onError?: (error: unknown, report: ErrorReport) => void;
  /**
   * Watch the window for uncaught errors and unhandled rejections, and show the notice for one that comes within 2 seconds of something done to
   * the editor (the old editor's rule, and its default: it watched always). The errors are not swallowed: the browser reports them as usual.
   * `false` installs no listener. The watcher goes away with `ed.destroy()`.
   */
  watchUncaughtErrors?: boolean;
  /** how many entries of the activity log are kept (default 200, as the old editor); the oldest are dropped, their changes folded into the log's starting text */
  activityLimit?: number;
}

/**
 * What the height check did (`ed.heightStats()`), to watch it in the soak for false positives and for cost. Plain counters: nothing is
 * measured or read for them beyond what the check does anyway, except the clock around `heightsStale` (its own cost is the point).
 */
export interface HeightStats {
  /** `checkGutterLater` calls that scheduled a check (a call while one is pending is not counted) */
  checks: number;
  /** `heightsStale` calls, and how many of them said the page's lines are not the heights CodeMirror holds */
  staleCalls: number;
  staleTrue: number;
  /** milliseconds spent inside `heightsStale` in all (the page's layout is read there) */
  staleMs: number;
  /** `remeasureHeights` calls from anywhere (a collapse, an edit box, the check) and those made by the check itself */
  remeasures: number;
  repairs: number;
  /** repairs after which the line heights CodeMirror holds were the same (nothing changed: the check had cried wolf) */
  falsePositives: number;
  /** repairs after which `heightsStale` still said stale (the repair did not help) */
  stillStale: number;
  /** checks that found something to repair (stale heights, or a gutter that disagrees with the lines) and did not, because `gutterRepairs` had reached its cap of 2 */
  capped: number;
  /** of those, the ones where the heights were stale (a repair `remeasureHeights` should have made) */
  cappedStale: number;
  /** gutter redraws (`syncGutters`) the check made, when only the numbers disagreed with the lines */
  gutterSyncs: number;
  /** spacers for the lines CodeMirror does not draw that were set to the height of the lines they stand for */
  gapFixes: number;
}

export interface LezerStats {
  edits: number;
  reparses: number;
  widgetsBuilt: number;
  focusRestores: number;
  rootsKept: number;
  rootsRebuilt: number;
  /** touched roots whose old nodes were kept and changed in place (node-level reuse) */
  rootsReconciled: number;
  /** nodes that are new in the tree: built for a rebuilt root, or inserted / replaced inside a reconciled one */
  nodesRebuilt: number;
  /** nodes of reconciled roots compared with their old counterparts (those built new in this update) */
  nodesCompared: number;
  /** old nodes taken over as they are into a new tree, inside a touched root, without building or comparing them (anchors) */
  nodesAnchored: number;
  /** touched roots whose anchors could not all be placed: the old root was dropped and the new one used */
  anchorBails: number;
  /** nodes in the largest root rebuilt so far */
  maxRootNodes: number;
  /** time spent in the field update, in ms: reparse; and the rest (matching, building, positions, decorations) */
  parseMs: number;
  restMs: number;
}

/**
 * The editor. It can stand where an `EditorView` is expected (`state`, `dispatch`, `dom`, `focus`, `requestMeasure`, `coordsAtPos`, ...
 * are the view's: see view-surface.ts); `view` is the real `EditorView`.
 */
export interface LezerBlockEditor extends ViewSurface {
  readonly view: EditorView;
  /** replace the extensions the page gave (the option `extensions`) with `extensions`, as `Compartment.reconfigure` does */
  reconfigure(extensions: Extension): void;
  readonly doc: Doc;
  readonly language: LezerLanguage;
  readonly renderer: Renderer;
  readonly options: LezerOptions;
  /** the message of the last edit the keyboard or mouse could not make (e.g. insert into an empty list) */
  lastError: string | null;
  roots(): BNode[];
  /** the templates of the language (the table's), in the order written */
  templates(): { name: string; kind: string; stmt: boolean }[];
  /**
   * Write template `name` after `anchor` (or the nearest ancestor that sits in a list that takes it),
   * else at the end of the program. Holes are the language's blank. Returns the first hole (or the
   * new block), also focused with its edit box open.
   */
  insertTemplate(name: string, anchor?: BNode | null): BNode | null;
  /**
   * Write template `name` at a gap (`slot`, `index`) or in place of a blank, as a drop from the toolbar does. Throws where it cannot go
   * (a statement into an expression slot, text pieces). Returns the first hole (or the new block), as `insertTemplate` does.
   */
  insertTemplateAt(
    name: string,
    target: { slot: Slot; index: number } | { blank: BNode } | { at: number }
  ): BNode | null;
  /** start dragging template `name` from the toolbar: call from a `pointerdown` on a toolbar button; the block goes where the pointer is let go over a gap or a blank (a press that does not move is left to the button's own click) */
  beginTemplateDrag(e: PointerEvent, name: string): void;
  /** edit a leaf in place (its box); `typed` starts the text with that key */
  edit(node: BNode, typed?: string): void;
  /** put the focus back in the editor, after a trip to the toolbar: on the block that had it last, else the first one */
  focusEditor(): void;
  /** the block that had focus last (it may have lost it to a toolbar), if it is still in the tree */
  lastFocused(): BNode | null;
  /** insert source text `snippet` as element `index` of a list slot (a text change, one undo step) */
  insertText(slot: Slot, index: number, snippet: string): void;
  /**
   * Set by the interaction layer: text typed or pasted at the top level (outside every block) never reaches the document; this is
   * called with it instead (a microtask later), and opens the pending box (the old editor's "quarantine").
   */
  topLevelInput:
    | ((from: number, to: number, text: string, how: "type" | "paste") => void)
    | null;
  /** open the pending box for text just held back now, not in a microtask (tests that cannot wait) */
  flushTopLevel(): void;
  /** the element of a new pending box at `pos` (a widget in the text); `clearPending` removes it, `pendingAt` is where it is now */
  pendingHost(pos: number): HTMLElement;
  clearPending(): void;
  pendingAt(): number | null;
  /** the message that refuses `insertText` with these arguments (the text would not parse), or null */
  refuseInsert(slot: Slot, index: number, snippet: string): string | null;
  /**
   * Top level typing: write `snippet` as new root(s) at the text position `at`. On a line with no block text (a blank line, the
   * ends of the document) it is written exactly there, as one change; next to a block on its line it is a new root at that place in
   * the list (`insertText`: a separator as needed). Returns the range of the text written (one undo step).
   */
  insertAt(at: number, snippet: string): { from: number; to: number };
  /** the message that refuses `insertAt` with these arguments (the text would not parse), or null */
  refuseAt(at: number, snippet: string): string | null;
  /** the message that refuses `replaceText` with these arguments, or null */
  refuseReplace(node: BNode, snippet: string): string | null;
  /**
   * the message that refuses this paste (`over`: replacing the block; else after / before it), or null if it parses; throws when the paste
   * cannot go anywhere ("no place for it beside this block"). Writes nothing.
   */
  refusePaste(
    anchor: BNode,
    texts: string[],
    before: boolean,
    over: boolean
  ): string | null;
  /** remove a node: out of a list with one separator, or (a "one" slot) put the table's blank there */
  removeNode(node: BNode): void;
  /** remove several nodes (none inside another) in ONE text change, one undo step */
  removeNodes(nodes: BNode[], withComments?: boolean): void;
  /** the selected blocks (Space), in document order, each with the blocks inside it (like the old editor's selection set) */
  selection(): BNode[];
  /** the selected blocks that have no selected ancestor, in document order: what Delete, cut, copy and drag use */
  selectedBlocks(): BNode[];
  /**
   * Space: select the block (and everything inside it) or, if it is selected, unselect it, what is inside it and its
   * ancestors. Selecting a block inside a selected one is refused ("refused"; the old editor beeps and says so);
   * selecting a block that holds selected ones takes them over.
   */
  toggleSelect(node: BNode): "selected" | "unselected" | "refused";
  clearSelection(): void;
  /** the comment block that goes with a block (directly above it, or after it on its line), if any */
  commentOf(node: BNode): BNode | null;
  /** is `node` a comment that goes with a block? (Such a comment is not drawn as a block: it is the popup of its block.) */
  isAttachedComment(node: BNode): boolean;
  /** a block's height changed without a document change (an edit box opened or closed): tell CodeMirror to read the line heights again (the gutter's) */
  remeasureHeights(): void;
  /** the block a comment written for `node` goes with: the outermost block that starts where `node` does and is first on its line */
  commentHost(node: BNode): BNode;
  /** set the words of the comment of a block: writes a line comment above it if there is none; empty text removes the comment */
  setComment(node: BNode, words: string): void;
  /** collapse (only the head and an ellipsis are drawn; the inside is not reachable) or expand a compound block; the text is untouched */
  collapse(node: BNode, on: boolean): void;
  /** collapse / expand every block */
  collapseAll(on: boolean): void;
  /** collapse / expand a root and everything inside it */
  collapseRoot(root: BNode, on: boolean): void;
  /** search: the dialog (F3, Ctrl-F, Cmd-F), PageDown / PageUp, the rotor; see search.ts */
  readonly search: Search;
  /** the activity log: what the person did, oldest first, at most `activityLimit` entries (see activity.ts); a copy */
  activityLog(): LogEntry[];
  /** forget the log; the text now is where the next entries start from */
  clearActivityLog(): void;
  /** the log with the text it starts from and how many older entries were dropped: what a bug report would carry, and what `replay` takes */
  exportActivity(): ActivityExport;
  /**
   * Run `fn` as one logged action (an action inside another is part of it). Text changes made inside belong to the entry; if there are none,
   * one is made at the end unless `skip()` says there is nothing to record. For the parts of this package that handle the person's input.
   */
  act<T>(
    action: string,
    target: BNode | null | undefined,
    detail: Record<string, unknown> | undefined,
    fn: () => T,
    skip?: () => boolean
  ): T;
  /** ask for a sound for an event (nothing happens while sounds are off); the player is the option `playSound` */
  sound(name: SoundName, event: SoundEvent): void;
  setSounds(on: boolean): void;
  soundsOn(): boolean;
  /** announce `text` to a screen reader (a live region next to the editor); also kept in `said` */
  say(text: string): void;
  /**
   * An error: a dismissible notice (role="alert") next to the editor, spoken once while it shows, with a "Report this problem" button that opens the
   * report form (see `LezerOptions.onReport`). The error is also written to the console. An action of the editor that meets an error calls this
   * (a key), and so does the watcher of uncaught errors.
   */
  reportError(error: unknown): void;
  /** the report the form shows: the latest error (or `error`), the document, the activity log; null if there has been no error */
  errorReport(error?: unknown): ErrorReport | null;
  /** what was announced, newest last (the last 50) */
  said: string[];
  /**
   * The summary of the program, the old editor's words: "At the top level, this program contains 2 function definitions and 1 call." (each kind
   * named by its table row's `label`, in the order the kinds first appear); null when there is nothing in it. Comments never count. Works in both modes.
   */
  summarizeProgram(): string | null;
  /** what a list of blocks is made of, as part of a sentence ("2 calls and 1 number"; "nothing" for none); comments are left out */
  describeKinds(nodes: readonly BNode[]): string;
  /** say the summary of the program (a live region, also in `said`); false when there is nothing to say. The first time blocks are drawn it is said by itself */
  sayProgramSummary(): boolean;
  /** what the old editor says for "Read Ancestors": the block's description, then each ancestor's, "inside", with its level; null at the top level (it beeps) */
  readAncestors(node: BNode): string | null;
  /** what it says for "Read Children": the descriptions of the children, comments left out, joined with commas ("no children" for none) */
  readChildren(node: BNode): string;
  /** the summary of one block: what a screenreader says of it, and where it is ("call with 2 arguments, at level 2") */
  summarizeBlock(node: BNode): string;
  /** Move several blocks (none inside another) to a gap, in document order: ONE text change, one undo step. */
  moveNodes(
    nodes: BNode[],
    target: { slot: Slot; index: number } | { blank: BNode } | { at: number }
  ): void;
  /** is `pos` bare whitespace of the program: not inside any top-level block (a drop there inserts at `pos`, as in the old editor) */
  isWhitespaceAt(pos: number): boolean;
  /** the source text of each block (see copyText), in the order given */
  copyTexts(nodes: BNode[]): string[];
  /** paste several blocks one after another (as separate elements of one list); one text change */
  pasteTexts(
    anchor: BNode | null,
    texts: string[],
    before?: boolean
  ): BNode | null;
  /** replace the text of a node */
  replaceText(node: BNode, snippet: string): void;
  /** the source text of a block, its later lines moved left by the indentation of its first line (what the clipboard holds); `withComment`: with the comment that goes with it, on a line above */
  copyText(node: BNode, withComment?: boolean): string;
  /**
   * Write source text `text` after `anchor` (in the nearest list that holds it; replacing `anchor` if it is a blank; at
   * the end of the program when there is no anchor). The new block is focused. Returns it, if found.
   */
  pasteText(anchor: BNode | null, text: string, before?: boolean): BNode | null;
  /** Move a block to a gap (`slot`, `index`) or onto a blank: ONE text change (cut and paste), one undo step. Throws if the target is inside the block. */
  moveNode(
    node: BNode,
    target: { slot: Slot; index: number } | { blank: BNode }
  ): void;
  /**
   * Paste over a block (the old editor's `ReplaceNodeTarget`, thirteenth round): the block and the comment that goes with it are replaced by the
   * text(s), as ONE text change. Several texts (several blocks copied together) are joined as separate elements and need a list slot; a place that
   * takes one block throws. The first pasted block is focused. Returns it, if found.
   */
  replaceWithTexts(node: BNode, texts: string[]): BNode | null;
  /** is this block a hole (a blank): what a drop or a paste replaces */
  isBlank(node: BNode): boolean;
  /** apply one text change as one undo step */
  change(c: TextChange): void;
  focusNode(node: BNode): void;
  focusedNode(): BNode | null;
  /**
   * The mode: "blocks" (the program drawn as blocks over the text) or "text" (plain CodeMirror text, no block layer, no block keys). `setMode` switches at
   * once, with no animation (`mountModeToggle` of mode.ts has the animated switch and the button). Going to blocks needs text that parses: a text with
   * a parse error stays in text mode, and the answer is the message that says why (null when the mode is the one asked for). Focus and scroll position
   * are kept; going back to blocks after the text was edited in text mode starts the undo history over (the old editor's rule).
   */
  setMode(mode: "text" | "blocks"): string | null;
  readonly mode: "text" | "blocks";
  /** why the text cannot be shown as blocks now (the parser's message), or null when it can */
  modeProblem(): string | null;
  /** `fn` is called after each switch of the mode; returns the function that stops it */
  onModeChange(fn: (mode: "text" | "blocks") => void): () => void;
  /** forget the undo and redo history (the text stays) */
  clearHistory(): void;
  /** `setMode` for a boolean (the old editor's name); a switch refused for a parse error is silent here: ask `modeProblem` or use `setMode` */
  setBlockMode(on: boolean): void;
  /** are the blocks showing (not the text mode) */
  isBlockMode(): boolean;
  stats(): LezerStats;
  /** counters of the height check (see `HeightStats`) */
  heightStats(): HeightStats;
  destroy(): void;
}

interface LState {
  tree: Tree;
  fragments: readonly TreeFragment[];
  roots: BNode[];
  decos: DecorationSet;
  /** where the Lezer error nodes of the tree are, [from, to] (sorted by from) */
  errs: [number, number][];
}
const errorsOf = (tree: Tree, from = 0): [number, number][] => {
  const out: [number, number][] = [];
  tree.iterate({
    from,
    enter: (n) => {
      if (n.type.isError) out.push([n.from, n.to]);
    },
  });
  return out;
};

/**
 * Whether the text has anything that is not blank between the top-level nodes of `tree` (before the first, between two, after the last):
 * a tree with no error covers all of the text that is not blank, so something is then missing from it (a fault of an incremental parse)
 */
const lostText = (tree: Tree, text: string): boolean => {
  const c = tree.cursor();
  let at = 0;
  const gap = (to: number): boolean => to > at && /\S/.test(text.slice(at, to));
  if (c.firstChild()) {
    do {
      if (gap(c.from)) return true;
      at = Math.max(at, c.to);
    } while (c.nextSibling());
  }
  return gap(text.length);
};

/**
 * Whether the top-level nodes of `a` that end by `limit` are the top-level nodes of `b` at the same places (the same type, the same range):
 * the text before a change reads as it did, unless the incremental parse that made `b` went wrong
 */
const sameBefore = (a: Tree, b: Tree, limit: number): boolean => {
  const x = a.cursor();
  if (!x.firstChild()) return true;
  const y = b.cursor();
  if (!y.firstChild()) return x.to > limit;
  for (;;) {
    if (x.to > limit) return true;
    if (x.type !== y.type || x.from !== y.from || x.to !== y.to) return false;
    if (!x.nextSibling()) return true;
    if (!y.nextSibling()) return false;
  }
};

/**
 * Whether the top-level nodes of `b` that start after the change (`toB`) are those of `a` that started after it (`toA`), moved by the change
 * (`map`): the same types, the same ranges. The text after a change reads as it did unless the change reaches into it (an unclosed bracket,
 * a changed indentation: then a fresh parse says how) or the incremental parse that made `b` went wrong
 */
const sameAfter = (
  a: Tree,
  b: Tree,
  toA: number,
  toB: number,
  map: ChangeDesc
): boolean => {
  const x = a.cursor();
  const y = b.cursor();
  let hx = x.childAfter(toA);
  let hy = y.childAfter(toB);
  while (hx && x.from <= toA) hx = x.nextSibling();
  while (hy && y.from <= toB) hy = y.nextSibling();
  while (hx && hy) {
    if (
      x.type !== y.type ||
      y.from !== map.mapPos(x.from, 1) ||
      y.to !== map.mapPos(x.to, -1)
    )
      return false;
    hx = x.nextSibling();
    hy = y.nextSibling();
  }
  return !hx && !hy;
};

/**
 * Whether a node around an edit (the node at each end of it and the nodes that hold it, but not the top node) has a child outside its own
 * range: a tree that cannot be, which Lezer's incremental parse makes when it reuses a token that an edit inside a comment changed the
 * extent of (`null` with an unclosed `/* open` typed in it, then an edit in that comment: the comment holds the identifier before it). A
 * fresh parse of the same text has the comment inside the identifier, as the other places where one sits. The cost is the children of the
 * few nodes that hold the edit, not the document
 */
const malformedAround = (
  tree: Tree,
  changes: { fromB: number; toB: number }[]
): boolean => {
  for (const c of changes) {
    for (const [pos, side] of [
      [c.fromB, -1],
      [c.fromB, 1],
      [c.toB, -1],
      [c.toB, 1],
    ] as const) {
      for (let n = tree.resolveInner(pos, side); n.parent; n = n.parent) {
        for (let k = n.firstChild; k; k = k.nextSibling)
          if (k.from < n.from || k.to > n.to) return true;
      }
    }
  }
  return false;
};

// (a root of no width, which the parser makes when it recovers from an error, has nothing to replace: CodeMirror refuses the decoration)
const drawn = (n: BNode): boolean =>
  n.kind !== "error" && !(n.to === n.from && n.parent?.kind === "program");
const widgetNode = (d: Decoration): BNode => (d.spec.widget as RootWidget).node;
const count = (n: BNode): number => {
  let c = 0;
  walk(n, () => c++);
  return c;
};
/** every node of `n` that is not inside an anchor (a node of `skip`), and the anchors met */
function walkFresh(
  n: BNode,
  skip: Set<BNode>,
  f: (m: BNode) => void,
  met?: (a: BNode) => void
): void {
  f(n);
  for (const sl of n.slots)
    for (const c of sl.nodes) {
      if (skip.has(c)) met?.(c);
      else walkFresh(c, skip, f, met);
    }
}
/** set every node's parent and slot link right again (after a failed reconcile moved some of them into the old tree) */
function relink(n: BNode): void {
  for (const sl of n.slots)
    for (const c of sl.nodes) {
      c.parent = n;
      c.slot = sl;
      relink(c);
    }
}
function shiftTree(n: BNode, d: number): void {
  walk(n, (m) => {
    m.from += d;
    m.to += d;
    if (m.keywordTo !== undefined) m.keywordTo += d;
  });
}

/** `createLezerBlockEditor(parent, text, options)`, or CodeMirror 6's way: `createLezerBlockEditor({parent, doc, extensions, parser, table, ...})` */
export function createLezerBlockEditor(
  parent: HTMLElement,
  text: string,
  options: LezerOptions
): LezerBlockEditor;
export function createLezerBlockEditor(config: LezerOptions): LezerBlockEditor;
export function createLezerBlockEditor(
  a: HTMLElement | LezerOptions,
  b?: string,
  c?: LezerOptions
): LezerBlockEditor {
  const options = (typeof b === "string" ? c : a) as LezerOptions;
  const parent =
    (typeof b === "string" ? (a as HTMLElement) : options.parent) ??
    document.createElement("div");
  const text =
    typeof b === "string" ? b : String(options.doc ?? options.value ?? "");
  const { parser, table } = options;
  const language = lezerLanguage(parser, table);
  const renderer = new Renderer(language);
  /** a block's height changed without a document change (collapse, expand): CodeMirror re-reads the line heights only when its content's height changed or a redraw happened, and the editor box has a fixed height, so it is told (`mustMeasureContent`, the flag its own redraw sets) or the gutter's line numbers keep the old heights */
  const hstats: HeightStats = {
    checks: 0,
    staleCalls: 0,
    staleTrue: 0,
    staleMs: 0,
    remeasures: 0,
    repairs: 0,
    falsePositives: 0,
    stillStale: 0,
    capped: 0,
    cappedStale: 0,
    gutterSyncs: 0,
    gapFixes: 0,
  };
  /**
   * `refresh` also has CodeMirror measure its line height and character width again ("refresh" is its own flag for it): after a zoom or a
   * window of another width those can be the old ones (soak seed 200: a zoom of 4, the heights it held for wrapped lines were those of
   * unwrapped ones, whatever the plain re-read of the lines found) and every height it estimates comes from them.
   */
  const remeasureHeights = (refresh = false): void => {
    hstats.remeasures++;
    (
      view as unknown as { viewState: { mustMeasureContent: unknown } }
    ).viewState.mustMeasureContent = refresh ? "refresh" : true;
    view.requestMeasure();
  };
  /**
   * After an edit the heights are read again two frames later. A block that a drop or a removal moved is, for a frame, laid out without the
   * space of something that comes back (a gap under the mouse): CodeMirror measures that frame, and the observer of the roots may not report
   * the size that follows (the soak: a number of the gutter 20 px off until the next edit).
   * STILL NEEDED (checked with it switched off, the observer of 67a0b839 kept: a 10-minute Chromium soak over seeds 1 to 1420 failed on seed 1252, the
   * very sequence this was added for, with 0 failures in 1422 sequences with it on).
   */
  let laterPending = false;
  const remeasureLater = (): void => {
    if (laterPending || typeof requestAnimationFrame === "undefined") return;
    laterPending = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        laterPending = false;
        if (!gone) remeasureHeights();
      })
    );
  };
  /**
   * CodeMirror's measure loop gives up after six rounds ("Measure loop restarted more than 5 times"): a collapse of everything in a long
   * document shrinks the content by thousands of pixels, and each round re-reads only the lines it draws. The last round's heights are
   * kept but its update is dropped, so the gutter keeps the heights of the round before (line numbers 4 to 8 px off their blocks, and more
   * further down, until the next scroll; soak seeds 3832, 4489, 3034, 3443). After an update that moved the viewport or the heights the
   * numbers are compared with the lines two frames later, and when they disagree the gutter is drawn again from the heights CodeMirror
   * holds (its own `syncGutters`, which only an update that reports a height change calls; a read of the heights from scratch finds
   * nothing new to report, as the heights are right). One try per disagreement.
   */
  let gutterChecking = false;
  let gutterRepairs = 0;
  const gutterStale = (): boolean => {
    const els = view.dom.querySelectorAll(".cm-lineNumbers .cm-gutterElement");
    for (const e of Array.from(els) as HTMLElement[]) {
      const n = Number(e.textContent);
      if (!(n >= 1 && n <= view.state.doc.lines)) continue;
      const h = parseFloat(e.style.height);
      if (!(h >= 0)) continue;
      const b = view.lineBlockAt(view.state.doc.line(n).from);
      if (Math.abs(b.height - h) > 1) return true;
    }
    return false;
  };
  /**
   * CodeMirror's own heights of the lines it draws are older than the page: a line is taller than the height CodeMirror holds for it (a
   * block laid out again after a drop, with nothing that told the measure loop: soak seed 9057, `lineWrapping` on, a gutter 5 px off
   * for every line below the block, the numbers and the lines each drawn from a different height until the next scroll).
   */
  const heightsStale = (): boolean => {
    const t0 = performance.now();
    const r = heightsStaleUntimed();
    hstats.staleCalls++;
    hstats.staleMs += performance.now() - t0;
    if (r) hstats.staleTrue++;
    return r;
  };
  const heightsStaleUntimed = (): boolean => {
    for (const el of Array.from(
      view.contentDOM.querySelectorAll(":scope > .cm-line")
    ) as HTMLElement[]) {
      let pos: number;
      try {
        pos = view.posAtDOM(el, 0);
      } catch (_) {
        continue;
      }
      const b = view.lineBlockAt(pos);
      if (b.height === 0) continue;
      if (Math.abs(el.getBoundingClientRect().height - b.height) > 1)
        return true;
    }
    return false;
  };
  /**
   * The spacers CodeMirror puts for the lines it does not draw (`.cm-gap`) are as high as its height map says the lines they stand for are,
   * read line by line (the bottom of the last line before the next drawn line minus the top of the first). For lines it has not measured the
   * map's estimate for a single line and the estimate for the range disagree by a pixel or two (soak seed 6000: a zoom of 0.64 and a window
   * of another width, a spacer 2 px higher than the top of the line it ends at), so every drawn line sits that far below the place its
   * number is put (the number comes from the top of the line's block). Where a spacer is not as high as the next drawn line's top says,
   * it is set to that: CodeMirror leaves a spacer alone while its own height value does not change, and the next check puts it right again
   * after one that does.
   */
  const fixGaps = (): boolean => {
    const vp = (
      view as unknown as {
        viewState: { viewports: { from: number; to: number }[] };
      }
    ).viewState.viewports;
    if (!vp || vp.length < 1) return false;
    const gaps = Array.from(
      view.contentDOM.querySelectorAll(":scope > .cm-gap")
    ) as HTMLElement[];
    if (!gaps.length) return false;
    const doc = view.state.doc;
    // (the gaps are in document order: before the first viewport, between viewports, after the last)
    const want: number[] = [];
    let pos = 0;
    for (let i = 0; i <= vp.length; i++) {
      const next = i < vp.length ? vp[i] : null;
      const end = next ? next.from - 1 : doc.length;
      if (end > pos) {
        const top = view.lineBlockAt(pos).top;
        want.push(
          (next
            ? view.lineBlockAt(next.from).top
            : view.lineBlockAt(end).bottom) - top
        );
      }
      if (!next) break;
      pos = next.to + 1;
    }
    if (want.length !== gaps.length) return false;
    let off = false;
    gaps.forEach((g, i) => {
      const h = want[i] / (view.scaleY || 1);
      if (Math.abs(parseFloat(g.style.height) - h) > 0.5) {
        off = true;
        g.style.height = h + "px";
      }
    });
    return off;
  };
  /**
   * The gutters' own minimum height is the height of the content, and CodeMirror sets it only in an update that reports a change of
   * geometry. A measure that changes the content's height without one (a collapse of everything at a page zoom of 1.75, soak seed 74987:
   * 3190 px against 3250) leaves it lower than the lines, and the gutter's flex column then shrinks every number a little, so that they drift
   * off their lines more and more down the page; the numbers' own heights are right. It is set to the content's height when it is not.
   */
  const fixGutterMin = (): boolean => {
    let off = false;
    for (const g of Array.from(
      view.dom.querySelectorAll(".cm-gutters")
    ) as HTMLElement[]) {
      const min = parseFloat(g.style.minHeight);
      const want = view.contentHeight / (view.scaleY || 1);
      if (!(Math.abs(min - want) > 0.5)) continue;
      g.style.minHeight = want + "px";
      off = true;
    }
    return off;
  };
  /** the heights CodeMirror holds for the lines it draws (read only after a repair, which is rare) */
  const heightSignature = (): string =>
    view.contentHeight +
    ":" +
    view.viewportLineBlocks.map((b) => b.height).join(",");
  /** two frames after a repair: did it change anything (else the check cried wolf), and is the page still not what CodeMirror holds */
  const afterRepair = (before: string): void => {
    if (typeof requestAnimationFrame === "undefined") return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (gone) return;
        if (heightSignature() === before) hstats.falsePositives++;
        if (heightsStaleUntimed()) {
          hstats.stillStale++;
          // (the page did not settle in two frames, e.g. a zoom still being applied: look again, the cap bounds the tries)
          retryCheckLater();
        }
      })
    );
  };
  /** a later check, after a quiet moment: used where a repair left the page stale and where the cap refused one (the cap is reset first) */
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const retryCheckLater = (resetCap = false): void => {
    if (retryTimer !== null || typeof setTimeout === "undefined") return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (gone) return;
      if (resetCap) gutterRepairs = 0;
      checkGutterLater();
    }, 400);
  };
  const checkGutterLater = (): void => {
    if (gutterChecking || typeof requestAnimationFrame === "undefined") return;
    gutterChecking = true;
    hstats.checks++;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        gutterChecking = false;
        if (gone) return;
        const heightsOld = heightsStale();
        if (fixGaps()) hstats.gapFixes++;
        if (fixGutterMin()) hstats.gapFixes++;
        if (!heightsOld && !gutterStale()) {
          gutterRepairs = 0;
          return;
        }
        if (gutterRepairs++ >= 2) {
          hstats.capped++;
          if (heightsOld) hstats.cappedStale++;
          retryCheckLater(true);
          return;
        }
        if (heightsOld) {
          hstats.repairs++;
          const before = heightSignature();
          remeasureHeights(true);
          afterRepair(before);
          return;
        }
        hstats.gutterSyncs++;
        const plugins = (
          view as unknown as {
            plugins?: {
              value?: { gutters?: unknown; syncGutters?: unknown };
            }[];
          }
        ).plugins;
        const gutterView = plugins
          ?.map((p) => p.value)
          .find((v) => v && v.gutters && typeof v.syncGutters === "function");
        (
          gutterView as { syncGutters(d: boolean): void } | undefined
        )?.syncGutters(false);
      })
    );
  };
  /**
   * The lines CodeMirror draws are those of its viewport. A scroll in a long document whose content changes height under it (a window a few
   * lines high, blocks that grow once they are drawn) can end the measure loop in the round that moves the viewport, with the update that
   * draws it dropped: the viewport is new, the page still shows the old lines, and the roots that the viewport holds have their elements
   * out of the page (soak seed 604247). A root of the viewport that has no element, or one outside the page, a moment after the editor went
   * quiet, is the sign (seed 4303813: a collapse of everything moved the viewport and the roots it took in were never drawn); an update of nothing draws the viewport again. One try per scroll or update.
   */
  let drawnChecking = false;
  const checkDrawnLater = (): void => {
    if (drawnChecking || typeof requestAnimationFrame === "undefined") return;
    drawnChecking = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        drawnChecking = false;
        if (gone || !blockMode) return;
        const vp = view.viewport;
        const rs = rootsSlot.nodes;
        let lo = 0;
        let hi = rs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rs[m].from >= vp.from) hi = m;
          else lo = m + 1;
        }
        for (let k = lo; k < rs.length && rs[k].to <= vp.to; k++) {
          const r = rs[k];
          if (!drawn(r)) continue;
          if (!renderer.has(r) || !renderer.element(r).isConnected) {
            view.dispatch({});
            return;
          }
        }
      })
    );
  };
  /** the text of the document as the tree stands now (the renderer asks where a comment sits) */
  let curDoc = text;
  /**
   * The comment that goes with a block: a comment block that is the sibling directly above it (only a line break and indentation between,
   * and that comment is not the trailing comment of the block before it), or one on the same line after it. Comments stay blocks of their own.
   */
  const commentNames = new Set(
    Object.entries(table.nodes)
      .filter(([, r]) => r.kind === "comment")
      .map(([k]) => k)
  );
  const SIGNS = [table.lineComment ?? "", "#|", "/*"].filter(Boolean);
  /**
   * Comments inside a block whose slots are all "one" (a Scheme `define`) are not blocks (there is no list to hold them): they are read from
   * the owner's text (the parser, run on that text alone, finds the comments; those inside a child are the child's) and stand for the
   * comment of the child next to them. They are made up (no id, no slot), and cached while the owner's text is the same.
   */
  const strays = new WeakMap<
    BNode,
    { src: string; at: number; list: BNode[] }
  >();
  const allOne = (o: BNode): boolean =>
    o.kind !== "program" &&
    o.slots.length > 0 &&
    o.slots.every((s) => s.kind === "one" && !s.pieces);
  const strayComments = (owner: BNode): BNode[] => {
    if (!allOne(owner)) return [];
    const src = curDoc.slice(owner.from, owner.to);
    if (!SIGNS.some((g) => src.includes(g))) return [];
    const have = strays.get(owner);
    if (have && have.src === src && have.at === owner.from) return have.list;
    const kids = owner.slots.flatMap((s) => s.nodes);
    const list: BNode[] = [];
    parser.parse(src).iterate({
      enter(n) {
        if (!commentNames.has(n.name)) return;
        const a = n.from + owner.from;
        const b = n.to + owner.from;
        if (kids.some((k) => k.from <= a && b <= k.to)) return;
        list.push({
          id: -1,
          kind: "comment",
          from: a,
          to: b,
          parent: owner,
          slot: null,
          slots: [],
          value: curDoc.slice(a, b),
        });
      },
    });
    strays.set(owner, { src, at: owner.from, list });
    return list;
  };
  /** the text change that removes a stray comment: it, and the line break and indentation after it (or the spaces before it) */
  const strayRemoval = (n: BNode): TextChange => {
    const after = /^[ \t]*\r?\n[ \t]*/.exec(curDoc.slice(n.to, n.to + 400));
    let from = n.from;
    if (!after) while (from > 0 && /[ \t]/.test(curDoc[from - 1])) from--;
    return { from, to: n.to + (after ? after[0].length : 0), insert: "" };
  };
  /** does this block have a comment of the kind above in its own text (the renderer repaints the children of such a block after an edit)? */
  const hasStrays = (o: BNode): boolean => strayComments(o).length > 0;
  /** the siblings of a block or comment, in order (the made-up comments of an all-"one" owner among them) */
  const sibsOf = (n: BNode): BNode[] | null => {
    const owner = n.parent;
    if (owner && allOne(owner)) {
      const st = strayComments(owner);
      if (!st.length) return null;
      return [...owner.slots.flatMap((s) => s.nodes), ...st].sort(
        (a, b) => a.from - b.from
      );
    }
    return n.slot ? n.slot.nodes : null;
  };
  const trailing = (a: BNode | undefined, c: BNode): boolean =>
    !!a && a.kind !== "comment" && /^[ \t,]*$/.test(curDoc.slice(a.to, c.from));
  /**
   * The ONE place that says which block a comment goes with (everything else asks `ownerOf` / `commentsOf`): the generic rule is the block
   * before it when the comment is after that block on its line, else the block directly after it (only a line break and indentation between).
   */
  const ownerOf = (c: BNode): BNode | null => {
    if (c.kind !== "comment") return null;
    const sibs = sibsOf(c);
    if (!sibs) return null;
    const j = sibs.indexOf(c);
    const ok = (x: BNode | undefined): x is BNode =>
      !!x && x.kind !== "comment" && x.kind !== "error" && !!x.slot;
    const prev = sibs[j - 1];
    const next = sibs[j + 1];
    if (table.attach) {
      const r = table.attach({
        comment: c,
        before: ok(prev) ? prev : null,
        after: ok(next) ? next : null,
        siblings: sibs,
        text: { length: curDoc.length, slice: (a, b) => curDoc.slice(a, b) },
      });
      if (r === null) return null;
      if (r !== "default") return ok(r) && sibs.includes(r) ? r : null;
    }
    if (ok(prev) && trailing(prev, c)) return prev;
    if (ok(next) && /^[ \t]*\r?\n[ \t]*$/.test(curDoc.slice(c.to, next.from)))
      return next;
    return null;
  };
  /** the comments that go with a block, in text order (the one above it, then the one after it on its line) */
  const commentsOf = (n: BNode): BNode[] => {
    if (!n.slot || n.kind === "comment" || n.kind === "error") return [];
    const sibs = sibsOf(n);
    if (!sibs) return [];
    const i = sibs.indexOf(n);
    // (a rule may attach a comment to a block that is not next to it: every comment of the list is asked)
    const near = table.attach ? sibs : [sibs[i - 1], sibs[i + 1]];
    return near.filter((c) => c && c.kind === "comment" && ownerOf(c) === n);
  };
  /** the first of them (the one a block shows and edits) */
  const commentOf = (n: BNode): BNode | null => commentsOf(n)[0] ?? null;
  /** the last node of a block and its comments, not counting a comment after the block on its line (a paste goes before that) */
  const tailOf = (n: BNode): BNode => {
    const ns = groupOf(n).nodes.filter(
      (c) => c === n || curDoc.slice(n.to, c.from).includes("\n")
    );
    return ns[ns.length - 1];
  };
  /** a block that can be collapsed: it has something inside, or it is a comment (collapsed it is only its emoji) */
  const foldable = (n: BNode): boolean =>
    n.kind !== "program" && (n.slots.length > 0 || n.kind === "comment");
  /** a block with the comments that go with it (those in a list: made-up ones are in its text already): the text range and the nodes */
  const groupOf = (n: BNode): { from: number; to: number; nodes: BNode[] } => {
    const cs = commentsOf(n).filter((c) => c.slot);
    const nodes = [...cs, n].sort((a, b) => a.from - b.from);
    return { from: nodes[0].from, to: nodes[nodes.length - 1].to, nodes };
  };
  /** a comment that goes with a block: it is drawn only as that block's popup */
  const isAttached = (n: BNode): boolean =>
    n.kind === "comment" && !!n.slot && ownerOf(n) !== null;
  renderer.attached = commentOf;
  renderer.isAttached = isAttached;
  renderer.mayHaveStrays = hasStrays;
  const stats: LezerStats = {
    edits: 0,
    reparses: 0,
    widgetsBuilt: 0,
    focusRestores: 0,
    rootsKept: 0,
    rootsRebuilt: 0,
    rootsReconciled: 0,
    nodesRebuilt: 0,
    nodesCompared: 0,
    nodesAnchored: 0,
    anchorBails: 0,
    maxRootNodes: 0,
    parseMs: 0,
    restMs: 0,
  };
  const counters = stats as unknown as {
    ops: number;
    reparses: number;
    widgetsBuilt: number;
    focusRestores: number;
  };
  const program = makeNode("program", [["roots", "list"]], {
    from: 0,
    to: text.length,
  });
  const doc: Doc = {
    language,
    program,
    byId: new Map([[program.id, program]]),
  };
  const rootsSlot = program.slots[0];
  const decoFor = (n: BNode): Decoration =>
    Decoration.replace({ widget: new RootWidget(n, renderer, counters) });

  function install(roots: BNode[], len: number): void {
    rootsSlot.nodes = roots;
    for (const r of roots) {
      r.parent = program;
      r.slot = rootsSlot;
    }
    program.to = len;
  }

  const field = StateField.define<LState>({
    create(state) {
      const s = state.doc.toString();
      curDoc = s;
      const tree = parser.parse(s);
      const roots = language.fromTree(tree, s);
      install(roots, s.length);
      for (const r of roots) walk(r, (n) => doc.byId.set(n.id, n));
      return {
        tree,
        fragments: TreeFragment.addTree(tree),
        roots,
        errs: errorsOf(tree),
        decos: Decoration.set(
          roots.filter(drawn).map((r) => decoFor(r).range(r.from, r.to)),
          true
        ),
      };
    },
    update(v, tr) {
      if (!tr.docChanged) return v;
      stats.reparses++;
      const s = tr.newDoc.toString();
      curDoc = s;
      const cr: { fromA: number; toA: number; fromB: number; toB: number }[] =
        [];
      tr.changes.iterChangedRanges((fromA, toA, fromB, toB) =>
        cr.push({ fromA, toA, fromB, toB })
      );
      let frags = TreeFragment.applyChanges(v.fragments, cr);
      const tp = performance.now();
      let tree = parser.parse(s, frags);
      // (a tree that had an error and now has none: Lezer's incremental parse can keep the structure that the recovery gave to the text after
      // the error, and the text that is now right reads differently from a fresh parse (a Python body that goes on past its dedent). It is
      // read again from nothing: one parse, only in the edit that mends the text)
      if (v.errs.length) {
        let bad = false;
        tree.iterate({
          enter: (n) => {
            if (n.type.isError) bad = true;
            return !bad;
          },
        });
        if (!bad) {
          frags = [];
          tree = parser.parse(s);
        }
      }
      // (Lezer's incremental parse can also lose blocks: after an edit inside a long comment that follows other statements, the tree has the
      // comment and what is after it, and nothing of the statements before it, though there is no error. Text that no top-level node covers
      // is the sign; the cost of being wrong is one more parse)
      if (frags.length && lostText(tree, s)) {
        frags = [];
        tree = parser.parse(s);
      }
      // (and it can read statements BEFORE the change differently, with no error: a Python body that goes on over the statements after it
      // when an edit at the end of the document is undone. The top-level nodes that end before the roots next to the change are what they
      // were, or the parse is read again from nothing: one more parse, the same as when the text is lost)
      if (frags.length && cr.length) {
        let first = Infinity;
        for (const c of cr) first = Math.min(first, c.fromA);
        let lo = 0;
        let hi = v.roots.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (v.roots[m].to >= first) hi = m;
          else lo = m + 1;
        }
        if (lo > 1 && !sameBefore(v.tree, tree, v.roots[lo - 1].from)) {
          frags = [];
          tree = parser.parse(s);
        }
      }
      // (and the statements AFTER the change: Lezer can reuse one of them with a body that it keeps from before, over what is now there,
      // after an edit far above it. The top-level nodes after the change are those of the old tree moved by it, or the parse is read again
      // from nothing: the same cost, and a real change of what follows (an unclosed bracket) is read the same way)
      if (frags.length && cr.length) {
        const last = cr[cr.length - 1];
        if (!sameAfter(v.tree, tree, last.toA, last.toB, tr.changes.desc)) {
          frags = [];
          tree = parser.parse(s);
        }
      }
      // (and a node around the change can come out malformed: a child that is not inside it, after an edit inside a comment. One more
      // parse, only for a tree that cannot be right)
      if (frags.length && cr.length && malformedAround(tree, cr)) {
        frags = [];
        tree = parser.parse(s);
      }
      const tq = performance.now();
      stats.parseMs += tq - tp;

      // Old roots, where they now are. A root is only kept if no change is in it or in its
      // neighbours: error recovery and the layout rules (Python's indentation, JS's automatic
      // semicolons) let text after a root, or before it, change what is inside it.
      const rs = v.roots;
      const affected = new Set<number>();
      for (const c of cr) {
        let lo = 0;
        let hi = rs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rs[m].to >= c.fromA) hi = m;
          else lo = m + 1;
        }
        const first = lo;
        lo = 0;
        hi = rs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rs[m].from > c.toA) hi = m;
          else lo = m + 1;
        }
        const last = lo - 1;
        for (
          let k = Math.max(0, first - 1);
          k <= Math.min(rs.length - 1, last + 1);
          k++
        )
          affected.add(k);
      }
      // The old root at a new position, looked up when asked (not for all of them: that was a pass over every root of the document, with two
      // mapPos each, for each edit). The new position is mapped back, the root found by binary search, and the answer checked the other way round.
      type Old = {
        node: BNode;
        to: number;
        touched: boolean;
        from0: number;
        to0: number;
      };
      const inv = tr.changes.desc.invertedDesc;
      const found = new Map<number, Old | undefined>();
      const old = {
        get(nf: number): Old | undefined {
          if (found.has(nf)) return found.get(nf);
          const p = inv.mapPos(nf, 1);
          let lo = 0;
          let hi = rs.length;
          while (lo < hi) {
            const m = (lo + hi) >> 1;
            if (rs[m].from >= p) hi = m;
            else lo = m + 1;
          }
          let o: Old | undefined;
          const r = rs[lo];
          if (r && r.from === p) {
            const from = tr.changes.mapPos(r.from, 1);
            const to = tr.changes.mapPos(r.to, -1);
            if (from === nf && to > from)
              o = {
                node: r,
                to,
                touched: affected.has(lo),
                from0: r.from,
                to0: r.to,
              };
          }
          found.set(nf, o);
          return o;
        },
      };
      // Context: a change can alter how UNCHANGED text after it reads without touching it (an unclosed
      // bracket makes the newlines after it mean nothing; a dedent moves a line out of a body). That
      // always changes the error nodes after the change (found by the fuzzer on a larger program). So: if
      // the error nodes beyond the last root the change touched are not the old ones (moved by the
      // change), no root between the first change and the last error node is kept without being compared.
      // A document that has errors but whose errors the change leaves alone keeps its fast path.
      let firstChange = s.length;
      let firstChangeA = s.length;
      for (const c of cr) {
        firstChange = Math.min(firstChange, c.fromB);
        firstChangeA = Math.min(firstChangeA, c.fromA);
      }
      // A document with no Lezer error before the change: the errors of the new tree are found in the roots that are built again (the others are
      // the old ones, which had none), instead of walking the whole tree after the change; a change that makes errors in roots it does not touch
      // is not seen by this (the slow path below sees it; the fuzzers compare with a fresh parse).
      let lastError = -1;
      let lastAffected = -1;
      affected.forEach((k) => (lastAffected = Math.max(lastAffected, k)));
      // (an error that the change makes in the roots it touches can make the parser read the text after them differently, with no change
      // there: zero-width error nodes where it recovers. The touched part of the new tree is looked at, which is small; no error in it, and
      // none before: the rest is the old text read the same)
      const touchedErr = (): boolean => {
        let lo = firstChange;
        let hi = 0;
        for (const c of cr) hi = Math.max(hi, c.toB);
        for (const k of affected) {
          lo = Math.min(lo, tr.changes.mapPos(rs[k].from, 1));
          hi = Math.max(hi, tr.changes.mapPos(rs[k].to, -1));
        }
        // (the top-level node of the new tree that ends the touched part can be longer than the roots that were: an unclosed `(` makes the
        // parser read on over the roots after it, to where it recovers, with a zero-width error at the start of the next statement. The
        // touched part goes to the end of that node, and to the start of the one after it)
        let end: SyntaxNode | null = tree.resolve(hi, -1);
        while (end && end.parent && end.parent.parent) end = end.parent;
        if (end && end.parent) {
          hi = Math.max(hi, end.to);
          const next = end.nextSibling;
          if (next) hi = Math.max(hi, next.from);
        }
        let found = false;
        // (one more at each end: a recovery node of no width at the end of the touched part, `(` + a comment + the recovery, is not inside it)
        tree.iterate({
          from: Math.max(0, lo - 1),
          to: hi + 1,
          enter: (n) => {
            if (n.type.isError) found = true;
            return !found;
          },
        });
        return found;
      };
      const noErrs =
        options.fastErrors !== false && v.errs.length === 0 && !touchedErr();
      let errs: [number, number][] = [];
      if (!noErrs) {
        const merged = new Map<string, [number, number]>();
        for (const e of [
          ...v.errs.filter((e) => e[1] <= firstChangeA),
          ...errorsOf(tree, firstChange),
        ])
          merged.set(e[0] + ":" + e[1], e);
        errs = [...merged.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
        const oldB = lastAffected >= 0 ? rs[lastAffected].to : firstChangeA;
        const newB = tr.changes.mapPos(oldB, 1);
        const oldBeyond = v.errs
          .filter((e) => e[0] >= oldB)
          .map((e) => [
            tr.changes.mapPos(e[0], 1),
            tr.changes.mapPos(e[1], -1),
          ]);
        const newBeyond = errs.filter((e) => e[0] >= newB);
        const sameErrors =
          oldBeyond.length === newBeyond.length &&
          oldBeyond.every(
            (e, i) => e[0] === newBeyond[i][0] && e[1] === newBeyond[i][1]
          );
        // (the roots between two touched ones, which a change in the first can make read differently: their errors, old and new)
        let sameInside = true;
        for (let k = 0; k < rs.length && sameInside; k++) {
          if (affected.has(k) || rs[k].to < firstChangeA || k > lastAffected)
            continue;
          const a0 = tr.changes.mapPos(rs[k].from, 1);
          const b0 = tr.changes.mapPos(rs[k].to, -1);
          const was = v.errs
            .filter((e) => e[0] >= rs[k].from && e[1] <= rs[k].to)
            .map((e) => [
              tr.changes.mapPos(e[0], 1),
              tr.changes.mapPos(e[1], -1),
            ]);
          const now = errs.filter((e) => e[0] >= a0 && e[1] <= b0);
          sameInside =
            was.length === now.length &&
            was.every((e, i) => e[0] === now[i][0] && e[1] === now[i][1]);
        }
        // (an error in the touched part, old or new, even where the same ones are left beyond it: how the parser recovers can be read another way
        // in the roots after it with no error of theirs moved, `[]` as an array or as a pattern)
        const nearError =
          errs.some((e) => e[0] <= newB && e[1] >= firstChange) ||
          v.errs.some((e) => e[0] <= oldB && e[1] >= firstChangeA);
        lastError =
          sameErrors && sameInside && !nearError
            ? -1
            : errs.reduce((m, e) => Math.max(m, e[1]), -1);
      }
      const kept = new Set<BNode>();
      // Anchors: inside a touched root that holds a change, a block that no change is near (nor its neighbours), with no Lezer error in it, and
      // that is in the old tree at the same place (mapped through the change) with the same table row, is NOT built again: the old node is
      // taken as it is (its subtree moved by the change). Only the rest of the root is built and laid over the old root.
      const anchored = new Set<BNode>();
      const useAnchors =
        options.reconcile !== false &&
        options.anchors !== false &&
        cr.length <= 8;
      const touches = (a: number, b: number): boolean =>
        cr.some((c) => c.fromB <= b && c.toB >= a);
      // the Lezer error nodes in the root being built, read from the NEW tree (the editor's list of errors only has the new ones from the
      // first change on: an error before it can be new, made by text after it)
      let rootErrs: [number, number][] = [];
      let errEnd: number[] = [];
      const errorIn = (a: number, b: number): boolean => {
        let lo = 0;
        let hi = rootErrs.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (rootErrs[m][0] <= b) lo = m + 1;
          else hi = m;
        }
        for (let j = lo - 1; j >= 0 && errEnd[j] >= a; j--)
          if (rootErrs[j][1] >= a) return true;
        return false;
      };
      let cur: { o: BNode; idx: Map<string, BNode | null> | null } | null =
        null;
      const indexOf = (o: BNode): Map<string, BNode | null> => {
        const idx = new Map<string, BNode | null>();
        const visit = (n: BNode): void => {
          for (const sl of n.slots)
            for (const c of sl.nodes) {
              const k = keyOfNode(c);
              if (k !== undefined && c.kind !== "error") {
                const id = `${tr.changes.mapPos(c.from, 1)}:${tr.changes.mapPos(c.to, -1)}:${k}`;
                idx.set(id, idx.has(id) ? null : c);
              }
              visit(c);
            }
        };
        visit(o);
        return idx;
      };
      const enter = (from: number, to: number, key: string): void => {
        cur = null;
        if (!useAnchors) return;
        const o = old.get(from);
        if (!o || o.node.kind === "error" || keyOfNode(o.node) !== key) return;
        cur = { o: o.node, idx: null };
        rootErrs = [];
        tree.iterate({
          from,
          to,
          enter: (n) => {
            if (n.type.isError) rootErrs.push([n.from, n.to]);
          },
        });
        rootErrs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
        errEnd = [];
        rootErrs.forEach(
          (e, i) => (errEnd[i] = Math.max(e[1], errEnd[i - 1] ?? -1))
        );
      };
      const inner = (c: InnerCand): BNode | null => {
        if (
          !cur ||
          touches(c.win[0], c.win[1]) ||
          (lastError >= 0 && c.to >= firstChange && c.from <= lastError) ||
          errorIn(c.from, c.to)
        )
          return null;
        const k = (cur.idx ??= indexOf(cur.o)).get(
          `${c.from}:${c.to}:${c.key}`
        );
        if (!k || hasError(k) || anchored.has(k)) return null;
        let lv = 0; // (the old level: the new tree puts it as deep as `c.level`)
        for (let p: BNode | null = k; p && p.kind !== "program"; p = p.parent)
          lv++;
        if (lv !== c.level) return null;
        const d = c.from - k.from;
        if (d !== 0) shiftTree(k, d);
        anchored.add(k);
        stats.nodesAnchored++;
        return k;
      };
      const roots = language.fromTree(
        tree,
        s,
        (from, to, key) => {
          const o = old.get(from);
          if (
            !o ||
            o.touched ||
            (lastError >= 0 && to >= firstChange && from <= lastError) ||
            o.to !== to ||
            keyOfNode(o.node) !== key ||
            hasError(o.node)
          )
            return null;
          kept.add(o.node);
          return o.node;
        },
        enter,
        inner,
        options.skipRoots === false
          ? undefined
          : (from, to) => {
              const o = old.get(from);
              if (
                !o ||
                o.touched ||
                (lastError >= 0 && to >= firstChange && from <= lastError) ||
                o.to !== to ||
                o.node.kind === "error" ||
                hasError(o.node)
              )
                return null;
              kept.add(o.node);
              return o.node;
            }
      );
      if (noErrs)
        for (const r of roots)
          if (!kept.has(r))
            tree.iterate({
              from: r.from,
              to: r.to,
              enter: (n) => {
                if (n.type.isError) errs.push([n.from, n.to]);
              },
            });
      // touched roots: the old nodes are kept as far as they are the same (reconcile.ts)
      const env: ReconcileEnv = {
        anchored: (n) => anchored.has(n),
        apply: (c) => renderer.apply(c),
        refresh: (n) => renderer.refresh(n),
        added: (n) =>
          walkFresh(
            n,
            anchored,
            (m) => {
              doc.byId.set(m.id, m);
              stats.nodesRebuilt++;
            },
            () => {
              throw new Bail(); // an anchor inside a node that is new here: it cannot also be where it was
            }
          ),
        removed: (n) => {
          let hit = false;
          walk(n, (m) => {
            if (anchored.has(m)) hit = true;
            doc.byId.delete(m.id);
          });
          if (hit) {
            renderer.forget(n);
            throw new Bail(); // an anchor inside a node that leaves (all of it is out of byId now; the new root puts its nodes back)
          }
        },
      };
      const reconciled = new Map<BNode, { from0: number; to0: number }>();
      /** old roots dropped after a failed reconcile: their own positions were overwritten, these are where they were */
      const bailed = new Map<BNode, { from0: number; to0: number }>();
      for (let i = 0; i < roots.length; i++) {
        const r = roots[i];
        if (kept.has(r)) continue;
        const o = old.get(r.from);
        if (
          options.reconcile === false ||
          !o ||
          reconciled.has(o.node) ||
          o.node.kind === "error" ||
          r.kind === "error" ||
          !compatible(o.node, r)
        )
          continue;
        let fresh = 0;
        walkFresh(r, anchored, () => fresh++);
        stats.nodesCompared += fresh;
        try {
          reconcile(o.node, r, env);
        } catch (e) {
          if (!(e instanceof Bail)) throw e;
          // an anchor could not be placed: the old root is dropped, the new one (anchors and all) is used as it is
          stats.anchorBails++;
          relink(r);
          bailed.set(o.node, { from0: o.from0, to0: o.to0 });
          continue;
        }
        reconciled.set(o.node, { from0: o.from0, to0: o.to0 });
        roots[i] = o.node;
        stats.rootsReconciled++;
      }
      const dropped = v.roots.filter((r) => !kept.has(r) && !reconciled.has(r));
      for (const r of dropped) {
        renderer.forget(r);
        walk(r, (n) => doc.byId.delete(n.id));
      }
      const fresh: BNode[] = [];
      for (const r of roots) {
        if (kept.has(r)) {
          const d = tr.changes.mapPos(r.from, 1) - r.from;
          if (d !== 0) shiftTree(r, d);
          stats.rootsKept++;
        } else if (!reconciled.has(r)) {
          fresh.push(r);
          const c = count(r);
          stats.rootsRebuilt++;
          stats.nodesRebuilt += c;
          if (c > stats.maxRootNodes) stats.maxRootNodes = c;
          walk(r, (n) => doc.byId.set(n.id, n));
        }
      }
      install(roots, s.length);
      if (dropped.length || fresh.length) renderer.renumberSlot(rootsSlot);

      let decos = v.decos.map(tr.changes);
      const drop = new Set(dropped.filter(drawn));
      const add = fresh
        .filter(drawn)
        .map((r) => decoFor(r).range(r.from, r.to));
      let lo = Infinity;
      let hi = -Infinity;
      for (const r of drop) {
        const b = bailed.get(r);
        lo = Math.min(lo, tr.changes.mapPos(b ? b.from0 : r.from, -1));
        hi = Math.max(hi, tr.changes.mapPos(b ? b.to0 : r.to, 1));
      }
      // a reconciled root keeps its widget, unless its range is no longer what the mapped decoration has
      for (const [r, p] of reconciled) {
        // (two or more separate changes inside one widget: CodeMirror's tiles for the lines after it come out the wrong length, so the
        // widget is set again then: a block moved into a block that is next to it, and the lines after them were not drawn)
        let inside = 0;
        tr.changes.iterChangedRanges((a, b) => {
          if (a >= p.from0 && b <= p.to0) inside++;
        });
        if (
          !drawn(r) ||
          (inside < 2 &&
            tr.changes.mapPos(p.from0, 1) === r.from &&
            tr.changes.mapPos(p.to0, -1) === r.to)
        )
          continue;
        drop.add(r);
        add.push(decoFor(r).range(r.from, r.to));
        lo = Math.min(lo, tr.changes.mapPos(p.from0, -1));
        hi = Math.max(hi, tr.changes.mapPos(p.to0, 1), r.to);
      }
      if (drop.size || add.length) {
        decos = decos.update({
          add,
          sort: true,
          filter: drop.size
            ? (_f, _t, d) => !drop.has(widgetNode(d))
            : undefined,
          filterFrom: drop.size ? lo : undefined,
          filterTo: drop.size ? hi : undefined,
        });
      }
      stats.restMs += performance.now() - tq;
      return {
        tree,
        fragments: TreeFragment.addTree(tree, frags),
        roots,
        decos,
        errs,
      };
    },
  });

  const compartment = new Compartment();
  const userComp = new Compartment();
  const historyComp = new Compartment();
  let held: (() => void) | null = null;
  class PendingWidget extends WidgetType {
    constructor(readonly el: HTMLElement) {
      super();
    }
    eq(o: PendingWidget): boolean {
      return o.el === this.el;
    }
    toDOM(): HTMLElement {
      return this.el;
    }
    ignoreEvent(): boolean {
      return true;
    }
  }
  const setPending = StateEffect.define<{
    pos: number;
    el: HTMLElement;
  } | null>();
  const pendingField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(d, tr) {
      d = d.map(tr.changes);
      for (const e of tr.effects)
        if (e.is(setPending))
          d = e.value
            ? Decoration.set([
                Decoration.widget({
                  widget: new PendingWidget(e.value.el),
                  side: 1,
                }).range(e.value.pos),
              ])
            : Decoration.none;
      return d;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  /** the page's own marks on whole blocks (user-marks.ts); drawn again after each update of the view */
  const marks = userMarks(
    () => view,
    renderer,
    () => rootsSlot.nodes,
    () => [view.state.field(field).decos, view.state.field(pendingField)]
  );
  /**
   * A block that has the focus is taken out of the page when scrolling leaves it outside what CodeMirror draws (the viewport): the page
   * body would have the focus, and the keys would go nowhere. The focus stays in the editor (its text) when that happens: the block
   * reports its loss while the view is being updated (`focusout` with nowhere to go), and the update's listener looks where the focus is.
   */
  let lostBlockFocus = false;
  /** the block that last took the focus and has not given it up: when it is gone from the page with the focus on the body, the focus was lost with it */
  let focusedEl: HTMLElement | null = null;
  function keepFocusOnScroll(): void {
    if (focusedEl && !focusedEl.isConnected) lostBlockFocus = true;
    // (a block that CodeMirror takes out and puts back, as a viewport that is redrawn does, loses the focus in WebKit with no event at all:
    // it is on the page body while the block that had it is in the page again: the block gets it back)
    if (
      focusedEl &&
      focusedEl.isConnected &&
      !gone &&
      blockMode &&
      !holdFocus
    ) {
      const d = view.dom.ownerDocument;
      const a = d.activeElement;
      if (!a || a === d.body || a === d.documentElement) {
        focusedEl.focus({ preventScroll: true });
        if (d.activeElement === focusedEl) return;
      }
    }
    if (!lostBlockFocus) return;
    lostBlockFocus = false;
    focusedEl = null;
    if (gone || !blockMode || holdFocus) return;
    const d = view.dom.ownerDocument;
    const a = d.activeElement;
    if (a && a !== d.body && a !== d.documentElement && a.isConnected) return;
    view.contentDOM.focus({ preventScroll: true });
  }
  /**
   * CodeMirror maps a selection range through a change by mapping its `from` with assoc 1 and its `to` with assoc -1; when a change
   * replaces the whole range (a block replaced, moved or cut: the selection was not set), `from` lands after the new text and `to`
   * before it: an INVERTED range (from > to). The next paste, delete or any `changeByRange` then throws "Invalid change range". A range
   * that comes out inverted becomes a cursor where the replaced text begins.
   */
  const keepRangesOrdered = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || tr.selection) return tr;
    const sel = tr.startState.selection;
    if (sel.ranges.every((r) => r.empty)) return tr;
    let bad = false;
    const ranges = sel.ranges.map((r) => {
      if (r.empty) return r.map(tr.changes);
      const a = tr.changes.mapPos(r.from, 1);
      const b = tr.changes.mapPos(r.to, -1);
      if (a <= b) return r.map(tr.changes);
      bad = true;
      return EditorSelection.cursor(b);
    });
    return bad
      ? [
          tr,
          {
            selection: EditorSelection.create(ranges, sel.mainIndex),
            sequential: true,
          },
        ]
      : tr;
  });
  const blockExtension: Extension = [
    pendingField,
    EditorView.updateListener.of((u) => {
      marks();
      keepFocusOnScroll();
      if (u.heightChanged || u.viewportChanged) checkGutterLater();
      if (u.viewportChanged) checkDrawnLater();
    }),
    // typing or pasting at the top level (no block under the change) is held in a pending box, not written: nothing half-typed
    // reaches the document or the undo history
    EditorState.transactionFilter.of((tr) => {
      const hook = ed.topLevelInput;
      if (!blockMode || !hook || !tr.docChanged) return tr;
      const how = tr.isUserEvent("input.paste")
        ? "paste"
        : tr.isUserEvent("input.type")
          ? "type"
          : null;
      if (!how) return tr;
      let n = 0;
      let from = 0;
      let to = 0;
      let text = "";
      tr.changes.iterChanges((a, b, _c, _d, ins) => {
        n++;
        from = a;
        to = b;
        text = ins.toString();
      });
      if (n !== 1 || text.trim() === "") return tr;
      if (
        rootsSlot.nodes.some(
          (r) =>
            (from < r.to && to > r.from) ||
            (from === to && r.from < from && from < r.to)
        )
      )
        return tr;
      held = () => hook(from, to, text, how);
      queueMicrotask(() => ed.flushTopLevel());
      return [];
    }),
    EditorView.decorations.from(field, (v) => v.decos),
    EditorView.atomicRanges.of((v) => v.state.field(field).decos),
    EditorView.editorAttributes.of({
      class: options.table.lang ? `blocks-lang-${options.table.lang}` : "",
    }),
    EditorView.contentAttributes.of({
      role: "tree",
      "aria-label": "program",
      "aria-multiselectable": "true",
    }),
  ];
  let blockMode = true;
  /** the document when text mode was entered: the history starts over on the way back only if the text differs (an edit that nets to zero keeps it); only compared on the mode switch */
  let textAtEntry: Text | null = null;
  const modeListeners = new Set<(m: "text" | "blocks") => void>();
  let gone = false;
  // eslint-disable-next-line prefer-const -- read by closures made before the view exists
  let view: EditorView;

  /* ---- focus */

  /*
   * "The node now at this place": ONE function for focus, selection (and collapsing). A place is the path from the program down to a
   * node: at each step the owner, the slot's name, the index in it and how many nodes the slot held. After an edit, the place is
   * walked again from the deepest owner that is still in the tree: the node at the same index of the same slot (clamped), then down
   * the same path as far as it goes. `exact` is false when the place is gone: the slot got shorter (the block was removed), or the
   * path could not be followed to its end.
   */
  interface Step {
    owner: BNode;
    slot: string;
    index: number;
    count: number;
  }
  interface Snap {
    node: BNode;
    pos: number;
    place: Step[];
    /** the outermost selected blocks, each with its place */
    sel: { node: BNode; place: Step[] }[];
    /** the outermost collapsed blocks, each with its place */
    folded: { node: BNode; place: Step[] }[];
    /** the focus was in a box that is no block's (the pending box of top-level typing): where it was; an edit that removes the box gives the focus to a block there */
    boxPos?: number;
  }
  function placeOf(node: BNode): Step[] {
    const steps: Step[] = [];
    for (let c: BNode | null = node; c && c.parent && c.slot; c = c.parent) {
      steps.unshift({
        owner: c.parent,
        slot: c.slot.name,
        index: c.slot.nodes.indexOf(c),
        count: c.slot.nodes.length,
      });
    }
    return steps;
  }
  const alive = (n: BNode): boolean =>
    n === program || doc.byId.get(n.id) === n;
  function resolvePlace(steps: Step[]): { node: BNode | null; exact: boolean } {
    let k = steps.length - 1;
    while (k >= 0 && !alive(steps[k].owner)) k--;
    if (k < 0) return { node: null, exact: false };
    let owner = steps[k].owner;
    let node: BNode | null = owner === program ? null : owner;
    for (let i = k; i < steps.length; i++) {
      const st = steps[i];
      const sl = owner.slots.find((q) => q.name === st.slot);
      if (!sl || sl.nodes.length === 0) return { node, exact: false };
      const idx = Math.min(Math.max(st.index, 0), sl.nodes.length - 1);
      node = sl.nodes[idx];
      if (i === steps.length - 1)
        return {
          node,
          exact:
            st.index >= 0 &&
            st.index < sl.nodes.length &&
            sl.nodes.length >= st.count,
        };
      owner = node;
    }
    return { node, exact: false };
  }
  /** a block that can be drawn, near `node`: itself, a neighbour in its slot, then up the parents */
  function nearestDrawn(node: BNode | null): BNode | null {
    let c = node;
    while (c && c.kind !== "program") {
      if (isDrawn(c)) return c;
      const sibs = c.slot ? c.slot.nodes : [];
      const i = sibs.indexOf(c);
      for (let d = 1; d < sibs.length; d++) {
        for (const j of [i - d, i + d])
          if (sibs[j] && isDrawn(sibs[j])) return sibs[j];
      }
      c = c.parent;
    }
    return null;
  }
  const isDrawn = (n: BNode): boolean =>
    drawn(n) &&
    n.kind !== "program" &&
    renderer.has(n) &&
    renderer.element(n).isConnected &&
    !isAttached(n) && // (a comment that goes with a block is not shown: it cannot take the focus)
    !hiddenByFold(n);
  /** is the block inside one that is collapsed (its element is in the page but not shown, and cannot take the focus)? */
  function hiddenByFold(n: BNode): boolean {
    for (let p = n.parent; p && p.kind !== "program"; p = p.parent)
      if (renderer.isCollapsed(p)) return true;
    return false;
  }

  /** the outermost nodes of a set: those whose parent is not in it, each with its place */
  function outermost(set: BNode[]): { node: BNode; place: Step[] }[] {
    const all = new Set(set);
    return set
      .filter((n) => !(n.parent && all.has(n.parent)))
      .map((n) => ({ node: n, place: placeOf(n) }));
  }

  function takeSnapshot(): Snap | null {
    if (!view) return null;
    const active = view.dom.ownerDocument.activeElement;
    const node =
      active && view.contentDOM.contains(active)
        ? renderer.nodeOf(active)
        : null;
    const f = node && doc.byId.get(node.id) === node ? node : null;
    const boxPos =
      !node && active && view.dom.contains(active) && active !== view.contentDOM
        ? (ed.pendingAt() ?? undefined)
        : undefined;
    const sel = renderer.selected().length
      ? outermost(renderer.selected())
      : [];
    const folded = renderer.collapsedNodes().length
      ? outermost(renderer.collapsedNodes())
      : [];
    if (!f && !sel.length && !folded.length && boxPos === undefined)
      return null;
    return {
      node: f as BNode,
      pos: f ? f.from : 0,
      place: f ? placeOf(f) : [],
      sel,
      folded,
      boxPos,
    };
  }

  let moving = false;
  /** after an edit: selection and collapsed state follow the blocks an edit replaced */
  function carryMarks(s: Snap | null): void {
    if (!s) return;
    if (moving) s = { ...s, folded: [] }; // (a move puts the collapsed marks where the blocks went)
    const follow = (
      list: Snap["sel"],
      has: (n: BNode) => boolean,
      put: (n: BNode) => void
    ): void => {
      for (const m of list) {
        if (doc.byId.get(m.node.id) === m.node) continue; // kept
        // (a block inside one that is gone has nowhere to follow: its marks do not land on a neighbour of the gone one)
        if (m.place.length && !alive(m.place[m.place.length - 1].owner))
          continue;
        const r = resolvePlace(m.place);
        if (r.node && r.exact && !has(r.node)) put(r.node);
      }
    };
    follow(
      s.sel,
      (n) => renderer.isSelected(n),
      (n) => renderer.setSelected(n, true)
    );
    follow(
      s.folded,
      (n) => renderer.isCollapsed(n),
      (n) => renderer.setCollapsed(n, true)
    );
  }

  /** the deepest node containing `pos`, else the nearest root before it */
  function deepestAt(pos: number): BNode | null {
    let owner: BNode = program;
    let best: BNode | null = null;
    for (;;) {
      const kids = owner.slots.flatMap((s) => s.nodes);
      const hit =
        kids.find((k) => k.from <= pos && pos < k.to) ??
        (owner === program
          ? ([...kids].reverse().find((k) => k.to <= pos) ?? kids[0])
          : undefined);
      if (!hit) return best;
      best = hit;
      if (!(hit.from <= pos && pos < hit.to)) return best;
      owner = hit;
    }
  }

  /**
   * The last block went while a block had the focus: the focus goes to the editor itself (the text), as in the old editor
   * (`focusAfterUndoOrRedo`: "with no block left to focus, keep keyboard focus in the editor"), not to the page body, where a
   * screen reader user hears the editor vanish. Every way the last block can go ends here: it is a net under the transaction. The same
   * when blocks remain but none is drawn yet (a document replaced while scrolled far down: CodeMirror draws the new one after the update).
   */
  function keepFocusInEditor(s: Snap | null): void {
    if (!s || (!s.node && s.boxPos === undefined) || gone || !blockMode) return;
    const doc_ = view.dom.ownerDocument;
    const active = doc_.activeElement;
    if (active && active !== doc_.body && view.dom.contains(active)) return;
    if (active && active !== doc_.body && active !== doc_.documentElement)
      return; // (the focus went somewhere on purpose)
    if (rootsSlot.nodes.some((r) => r.kind !== "error" && isDrawn(r))) return;
    view.contentDOM.focus({ preventScroll: true });
  }

  /**
   * Focus and history. The old editor stores with each history item the block that had focus before the edit and the one that had it
   * after (`actionFocus`, `commitChanges.ts`); an undo focuses the first, a redo the second (`focusAfterUndoOrRedo`); a quick run of
   * typing that CodeMirror merges into one item keeps the first "before" and the last "after". Here the two stacks are kept in step
   * with CodeMirror's history by its depths, and a block is stored as a path (slot name and index at each level from the program),
   * which means the same block in the same text, whatever the objects are by then.
   */
  interface PathStep {
    slot: string;
    index: number;
  }
  interface HistFocus {
    before: PathStep[] | null;
    after: PathStep[] | null;
  }
  const histUndo: HistFocus[] = [];
  const histRedo: HistFocus[] = [];
  let histPending: HistFocus | null = null;
  function pathOf(node: BNode): PathStep[] {
    const steps: PathStep[] = [];
    for (let c: BNode | null = node; c && c.parent && c.slot; c = c.parent)
      steps.unshift({ slot: c.slot.name, index: c.slot.nodes.indexOf(c) });
    return steps;
  }
  function resolvePath(steps: PathStep[]): BNode | null {
    let owner: BNode = program;
    let node: BNode | null = null;
    for (const st of steps) {
      const sl = owner.slots.find((q) => q.name === st.slot);
      const next = sl && sl.nodes[st.index];
      if (!next) return null;
      node = next;
      owner = next;
    }
    return node;
  }
  function focusedPath(): PathStep[] | null {
    const active = view.dom.ownerDocument.activeElement;
    const node =
      active && view.contentDOM.contains(active)
        ? renderer.nodeOf(active)
        : null;
    return node && doc.byId.get(node.id) === node ? pathOf(node) : null;
  }
  /** the focus the last edit left is what a redo goes back to: read it when the next thing happens, not while the edit is still going */
  function settleHistoryFocus(): void {
    if (!histPending) return;
    histPending.after = focusedPath();
    histPending = null;
  }
  /** keep the two stacks in step with CodeMirror's history after a batch of transactions; returns the path an undo or redo should focus */
  function trackHistory(
    trs: readonly Transaction[],
    before: EditorState,
    focusBefore: PathStep[] | null,
    after: EditorState
  ): PathStep[] | null | undefined {
    const changing = trs.filter((t) => t.docChanged);
    if (!changing.length) return undefined;
    const last = changing[changing.length - 1];
    let target: PathStep[] | null | undefined;
    if (last.isUserEvent("undo")) {
      const e = histUndo.pop() ?? { before: null, after: null };
      histRedo.push(e);
      target = e.before;
    } else if (last.isUserEvent("redo")) {
      const e = histRedo.pop() ?? { before: null, after: null };
      histUndo.push(e);
      target = e.after;
    } else {
      histRedo.length = 0;
      const grew = undoDepth(after) - undoDepth(before);
      if (grew > 0)
        for (let i = 0; i < grew; i++)
          histUndo.push({ before: i === 0 ? focusBefore : null, after: null });
      else if (histUndo.length) histUndo[histUndo.length - 1].after = null; // (merged into the item before: its "before" stays)
      histPending = histUndo[histUndo.length - 1] ?? null;
    }
    while (histUndo.length > undoDepth(after)) histUndo.shift();
    while (histUndo.length < undoDepth(after))
      histUndo.unshift({ before: null, after: null });
    while (histRedo.length > redoDepth(after)) histRedo.shift();
    while (histRedo.length < redoDepth(after))
      histRedo.unshift({ before: null, after: null });
    return target;
  }
  /** an undo or redo puts focus on the block its history item remembers (when it is in the new text); false when there is none to go to */
  function focusFromHistory(path: PathStep[] | null | undefined): boolean {
    if (!path || gone || !blockMode) return false;
    const found = resolvePath(path);
    const target = found && nearestDrawn(found);
    if (!target || target.kind === "program") return false;
    const el = renderer.element(target);
    if (view.dom.ownerDocument.activeElement !== el) {
      stats.focusRestores++;
      el.focus();
    }
    return true;
  }

  /** an edit that puts focus where it wants (a removal) holds the generic restore back, so that focus does not visit the parent on the way */
  let holdFocus = false;
  function restoreFocus(s: Snap | null, trs: readonly Transaction[]): void {
    if (!s || gone || holdFocus) return;
    const active = view.dom.ownerDocument.activeElement;
    if (active && view.contentDOM.contains(active) && renderer.nodeOf(active))
      return;
    if (!s.node) {
      // the focus was in a box of the editor that is not a block's (the pending box): if the edit took the box away, a block at its place has it now
      if (s.boxPos === undefined || (active && view.dom.contains(active)))
        return;
      let pos = s.boxPos;
      for (const t of trs) pos = t.changes.mapPos(pos, 1);
      const to = nearestDrawn(deepestAt(pos));
      if (!to || to.kind === "program") return;
      stats.focusRestores++;
      renderer.element(to).focus();
      return;
    }
    let target: BNode | null;
    if (doc.byId.get(s.node.id) === s.node) target = s.node;
    else {
      target = resolvePlace(s.place).node;
      if (!target) {
        let pos = s.pos;
        for (const t of trs) pos = t.changes.mapPos(pos, 1);
        target = deepestAt(pos);
      }
    }
    target = nearestDrawn(target);
    if (!target || target.kind === "program") return;
    stats.focusRestores++;
    renderer.element(target).focus();
  }

  /* ---- edits: all plain text changes */

  /** set while `refusePaste` asks what a paste would write: the change is caught, not dispatched */
  let dry: ((c: TextChange) => void) | null = null;
  const DRY = new Error("dry run");
  function dispatch(c: TextChange): void {
    if (dry) {
      dry(c);
      throw DRY;
    }
    stats.edits++;
    view.dispatch({
      changes: c,
      annotations: [isolateHistory.of("full")],
      userEvent: "input.block",
    });
  }
  const currentText = () => view.state.doc.toString();
  let lastNode: BNode | null = null;
  /** the text change that writes `snippet` as element `index` of a list slot (an empty list too) */
  function changeFor(slot: Slot, index: number, snippet: string): TextChange {
    if (slot.pieces)
      throw new Error(
        `nothing can be inserted into the ${slot.name} of a ${slot.owner.kind}: it is text with blocks in it`
      );
    if (slot.nodes.length === 0) {
      if (slot.owner === program)
        return {
          from: 0,
          to: 0,
          insert: snippet + (view.state.doc.length ? "\n" : ""),
        };
      return insertEmptyChange(currentText(), slot, snippet, table);
    }
    return insertChange(table, currentText(), slot, index, snippet);
  }
  /** a line comment (not a block comment: it ends at the line's end, which is what makes it swallow what follows) */
  const isLineComment = (text: string): boolean =>
    !!table.lineComment && text.startsWith(table.lineComment);
  /** the text on the line of `pos` before it, in the text as `before` ends with it */
  const lineBefore = (before: string): string =>
    before.slice(before.lastIndexOf("\n") + 1);
  /**
   * Decision (TO BE REVISITED, doc/experiments/cm6-api-map.md): a block that goes with a line comment AFTER it on its line
   * (`x = 1  # c`) is written with the comment on its own line directly above the block (`# c`, a line break, the indentation, the
   * block) when the comment would swallow the text after it, so that the comment still goes with the block (`ownerOf`) and the text
   * still parses. The comment starts its line too (a comment after another block on its line would go with that block).
   */
  function ownLineChange(
    slot: Slot,
    index: number,
    snippet: string
  ): TextChange {
    const change = changeFor(slot, index, snippet);
    if (!table.lineComment || slot.pieces) return change;
    let c: BNode | undefined;
    try {
      const roots = language.parse(snippet);
      c = roots[roots.length - 1];
    } catch {
      return change;
    }
    const last = snippet.replace(/\s+$/, "");
    if (
      !c ||
      c.kind !== "comment" ||
      c.to !== last.length ||
      !isLineComment(snippet.slice(c.from, c.to)) ||
      !snippet.slice(0, c.from).trim() ||
      lineBefore(snippet.slice(0, c.from)).trim() === ""
    )
      return change;
    const t = currentText();
    const off = change.insert.indexOf(snippet);
    if (off < 0) return change;
    const after = (change.insert.slice(off + c.to) + t.slice(change.to)).split(
      "\n"
    )[0];
    if (!after.trim()) return change;
    const ref = slot.nodes[Math.min(index, slot.nodes.length - 1)];
    const ind = indentAt(ref ? ref.from : slot.owner.from);
    const above =
      snippet.slice(c.from, c.to) +
      "\n" +
      ind +
      snippet.slice(0, c.from).replace(/\s+$/, "");
    const first = changeFor(slot, index, above);
    const at = first.insert.indexOf(above);
    const prefix = lineBefore(
      t.slice(0, first.from) + first.insert.slice(0, at)
    );
    if (!prefix.trim()) return first;
    // (the comment starts a line: no space is left at the end of the one before it)
    const lead = first.insert.slice(0, at).replace(/[ \t]+$/, "");
    let from = first.from;
    if (at === 0) while (/[ \t]/.test(t[from - 1] ?? "")) from--;
    return {
      ...first,
      from,
      insert: lead + "\n" + ind + first.insert.slice(at),
    };
  }
  /**
   * The change for text typed or pasted at the top level at `at`: exactly there when its line holds no block text (and no block
   * contains the position), else a new root at that place in the list.
   */
  function topLevelChange(at: number, snippet: string): TextChange {
    const roots = rootsSlot.nodes;
    const t = currentText();
    const ls = t.lastIndexOf("\n", at - 1) + 1;
    const le = t.indexOf("\n", at);
    const line = t.slice(ls, le < 0 ? t.length : le);
    if (!line.trim() && !roots.some((r) => r.from < at && at < r.to))
      return { from: at, to: at, insert: snippet };
    const index = roots.filter((r) => r.to <= at).length;
    return ownLineChange(rootsSlot, index, snippet);
  }
  /** Nodes are only good until the next change that rebuilds their root: refuse a stale one (throws). */
  const live = (n: BNode): void => {
    if (doc.byId.get(n.id) !== n)
      throw new Error(
        `node ${n.id} (${n.kind}) is no longer in the tree: look it up again after an edit`
      );
  };

  /** a hole: a block that is not there (zero width) or is the table's blank text */
  const isBlank = (n: BNode): boolean =>
    n.kind === "blank" ||
    (n.slots.length === 0 && n.value === (table.blank ?? "..."));
  const indentAt = (pos: number): string => {
    const t = currentText();
    return (
      t
        .slice(t.lastIndexOf("\n", pos - 1) + 1, pos)
        .match(/^[ \t]*/) as RegExpMatchArray
    )[0];
  };
  const dedent = (s: string, indent: string): string =>
    indent
      ? s
          .split("\n")
          .map((l, i) =>
            i > 0 && l.startsWith(indent) ? l.slice(indent.length) : l
          )
          .join("\n")
      : s;
  /** the change that writes `snippet` in place of a node (a missing one, zero-width, also gets its connector and spaces) */
  function replaceChange(node: BNode, snippet: string): TextChange {
    if (node.from !== node.to)
      return { from: node.from, to: node.to, insert: snippet };
    const t = currentText();
    const row = node.parent && table.nodes[keyOfNode(node.parent) ?? ""];
    const before = row?.slots?.find((q) => q.name === node.slot?.name)?.before;
    const prev = t[node.from - 1] ?? "";
    const next = t[node.to] ?? "";
    const left = before ?? (prev === "" || /[\s([{]/.test(prev) ? "" : " ");
    const right = next === "" || /[\s)\]};,]/.test(next) ? "" : " ";
    return { from: node.from, to: node.to, insert: left + snippet + right };
  }
  /** bare whitespace: no top-level block has `pos` strictly inside it */
  const isWhitespaceAt = (pos: number): boolean =>
    pos >= 0 &&
    pos <= view.state.doc.length &&
    !rootsSlot.nodes.some((r) => r.from < pos && pos < r.to);
  /** the change that writes `snippet` at a bare-whitespace position, as the old editor's drop on whitespace: exactly there; a line break is added only where text of the same line would run into it (the old editor did not, and glued the blocks together) */
  function atChange(pos: number, snippet: string): TextChange {
    if (!isWhitespaceAt(pos)) throw new Error("not between blocks");
    const t = currentText();
    const before = t.slice(t.lastIndexOf("\n", pos - 1) + 1, pos);
    const eol = t.indexOf("\n", pos);
    const after = t.slice(pos, eol < 0 ? t.length : eol);
    return {
      from: pos,
      to: pos,
      insert:
        (/\S/.test(before) ? "\n" : "") +
        snippet +
        (/\S/.test(after) ? "\n" : ""),
    };
  }
  /** after a template was written by `change`: the leaf at its first hole gets its edit box (and is returned) */
  function openHole(
    change: TextChange,
    snippet: string,
    hole: number
  ): BNode | null {
    const pos =
      change.from + change.insert.indexOf(snippet) + Math.max(hole, 0);
    let found: BNode | null = null;
    for (const r of rootsSlot.nodes) {
      walk(r, (n) => {
        if (
          n.slots.length === 0 &&
          n.from === pos &&
          n.to > n.from &&
          (!found || n.from >= found.from) &&
          !found
        )
          found = n;
      });
    }
    if (found) ed.edit(found);
    return found;
  }
  /** the drawn block that starts at `pos` and is longest (the one written there) */
  /** the last of the outermost blocks (comments aside) that lie wholly inside [from, to): where focus goes after several blocks go in, as in the old editor */
  function lastBlockIn(from: number, to: number): BNode | null {
    const inside = new Set<BNode>();
    for (const r of rootsSlot.nodes)
      if (r.to >= from && r.from <= to)
        walk(r, (n) => {
          if (
            n.from >= from &&
            n.to <= to &&
            n.to > n.from &&
            n.kind !== "comment" &&
            drawn(n)
          )
            inside.add(n);
        });
    let best: BNode | null = null;
    for (const n of inside)
      if (!(n.parent && inside.has(n.parent)) && (!best || n.from > best.from))
        best = n;
    return best;
  }
  function blockAt(pos: number, len: number): BNode | null {
    let best: BNode | null = null;
    for (const r of rootsSlot.nodes) {
      if (r.to < pos || r.from > pos + len) continue;
      walk(r, (n) => {
        if (
          n.from === pos &&
          drawn(n) &&
          n.to > n.from &&
          (!best || n.to > best.to)
        )
          best = n;
      });
    }
    return best;
  }

  function dispatchAll(cs: TextChange[]): void {
    stats.edits++;
    view.dispatch({
      changes: cs,
      annotations: [isolateHistory.of("full")],
      userEvent: "input.block",
    });
  }
  /** changes sorted, and those that overlap made one (two blanks cannot be merged: at most one of two that overlap writes text) */
  function mergeChanges(cs: TextChange[]): TextChange[] {
    const sorted = [...cs].sort((a, b) => a.from - b.from || a.to - b.to);
    const out: TextChange[] = [];
    for (const c of sorted) {
      const last = out[out.length - 1];
      if (last && c.from < last.to) {
        // (only a text that does not parse has blocks that overlap: a blank and a deletion that reaches into it make one change, which
        // writes the blank; two blanks cannot be merged)
        if (last.insert && c.insert)
          throw new Error(
            "two of the blocks overlap: they cannot be changed together"
          );
        if (c.insert) last.insert = c.insert;
        last.to = Math.max(last.to, c.to);
      } else out.push({ ...c });
    }
    return out;
  }
  const sortedNodes = (ns: BNode[]): BNode[] =>
    ns.sort((a, b) => a.from - b.from || a.to - b.to);
  /**
   * where text pasted after (or before) `anchor` goes: the gap of the list that holds it. A block that is not an element of a list
   * (the operator of a call, a condition) has no index to go by: as in the old editor (`findAdjacentDropTargetId`) it is the nearest gap of
   * its PARENT on that side with no other child of the parent between, so after the operator is the first argument; null (refused: "Cannot
   * paste before this node") when there is none. A block inside a slot of pieces (a template string) goes up to the block around it, and further up through blocks that are not list elements.
   */
  function pasteSpot(
    anchor: BNode | null,
    before = false
  ): { slot: Slot; index: number; indent: string } | null {
    let slot = rootsSlot;
    let ref: BNode | null = rootsSlot.nodes[rootsSlot.nodes.length - 1] ?? null;
    let index = rootsSlot.nodes.length;
    for (let n: BNode | null = anchor; n; n = n.parent) {
      if (n.slot && n.slot.kind === "list" && !n.slot.pieces) {
        slot = n.slot;
        ref = n;
        // (before a block that has a comment is above it, after is below it: the comments go with the block)
        const at = n !== anchor ? n : before ? groupOf(n).nodes[0] : tailOf(n);
        index = n.slot.nodes.indexOf(at) + (before ? 0 : 1);
        break;
      }
      if (n === anchor && n.slot && n.slot.kind === "one" && n.parent) {
        const p = n.parent;
        const at = p.slots.indexOf(n.slot);
        const step = before ? -1 : 1;
        for (let i = at + step; i >= 0 && i < p.slots.length; i += step) {
          const s = p.slots[i];
          if (s.pieces) return null;
          if (s.kind === "list")
            return {
              slot: s,
              index: before ? s.nodes.length : 0,
              indent: indentAt((s.nodes[0] ?? n).from),
            };
          if (s.nodes.length) return null; // (another child of the parent is in between)
        }
        return null;
      }
    }
    return { slot, index, indent: ref ? indentAt(ref.from) : "" };
  }
  /**
   * Text pasted beside a root (the old editor's `OverwriteEdit`, whatever the language): the text goes at the end (or start) of the root, with a
   * line break before it when something other than blanks comes before it on its line, and one after it when something does after it. So
   * `a b` pasted after `a` is `a\nzzz\n b`, and `a` then a line break then `b` takes only `zzz` and its line break after `a`.
   */
  function rootPasteChange(
    anchor: BNode,
    before: boolean,
    snippet: string
  ): TextChange {
    const t = currentText();
    const pos = before ? groupOf(anchor).from : tailOf(anchor).to;
    const ls = t.lastIndexOf("\n", pos - 1) + 1;
    let le = t.indexOf("\n", pos);
    if (le < 0) le = t.length;
    const lead = /\S/.test(t.slice(ls, pos)) ? "\n" : "";
    const trail = /\S/.test(t.slice(pos, le)) ? "\n" : "";
    return { from: pos, to: pos, insert: lead + snippet + trail };
  }

  const recorder = createRecorder(text, options.activityLimit ?? DEFAULT_LIMIT);
  let soundOn = options.sounds !== false;
  const defaultPlayer: SoundPlayer = browserPlayer();

  /* ---- announcements: a live region beside the editor (the old editor's announcer: assertive, atomic) */
  const said: string[] = [];
  const region = parent.ownerDocument.createElement("div");
  region.className = "blocks-announcer";
  region.setAttribute("aria-live", "assertive");
  region.setAttribute("aria-atomic", "true");
  parent.appendChild(region);
  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  /** an announcement that waits, and goes if anything else is said or the focus moves first ("Use enter to edit" 1.25 s after a literal got focus) */
  let queued: ReturnType<typeof setTimeout> | undefined;
  const unqueue = (): void => {
    if (queued) clearTimeout(queued);
    queued = undefined;
  };
  function sayLater(text: string, ms: number): void {
    unqueue();
    queued = setTimeout(() => {
      queued = undefined;
      say(text);
    }, ms);
  }
  function say(text: string): void {
    unqueue();
    said.push(text);
    if (said.length > 50) said.shift();
    region.textContent = "";
    if (sayTimer) clearTimeout(sayTimer);
    // (written a moment after it was cleared, as the old editor does, so that the same words twice are announced twice)
    sayTimer = setTimeout(() => {
      region.textContent = text;
    }, 50);
  }

  /** how deep a block is: 1 for a top-level one */
  const levelOf = (n: BNode): number => {
    let c = 0;
    for (let p: BNode | null = n; p && p.kind !== "program"; p = p.parent) c++;
    return c;
  };

  let notice: HTMLElement | null = null;
  let lastError: { error: unknown; source: ErrorReport["source"] } | null =
    null;
  function errorReport(error?: unknown): ErrorReport | null {
    const e: typeof lastError =
      error === undefined ? lastError : { error, source: "action" };
    if (!e) return null;
    return {
      format: 1,
      language: table.lang ?? "",
      mode: blockMode ? "blocks" : "text",
      userAgent: parent.ownerDocument.defaultView?.navigator?.userAgent ?? "",
      code: view.state.doc.toString(),
      activity: recorder.export(),
      error: errorOf(e.error),
      source: e.source,
    };
  }
  function reportError(
    error: unknown,
    source: ErrorReport["source"] = "action"
  ): void {
    // (the error is not swallowed: it is written down, as the old editor's log reporter did)
    console.error(error);
    lastError = { error, source };
    if (options.onError) {
      try {
        const r = errorReport();
        if (r) options.onError(error, r);
      } catch (e) {
        console.error(e);
      }
    }
    if (notice?.isConnected) return; // (said once while it is showing)
    const doc = parent.ownerDocument;
    const n = (notice = doc.createElement("div"));
    n.className = "blocks-error-notice";
    n.setAttribute("role", "alert");
    const text = `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
    n.append(text + " ");
    const button = (label: string, fn: () => void): HTMLButtonElement => {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    const close = (): void => n.remove();
    const form = doc.createElement("div");
    form.className = "blocks-error-report";
    form.setAttribute("role", "group");
    form.setAttribute("aria-label", "Report this problem");
    form.hidden = true;
    const area = doc.createElement("textarea");
    area.readOnly = true;
    area.rows = 12;
    area.setAttribute("aria-label", "The report");
    const status = doc.createElement("span");
    status.setAttribute("role", "status");
    form.append(area);
    form.append(
      button("Copy", () => {
        area.select();
        const clip = parent.ownerDocument.defaultView?.navigator?.clipboard;
        const done = (m: string): void => {
          status.textContent = m;
        };
        if (clip?.writeText)
          clip.writeText(area.value).then(
            () => done("Copied"),
            () => done("Select the text and copy it")
          );
        else done("Select the text and copy it");
      })
    );
    if (options.onReport) {
      form.append(
        button("Send", () => {
          const r = errorReport();
          if (!r) return;
          try {
            options.onReport?.(r);
          } catch (e) {
            // (kept open: the person can copy it instead)
            status.textContent = `The report was not sent: ${e instanceof Error ? e.message : String(e)}`;
            return;
          }
          say("Report sent");
          close();
        })
      );
    }
    form.append(button("Close", close), status);
    n.append(
      button("Report this problem", () => {
        // (the report is made when the form opens: it holds the document and the log as they are then)
        area.value = reportText(errorReport() ?? ({} as ErrorReport));
        form.hidden = false;
        area.focus();
      }),
      button("Dismiss", close),
      form
    );
    parent.appendChild(n);
    say(text);
  }
  // errors nobody caught, soon after the editor was used (the old editor's watcher); not swallowed
  let stopWatching: (() => void) | null = null;
  const win = parent.ownerDocument.defaultView;
  if (win && options.watchUncaughtErrors !== false)
    stopWatching = watchUncaught(
      win,
      () => !gone && Date.now() - recorder.lastAt() < RECENT_MS,
      (e, source) => reportError(e, source)
    );

  const done: string[] = [];
  const undone: string[] = [];
  /** the words of an edit, as the old editor says them: "inserted x", "changed x", "deleted x" (one for each change, joined by "and") */
  function describeChange(t: Transaction, before: EditorState): string {
    const out: string[] = [];
    const short = (x: string): string => {
      const w = x.replace(/\s+/g, " ").replace(/^[,;\s]+|[,;\s]+$/g, "");
      return w.length > 40 ? w.slice(0, 39) + "..." : w;
    };
    t.changes.iterChanges((fa, ta, _fb, _tb, ins) => {
      const gone = before.doc.sliceString(fa, ta);
      const put = ins.toString();
      if (!short(put)) out.push(`deleted ${short(gone)}`);
      else out.push(`${short(gone) ? "changed" : "inserted"} ${short(put)}`);
    });
    return out.slice(0, 3).join(" and ");
  }
  /** what a node is, for counting: the table's label of its row (an unparsed piece is "unparsed text"; a kind with no row is its own name) */
  const kindOf = (n: BNode): Kind => {
    const row = table.nodes[keyOfNode(n) ?? ""];
    return {
      type: keyOfNode(n) ?? n.kind,
      label: n.kind === "error" ? "unparsed text" : (row?.label ?? n.kind),
      orphan: n.kind === "comment",
    };
  };
  /** "At the top level, this program contains 2 definitions and 1 call.", or null when there is nothing but comments; the comments never count */
  const programSummary = (): string | null =>
    summarizeProgram(rootsSlot.nodes.map(kindOf));
  /** the first time the program is drawn as blocks: say it (once: after that the person knows their way around) */
  let summarized = false;
  function summarize(): void {
    if (summarized) return;
    const s = programSummary();
    if (!s) return;
    summarized = true;
    say(s);
  }

  /* ---- the mode */

  /** why the text cannot be drawn as blocks: the first parse error, in the parser's words; null when the whole text parses */
  function modeProblem(): string | null {
    const st = view.state.field(field);
    const text = view.state.doc.toString();
    const bad = errorsIn(st.roots, 0, text.length);
    if (bad.length) return explainError(options.table, text, bad[0]);
    if (st.errs.length) {
      const [from, to] = st.errs[0];
      return to >= text.trimEnd().length
        ? END_MESSAGE
        : `Unexpected text at ${place(text, from)}`;
    }
    return null;
  }
  /** forget the undo and redo history: the history extension is dropped and put back, which makes its field new */
  function clearHistory(): void {
    if (gone) return;
    view.dispatch({ effects: historyComp.reconfigure([]) });
    view.dispatch({ effects: historyComp.reconfigure(history()) });
    histUndo.length = 0;
    histRedo.length = 0;
    histPending = null;
  }
  const focusedBlock = (): BNode | null => {
    const active = view.dom.ownerDocument.activeElement;
    if (!active || !view.contentDOM.contains(active)) return null;
    return renderer.nodeOf(active);
  };
  function switchMode(on: boolean): string | null {
    if (blockMode === on) return null;
    if (gone) return null;
    if (on) {
      const why = modeProblem();
      if (why) return why;
    }
    // (what must survive the switch: the block that has the focus, where the text is scrolled to)
    const had = focusedBlock();
    const inEditor = view.contentDOM.contains(
      view.contentDOM.ownerDocument.activeElement
    );
    const editedAsText = !on
      ? false
      : !!textAtEntry && !textAtEntry.eq(view.state.doc);
    textAtEntry = on ? null : view.state.doc;
    blockMode = on;
    done.length = 0;
    undone.length = 0;
    view.dispatch({
      effects: [
        view.scrollSnapshot(),
        compartment.reconfigure(on ? blockExtension : []),
      ],
      // (a block that had the focus: the text cursor goes to its start)
      selection: !on && had ? EditorSelection.cursor(had.from) : undefined,
    });
    if (on && editedAsText) clearHistory();
    // (the mode changes the lines' heights; a measure that follows without an update that says so leaves the gutter on the old ones)
    gutterRepairs = 0;
    remeasureHeights();
    checkGutterLater();
    // (edits made as text may have brought a comment next to a block that stayed drawn)
    if (on) renderer.refreshComments(true);
    if (inEditor && !on) view.focus();
    sayLater(`${on ? "Block" : "Text"} Mode Enabled`, 500);
    if (on) summarize();
    for (const fn of [...modeListeners]) fn(blockMode ? "blocks" : "text");
    return null;
  }

  // (the members of the view are added by `forwardView`, once the view exists)
  const ed: Omit<LezerBlockEditor, keyof ViewSurface> = {
    get view() {
      return view;
    },
    doc,
    language,
    renderer,
    options,
    reconfigure: (extensions) =>
      view.dispatch({ effects: userComp.reconfigure(extensions) }),
    lastError: null,
    roots: () => rootsSlot.nodes,
    insertText(slot, index, snippet) {
      live(slot.owner);
      dispatch(ownLineChange(slot, index, snippet));
    },
    insertAt(at, snippet) {
      const c = topLevelChange(at, snippet);
      const off = c.insert.indexOf(snippet);
      dispatch(c);
      const from = c.from + Math.max(off, 0);
      return { from, to: from + snippet.length };
    },
    refuseAt(at, snippet) {
      try {
        return refusal(language, currentText(), topLevelChange(at, snippet));
      } catch {
        return null;
      }
    },
    topLevelInput: null,
    flushTopLevel() {
      const q = held;
      held = null;
      q?.();
    },
    pendingHost(pos) {
      const el = view.dom.ownerDocument.createElement("span");
      el.className = "blocks-pending";
      view.dispatch({ effects: setPending.of({ pos, el }) });
      return el;
    },
    // (the pending field is a part of the block extension: in text mode it is not in the state, and a box that the switch removed is closing)
    clearPending() {
      // (the box is taken out of the page by an update that has just removed its widget; Chromium sends its blur while the update is
      // still going on, and CodeMirror does not take a dispatch then: it is made when the update is over)
      if ((view as unknown as { updateState: number }).updateState !== 0) {
        queueMicrotask(() => {
          if (!gone) ed.clearPending();
        });
        return;
      }
      if ((view.state.field(pendingField, false)?.size ?? 0) > 0)
        view.dispatch({ effects: setPending.of(null) });
    },
    pendingAt() {
      const it = view.state.field(pendingField, false)?.iter();
      return it?.value ? it.from : null;
    },
    refuseInsert(slot, index, snippet) {
      try {
        live(slot.owner);
        return refusal(
          language,
          currentText(),
          changeFor(slot, index, snippet)
        );
      } catch {
        return null; // (the edit itself reports what is wrong)
      }
    },
    refusePaste(anchor, texts, before, over) {
      let got = null as TextChange | null;
      dry = (c) => (got = c);
      try {
        if (over) ed.replaceWithTexts(anchor, texts);
        else ed.pasteTexts(anchor, texts, before);
      } catch (e) {
        if (e !== DRY) throw e;
      } finally {
        dry = null;
      }
      return got ? refusal(language, currentText(), got) : null;
    },
    refuseReplace(node, snippet) {
      try {
        live(node);
        return refusal(language, currentText(), replaceChange(node, snippet));
      } catch {
        return null;
      }
    },
    templates: () =>
      Object.entries(table.templates ?? {}).map(([name, t]) => ({
        name,
        kind: t.kind,
        stmt: !!t.stmt,
      })),
    insertTemplate(name, anchor) {
      const t = table.templates?.[name];
      if (!t) throw new Error(`no template ${name}`);
      if (anchor) live(anchor);
      const takes = (sl: Slot) =>
        sl.kind === "list" &&
        !sl.pieces &&
        (!t.stmt ||
          !table.statementSlots ||
          table.statementSlots.includes(sl.name));
      let slot = rootsSlot;
      let ref: BNode | null =
        rootsSlot.nodes[rootsSlot.nodes.length - 1] ?? null;
      let index = rootsSlot.nodes.length;
      for (let n: BNode | null = anchor ?? null; n; n = n.parent) {
        if (n.slot && takes(n.slot)) {
          slot = n.slot;
          ref = n;
          index = n.slot.nodes.indexOf(n) + 1;
          break;
        }
      }
      const text = currentText();
      const indent = ref
        ? (
            text
              .slice(text.lastIndexOf("\n", ref.from - 1) + 1, ref.from)
              .match(/^[ \t]*/) as RegExpMatchArray
          )[0]
        : "";
      const f = fillTemplate(table, name, indent);
      const asStatement =
        !t.stmt && !!table.statementSlots?.includes(slot.name);
      const snippet =
        f.text + (asStatement ? (table.statementSuffix ?? "") : "");
      const change = changeFor(slot, index, snippet);
      dispatch(change);
      return openHole(change, snippet, f.hole);
    },
    insertTemplateAt(name, target) {
      const t = table.templates?.[name];
      if (!t) throw new Error(`no template ${name}`);
      let change: TextChange;
      let snippet: string;
      let hole: number;
      if ("at" in target) {
        const f = fillTemplate(table, name, "");
        snippet = f.text;
        hole = f.hole;
        change = atChange(target.at, snippet);
      } else if ("blank" in target) {
        live(target.blank);
        // (a template replaces a hole or a value (a literal), as in the old editor, where only those are drop targets: not a compound block; a statement goes only where statements do)
        if (
          !isBlank(target.blank) &&
          (target.blank.slots.length > 0 || target.blank.kind === "comment")
        )
          throw new Error("a template replaces only a value or a hole");
        if (
          !isBlank(target.blank) &&
          t.stmt &&
          table.statementSlots &&
          !(
            target.blank.slot &&
            table.statementSlots.includes(target.blank.slot.name)
          )
        )
          throw new Error("a statement does not go there");
        const f = fillTemplate(table, name, indentAt(target.blank.from));
        snippet = f.text;
        hole = f.hole;
        change = replaceChange(target.blank, snippet);
      } else {
        const { slot, index } = target;
        live(slot.owner);
        if (slot.pieces)
          throw new Error(
            `nothing can be inserted into the ${slot.name} of a ${slot.owner.kind}`
          );
        if (slot.kind !== "list")
          throw new Error("a block goes into a list, or onto a hole");
        if (
          t.stmt &&
          table.statementSlots &&
          !table.statementSlots.includes(slot.name)
        )
          throw new Error("a statement does not go there");
        const ref = slot.nodes[Math.min(index, slot.nodes.length - 1)] ?? null;
        const f = fillTemplate(table, name, ref ? indentAt(ref.from) : "");
        const asStatement =
          !t.stmt && !!table.statementSlots?.includes(slot.name);
        snippet = f.text + (asStatement ? (table.statementSuffix ?? "") : "");
        hole = f.hole;
        change = changeFor(slot, index, snippet);
      }
      dispatch(change);
      return openHole(change, snippet, hole);
    },
    isWhitespaceAt,
    beginTemplateDrag: (e, name) => interaction.beginTemplateDrag(e, name),
    edit: (node, typed) => interaction.edit(node, typed),
    lastFocused: () =>
      lastNode && doc.byId.get(lastNode.id) === lastNode ? lastNode : null,
    focusEditor() {
      const n =
        ed.lastFocused() ??
        rootsSlot.nodes.find((r) => r.kind !== "error") ??
        null;
      if (n) ed.focusNode(n);
    },
    removeNode(node) {
      ed.removeNodes([node]);
    },
    removeNodes(nodes, withComments = false) {
      if (!nodes.length) return;
      for (const n of nodes) {
        live(n);
        if (!n.slot) throw new Error("not removable");
      }
      if (withComments) {
        // (cut takes the comment that goes with a block; delete leaves it, as the old editor does)
        const more = nodes
          .flatMap((n) => commentsOf(n))
          .filter((c) => !nodes.includes(c));
        nodes = [...nodes, ...new Set(more)];
      }
      const sorted = [...nodes].sort((x, y) => x.from - y.from || x.to - y.to);
      const node = sorted.find((n) => n.slot) as BNode;
      // where focus should go afterwards, if it is on a node (or inside one): the node now at the place of the first
      const f = blockMode ? ed.focusedNode() : null; // (in text mode no block has the focus; the reader throws)
      let inside = false;
      for (let c: BNode | null = f; c; c = c.parent)
        if (sorted.includes(c)) inside = true;
      const place = placeOf(node);
      const t = currentText();
      const inList = (n: BNode): boolean =>
        !!n.slot && n.slot.kind !== "one" && !n.slot.pieces;
      const cs: TextChange[] = [
        ...sorted
          .filter((n) => !inList(n))
          .map((n): TextChange =>
            !n.slot
              ? strayRemoval(n)
              : { from: n.from, to: n.to, insert: table.blank ?? "..." }
          ),
        ...removeChanges(sorted.filter(inList), t),
      ];
      holdFocus = inside;
      // (the old editor beeps when a delete leaves a hole where a block has to be)
      const leaves = sorted.some(
        (n) => n.slot && (n.slot.kind === "one" || n.slot.pieces)
      );
      try {
        dispatchAll(mergeChanges(cs));
        if (leaves) ed.sound("beep", "left-blank");
      } finally {
        holdFocus = false;
      }
      if (!inside) return;
      const target = nearestDrawn(resolvePlace(place).node);
      if (target && target.kind !== "program") ed.focusNode(target);
    },
    get search() {
      return interaction.search;
    },
    act: (action, target, detail, fn, skip) =>
      recorder.act(
        action,
        target ? { kind: target.kind, from: target.from, to: target.to } : null,
        detail,
        fn,
        skip
      ),
    activityLog: () => recorder.entries(),
    clearActivityLog: () => recorder.clear(view.state.doc.toString()),
    exportActivity: () => recorder.export(),
    said,
    say,
    summarizeProgram: programSummary,
    describeKinds: (nodes) => describeKinds(nodes.map(kindOf)),
    sayProgramSummary() {
      const s = programSummary();
      if (s) say(s);
      return !!s;
    },
    readAncestors(node) {
      const parts = [ed.language.describe(node)];
      for (let p = node.parent; p && p.kind !== "program"; p = p.parent)
        parts.push(ed.language.describe(p) + ", at level " + levelOf(p));
      return parts.length > 1 ? parts.join(", inside ") : null;
    },
    readChildren(node) {
      const c = node.slots
        .flatMap((s) => s.nodes)
        .filter((k) => k.kind !== "comment")
        .map((k) => ed.language.describe(k));
      return c.length ? c.join(", ") : "no children";
    },
    summarizeBlock: (node) =>
      `${ed.language.describe(node)}, at level ${levelOf(node)}`,
    reportError,
    errorReport,
    sound(name, event) {
      if (soundOn) (options.playSound ?? defaultPlayer)(name, event); // (the option is read each time: a page may set it later)
    },
    setSounds(on) {
      soundOn = on;
    },
    soundsOn: () => soundOn,
    selection: () => sortedNodes(renderer.selected()),
    selectedBlocks() {
      const sel = new Set(renderer.selected());
      return sortedNodes(
        [...sel].filter((n) => {
          for (let p = n.parent; p; p = p.parent) if (sel.has(p)) return false;
          return true;
        })
      );
    },
    toggleSelect(node) {
      live(node);
      const sel = renderer.selected();
      const inside = (n: BNode, anc: BNode): boolean => {
        for (let p: BNode | null = n; p; p = p.parent)
          if (p === anc) return true;
        return false;
      };
      const all = (n: BNode): BNode[] => {
        const o: BNode[] = [];
        walk(n, (m) => o.push(m));
        return o.filter((m) => m.kind !== "error");
      };
      if (renderer.isSelected(node)) {
        // unselect it, what is inside it, and its ancestors
        for (const m of all(node)) renderer.setSelected(m, false);
        for (let p = node.parent; p; p = p.parent)
          renderer.setSelected(p, false);
        return "unselected";
      }
      if (sel.some((m) => inside(node, m))) {
        say("This node already has a selected ancestor");
        return "refused";
      }
      for (const m of sel) if (inside(m, node)) renderer.setSelected(m, false);
      for (const m of all(node)) renderer.setSelected(m, true);
      return "selected";
    },
    commentOf: (n) => commentOf(n),
    isAttachedComment: (n) => isAttached(n),
    remeasureHeights,
    commentHost(n) {
      if (commentOf(n)) return n; // (a block that has a comment already is where it is edited, wherever it stands on its line)
      let c = n;
      for (;;) {
        while (
          c.parent &&
          c.parent.kind !== "program" &&
          c.parent.from === c.from
        )
          c = c.parent;
        const lineStart = curDoc.lastIndexOf("\n", c.from - 1) + 1;
        if (
          /^[ \t]*$/.test(curDoc.slice(lineStart, c.from)) ||
          !c.parent ||
          c.parent.kind === "program"
        )
          return c;
        c = c.parent;
      }
    },
    setComment(node, words) {
      live(node);
      // (a comment block is its own comment: the shortcut edits it, and emptying the box removes it)
      const host = node.kind === "comment" ? node : ed.commentHost(node);
      const c = node.kind === "comment" ? node : commentOf(host);
      const t = words.replace(/\s+/g, " ").trim();
      const prefix = table.lineComment ?? "#";
      if (c) {
        if (!t) {
          if (c.slot) ed.removeNode(c);
          else dispatch(strayRemoval(c));
          return;
        }
        const raw = curDoc.slice(c.from, c.to);
        const block = raw.startsWith(prefix)
          ? null
          : [raw.slice(0, 2), raw.slice(-2)];
        const next = block ? `${block[0]} ${t} ${block[1]}` : `${prefix} ${t}`;
        if (next !== raw) dispatch({ from: c.from, to: c.to, insert: next });
        return;
      }
      if (!t) return;
      const lineStart = curDoc.lastIndexOf("\n", host.from - 1) + 1;
      const indent = (
        curDoc.slice(lineStart, host.from).match(/^[ \t]*/) as RegExpMatchArray
      )[0];
      dispatch({
        from: host.from,
        to: host.from,
        insert: `${prefix} ${t}\n${indent}`,
      });
    },
    collapse(node, on) {
      if (!foldable(node)) return;
      renderer.setCollapsed(node, on);
      remeasureHeights();
      // focus inside what is now hidden goes to the block that holds it
      const f = blockMode ? ed.focusedNode() : null; // (in text mode no block has the focus; the reader throws)
      if (on && f && f !== node)
        for (let c = f.parent; c; c = c.parent)
          if (c === node) ed.focusNode(node);
    },
    collapseAll(on) {
      for (const r of rootsSlot.nodes) ed.collapseRoot(r, on);
    },
    collapseRoot(root, on) {
      walk(root, (n) => {
        if (foldable(n)) renderer.setCollapsed(n, on);
      });
      remeasureHeights();
      const f = blockMode ? ed.focusedNode() : null; // (in text mode no block has the focus; the reader throws)
      if (on && f) ed.focusNode(root);
    },
    clearSelection() {
      for (const m of renderer.selected()) renderer.setSelected(m, false);
    },
    // (a comment that is listed with its block is in the block's text already)
    copyTexts: (nodes) =>
      nodes
        .filter(
          (n) =>
            !(
              n.kind === "comment" &&
              nodes.some((m) => m !== n && ownerOf(n) === m)
            )
        )
        .map((n) => ed.copyText(n, true)),
    pasteTexts(anchor, texts, before) {
      if (texts.length === 1) return ed.pasteText(anchor, texts[0], before);
      if (anchor) live(anchor);
      if (anchor && isBlank(anchor)) throw new Error("a hole takes one block");
      const where = pasteSpot(anchor, before);
      if (!where) throw new Error("no place for it beside this block");
      const joined = texts
        .map((x) => x.replace(/\n/g, "\n" + where.indent))
        .join(separatorFor(table, currentText(), where.slot));
      const change =
        anchor && anchor.slot === rootsSlot
          ? rootPasteChange(anchor, !!before, joined)
          : changeFor(where.slot, where.index, joined);
      dispatch(change);
      const found =
        lastBlockIn(change.from, change.from + change.insert.length) ??
        blockAt(
          change.from + change.insert.indexOf(texts[0].split("\n")[0]),
          texts[0].length
        );
      if (found) ed.focusNode(found);
      return found;
    },
    replaceWithTexts(node, texts) {
      live(node);
      const slot = node.slot;
      if (!slot || node.kind === "error" || !texts.length)
        throw new Error("nothing to replace");
      if (texts.length > 1 && (slot.kind !== "list" || slot.pieces))
        throw new Error("a place for one block takes one block");
      const c = commentOf(node);
      const from = Math.min(node.from, c ? c.from : node.from);
      const to = Math.max(node.to, c ? c.to : node.to);
      const ind = indentAt(node.from);
      const snippet = texts
        .map((x) => x.replace(/\n/g, "\n" + ind))
        .join(separatorFor(table, currentText(), slot));
      let change: TextChange;
      if (isBlank(node) && !c) change = replaceChange(node, snippet);
      else {
        // (what the old range ended with, a Python statement's newline, stays)
        const tail = (
          view.state.doc.sliceString(from, to).match(/\s*$/) as RegExpMatchArray
        )[0];
        change = { from, to, insert: snippet.replace(/\s+$/, "") + tail };
      }
      dispatch(change);
      let found = blockAt(
        change.from + change.insert.indexOf(texts[0].split("\n")[0]),
        texts[0].length
      );
      if (texts.length > 1)
        found =
          lastBlockIn(change.from, change.from + change.insert.length) ?? found;
      else if (
        found &&
        found.kind === "comment" &&
        found.slot &&
        found.to - found.from < texts[0].length
      )
        found = found.slot.nodes[found.slot.nodes.indexOf(found) + 1] ?? found;
      if (found) ed.focusNode(found);
      return found;
    },
    replaceText(node, snippet) {
      live(node);
      dispatch(replaceChange(node, snippet));
    },
    isBlank,
    copyText(node, withComment = false) {
      live(node);
      const own = dedent(
        view.state.doc.sliceString(node.from, node.to),
        indentAt(node.from)
      ).replace(/\s+$/, "");
      if (!withComment) return own;
      // (the comments go first, trailing ones too, as the old editor copies them)
      return [...commentsOf(node), node]
        .map((c) =>
          c === node
            ? own
            : dedent(
                view.state.doc.sliceString(c.from, c.to),
                indentAt(c.from)
              ).replace(/\s+$/, "")
        )
        .join("\n");
    },
    pasteText(anchor, text, before) {
      if (anchor) live(anchor);
      if (anchor && isBlank(anchor)) {
        const c = replaceChange(
          anchor,
          text.replace(/\n/g, "\n" + indentAt(anchor.from))
        );
        dispatch(c);
        const at = c.from + c.insert.indexOf(text.split("\n")[0]);
        const found =
          lastBlockIn(c.from, c.from + c.insert.length) ??
          blockAt(at, c.insert.length);
        if (found) ed.focusNode(found);
        return found;
      }
      const where = pasteSpot(anchor, before);
      if (!where) throw new Error("no place for it beside this block");
      const snippet = text.replace(/\n/g, "\n" + where.indent);
      const change =
        anchor && anchor.slot === rootsSlot
          ? rootPasteChange(anchor, !!before, snippet)
          : changeFor(where.slot, where.index, snippet);
      dispatch(change);
      let found =
        lastBlockIn(change.from, change.from + change.insert.length) ??
        blockAt(change.from + change.insert.indexOf(snippet), snippet.length);
      // (a block that was copied with its comment: the focus goes to the block, not to the comment line above it)
      if (
        found &&
        found.kind === "comment" &&
        found.slot &&
        found.to - found.from < snippet.length
      )
        found = found.slot.nodes[found.slot.nodes.indexOf(found) + 1] ?? found;
      if (found) ed.focusNode(found);
      return found;
    },
    moveNode(node, target) {
      ed.moveNodes([node], target);
    },
    moveNodes(nodes, target) {
      for (const n of nodes) {
        live(n);
        if (!n.slot) throw new Error("not movable");
      }
      if (!nodes.length) return;
      const sorted = [...nodes].sort((x, y) => x.from - y.from || x.to - y.to);
      const node = sorted[0];
      const dest =
        "at" in target
          ? null
          : "blank" in target
            ? target.blank
            : target.slot.owner;
      if (dest) {
        live(dest);
        for (const n of sorted)
          for (let c: BNode | null = dest; c; c = c.parent)
            if (c === n) throw new Error("a block cannot go inside itself");
      }
      if (sorted.length > 1 && "blank" in target)
        throw new Error("a hole takes one block");
      if (sorted.length === 1) {
        const i = node.slot!.nodes.indexOf(node);
        if (
          "slot" in target &&
          target.slot === node.slot &&
          (target.index === i || target.index === i + 1)
        )
          return; // where it is
        if ("blank" in target && target.blank === node) return;
      }
      const t = currentText();
      // (a comment directly above a block goes with it, as in the old editor; into a gap only)
      const moved = [...sorted];
      if (!("blank" in target))
        for (const n of sorted) {
          for (const c of commentsOf(n))
            if (c.slot && !moved.includes(c)) moved.push(c);
        }
      moved.sort((x, y) => x.from - y.from || x.to - y.to);
      const snippets = moved.map((n) =>
        dedent(t.slice(n.from, n.to), indentAt(n.from)).replace(/\s+$/, "")
      );
      const inList = (n: BNode): boolean =>
        n.slot!.kind !== "one" && !n.slot!.pieces;
      // (the comment after a block on its line goes after it on that line)
      const glue = (i: number): string | null =>
        moved[i + 1] &&
        moved[i + 1].kind === "comment" &&
        ownerOf(moved[i + 1]) === moved[i] &&
        moved[i + 1].from >= moved[i].to &&
        !t.slice(moved[i].to, moved[i + 1].from).includes("\n")
          ? " "
          : null;
      const gone = mergeChanges([
        ...moved
          .filter((n) => !inList(n))
          .map((n): TextChange => ({
            from: n.from,
            to: n.to,
            insert: table.blank ?? "...",
          })),
        ...removeChanges(moved.filter(inList), t),
      ]);
      let put: TextChange;
      if ("at" in target) put = atChange(target.at, snippets.join("\n"));
      else if ("blank" in target)
        put = replaceChange(
          target.blank,
          snippets[0].replace(/\n/g, "\n" + indentAt(target.blank.from))
        );
      else {
        const sl = target.slot;
        const ref =
          sl.nodes[Math.min(target.index, sl.nodes.length - 1)] ?? null;
        const ind = ref ? indentAt(ref.from) : "";
        const sep = separatorFor(table, t, sl);
        // (a comment that goes with the block is written with it: a line comment above a block goes on its line, one after it on its
        // line stays there unless it would swallow what follows, and then it goes on a line of its own above the block: ownLineChange)
        const own = (i: number): boolean =>
          isLineComment(t.slice(moved[i].from, moved[i].to));
        const build = (
          above: Set<number>
        ): { text: string; ends: number[]; firstOwnLine: boolean } => {
          const parts: string[] = [];
          const joins: string[] = [];
          const ownLine: boolean[] = [];
          const partOf: number[] = [];
          for (let i = 0; i < moved.length; i++) {
            const x = snippets[i].replace(/\n/g, "\n" + ind);
            if (above.has(i)) {
              // (the comment, a line break, the indentation, the block it came after)
              const k = parts.length - 1;
              parts[k] = x + "\n" + ind + parts[k];
              ownLine[k] = true;
              partOf[i] = k;
              continue;
            }
            const startsLine =
              own(i) && !!moved[i + 1] && ownerOf(moved[i]) === moved[i + 1];
            const join =
              i === 0
                ? ""
                : glue(i - 1) !== null
                  ? " "
                  : moved[i - 1].kind === "comment" &&
                      ownerOf(moved[i - 1]) === moved[i] &&
                      own(i - 1) &&
                      !sep.includes("\n")
                    ? "\n" + ind
                    : sep;
            // (a comment that starts a line: after another block on its line it would go with that block)
            joins.push(
              startsLine && i > 0 && !join.includes("\n")
                ? join.replace(/[ \t]+$/, "") + "\n" + ind
                : join
            );
            ownLine.push(startsLine);
            parts.push(
              x +
                // (a comment block of its own keeps a blank line after it, or it would go with the block below)
                (moved[i].kind === "comment" &&
                !moved.includes(ownerOf(moved[i]) as BNode) &&
                sep.includes("\n")
                  ? "\n"
                  : "")
            );
            partOf[i] = parts.length - 1;
          }
          let text = "";
          const partEnd: number[] = [];
          parts.forEach((x, k) => {
            text += joins[k] + x;
            partEnd.push(text.length);
          });
          return {
            text,
            ends: partOf.map((k) => partEnd[k]),
            firstOwnLine: !!ownLine[0],
          };
        };
        let above = new Set<number>();
        let r = build(above);
        let c = changeFor(sl, target.index, r.text);
        const swallowed = (): number[] => {
          const off = c.insert.indexOf(r.text);
          const out: number[] = [];
          for (let i = 1; i < moved.length; i++)
            if (
              glue(i - 1) !== null &&
              own(i) &&
              !above.has(i) &&
              off >= 0 &&
              (c.insert.slice(off + r.ends[i]) + t.slice(c.to))
                .split("\n")[0]
                .trim()
            )
              out.push(i);
          return out;
        };
        const bad = swallowed();
        if (bad.length) {
          above = new Set(bad);
          r = build(above);
          c = changeFor(sl, target.index, r.text);
        }
        if (r.firstOwnLine) {
          const at = c.insert.indexOf(r.text);
          const prefix = lineBefore(t.slice(0, c.from) + c.insert.slice(0, at));
          if (prefix.trim()) {
            // (no space is left at the end of the line before the comment)
            let from = c.from;
            if (at === 0) while (/[ \t]/.test(t[from - 1] ?? "")) from--;
            c = {
              ...c,
              from,
              insert:
                c.insert.slice(0, at).replace(/[ \t]+$/, "") +
                "\n" +
                ind +
                c.insert.slice(at),
            };
          }
        }
        put = c;
      }
      for (const g of gone)
        if (put.from > g.from && put.from < g.to)
          throw new Error("cannot move a block there");
      const both = [...gone, put].sort(
        (a, b) => a.from - b.from || a.to - b.to
      );
      for (let i = 1; i < both.length; i++)
        if (both[i - 1].to > both[i].from)
          throw new Error("cannot move a block there");
      // (the new text starts where the inserted text does, shifted by what was cut before it)
      let shift0 = 0;
      for (const g of gone)
        if (g.from < put.from) shift0 += g.insert.length - (g.to - g.from);
      // collapsed blocks inside the moved ones (each with its path down from the moved block) stay collapsed at the new place
      const pathDown = (top: BNode, n: BNode): number[] => {
        const p: number[] = [];
        for (let c: BNode = n; c !== top; c = c.parent as BNode)
          p.unshift(c.parent!.slots.flatMap((q) => q.nodes).indexOf(c));
        return p;
      };
      const folded = moved.map((m) =>
        renderer
          .collapsedNodes()
          .filter((c) => {
            for (let a: BNode | null = c; a; a = a.parent)
              if (a === m) return true;
            return false;
          })
          .map((c) => pathDown(m, c))
      );
      stats.edits++;
      moving = true;
      try {
        view.dispatch({
          changes: both,
          annotations: [isolateHistory.of("full")],
          userEvent: "input.block",
        });
      } finally {
        moving = false;
      }
      if (folded.some((f) => f.length)) {
        let cursor = 0;
        moved.forEach((m, i) => {
          const at =
            put.from +
            shift0 +
            put.insert.indexOf(snippets[i].split("\n")[0], cursor);
          cursor = put.insert.indexOf(snippets[i].split("\n")[0], cursor) + 1;
          const top = blockAt(at, snippets[i].length);
          if (!top) return;
          for (const path of folded[i]) {
            let n: BNode | undefined = top;
            for (const k of path) n = n?.slots.flatMap((q) => q.nodes)[k];
            if (n) renderer.setCollapsed(n, true);
          }
        });
      }
      // focus goes to the last block moved, as in the old editor
      const j = moved.indexOf(sorted[sorted.length - 1]);
      const upTo = j === 0 ? 0 : put.insert.indexOf(snippets[j - 1]) + 1;
      const at =
        put.from +
        shift0 +
        put.insert.indexOf(snippets[j].split("\n")[0], upTo);
      const found = blockAt(at, snippets[j].length);
      if (found) ed.focusNode(found);
    },
    change: dispatch,
    focusNode(node) {
      // (a comment that goes with a block is not a block: the focus goes to the block)
      if (alive(node) && isAttached(node)) node = ownerOf(node) ?? node;
      // (a block that an edit has taken out of the tree, such as the one an edit box was opened at, or a piece of text that did not parse,
      // which is no block: focus goes to the block at its place)
      // (or one inside a collapsed block, which has no place to be focused: the collapsed block that holds it)
      if (!alive(node) || !drawn(node) || hiddenByFold(node)) {
        const near = nearestDrawn(
          alive(node) ? node : resolvePlace(placeOf(node)).node
        );
        if (!near) return;
        node = near;
      }
      if (!isDrawn(node)) return;
      const el = renderer.element(node);
      el.focus();
      if (typeof el.scrollIntoView === "function")
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    focusedNode: focusedBlock,
    isBlockMode: () => blockMode,
    get mode() {
      return blockMode ? "blocks" : "text";
    },
    setMode: (mode) => switchMode(mode === "blocks"),
    setBlockMode(on) {
      switchMode(on);
    },
    modeProblem,
    onModeChange(fn) {
      modeListeners.add(fn);
      return () => modeListeners.delete(fn);
    },
    clearHistory,
    stats: () => ({ ...stats }),
    heightStats: () => ({ ...hstats }),
    destroy() {
      gone = true;
      stopWatching?.();
      notice?.remove();
      if (sayTimer) clearTimeout(sayTimer);
      unqueue();
      region.remove();
      interaction.detach();
      heightWatch?.disconnect();
      sizeWatch?.disconnect();
      resizeWin?.removeEventListener("resize", onResize);
      for (const type of leaveEvents)
        leaveWin.removeEventListener(type, noteLeave, true);
      view.destroy();
    },
  };

  // a line's height can change without a document change (a box opens in a block, the mouse is over a gap that grows, a block takes the focus):
  // CodeMirror's own observer does not see it (the editor box has a fixed height, so the content's size does not change), and the gutter
  // would keep the old heights. Each drawn root is watched.
  let heightWatch: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    heightWatch = new ResizeObserver(() => {
      if (!gone) remeasureHeights();
    });
    renderer.watch = (el) => heightWatch?.observe(el);
    renderer.unwatch = (el) => heightWatch?.unobserve(el);
  }
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        userComp.of(options.extensions ?? []),
        historyComp.of(history()),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        field,
        keepRangesOrdered,
        compartment.of(blockExtension),
        // (the heights are checked in text mode too: the gutter's numbers go stale there the same way)
        EditorView.updateListener.of((u) => {
          if (u.heightChanged || u.viewportChanged || u.geometryChanged)
            checkGutterLater();
        }),
      ],
    }),
    dispatchTransactions(trs, v) {
      for (const t of trs) recorder.transaction(t);
      if (trs.some((t) => t.docChanged)) settleHistoryFocus();
      const snap = trs.some((t) => t.docChanged) ? takeSnapshot() : null;
      const focusBefore = snap && snap.node ? pathOf(snap.node) : null;
      const before = v.state;
      // (a comment that has the focus may come to go with a block, and is then hidden: the focus goes to that block)
      const hadFocus = trs.some((t) => t.docChanged) ? focusedBlock() : null;
      v.update(trs);
      // (a line next to a changed range that CodeMirror estimates again, and whose block did not change size, is not told about by the
      // observer of the roots: its height is read again once the page is laid out)
      if (blockMode && snap) remeasureLater();
      const histTarget = trackHistory(trs, before, focusBefore, v.state);
      if (histPending) queueMicrotask(settleHistoryFocus);
      // what undo and redo say they undid or redid: the words of the edit ("changed 22"), kept in two stacks in step with the history
      if (blockMode)
        for (const t of trs) {
          if (!t.docChanged) continue;
          if (t.isUserEvent("undo")) {
            const d = done.pop();
            if (d !== undefined) undone.push(d);
            say(d ? `UNDID: ${d}` : "UNDID");
          } else if (t.isUserEvent("redo")) {
            const d = undone.pop();
            if (d !== undefined) done.push(d);
            say(d ? `REDID: ${d}` : "REDID");
          } else if (t.isUserEvent("input.block")) {
            done.push(describeChange(t, before));
            undone.length = 0;
          }
        }
      // a selected block that left the tree leaves the selection (the renderer forgets most of them; this is the net under it)
      if (trs.some((t) => t.docChanged))
        for (const n of renderer.selected())
          if (doc.byId.get(n.id) !== n) renderer.setSelected(n, false);
      if (trs.some((t) => t.docChanged)) renderer.refreshComments();
      if (hadFocus && hadFocus.kind === "comment" && alive(hadFocus)) {
        const owner = isAttached(hadFocus) ? ownerOf(hadFocus) : null;
        if (owner && isDrawn(owner)) ed.focusNode(owner);
      }
      carryMarks(snap);
      // blocks that are new inside a selected block are selected with it
      if (trs.some((t) => t.docChanged))
        for (const m of renderer.selected())
          walk(m, (n) => renderer.setSelected(n, true));
      if (!focusFromHistory(histTarget)) restoreFocus(snap, trs);
      keepFocusInEditor(snap);
      // undo and redo scroll to the old selection (the top, for block edits): show what changed instead
      const last = trs.find(
        (t) => t.docChanged && (t.isUserEvent("undo") || t.isUserEvent("redo"))
      );
      if (last) {
        let at = -1;
        last.changes.iterChangedRanges((_a, _b, fromB) => {
          if (at < 0) at = fromB;
        });
        if (at >= 0) {
          v.dispatch({
            effects: EditorView.scrollIntoView(at, { y: "nearest" }),
          });
          if (!focusFromHistory(histTarget)) restoreFocus(snap, trs);
        }
      }
    },
  });
  // (an edit box, such as the pending one of a top-level entry, goes out of the page with a block when the scroll leaves it: its focus is
  // kept in the editor the same way; soak seed 1847)
  const holdsFocus = (t: HTMLElement | null): t is HTMLElement =>
    !!t && (!!renderer.nodeOf(t) || t.classList.contains("blocks-edit"));
  view.dom.addEventListener("focusin", (e) => {
    const t = e.target as HTMLElement | null;
    focusedEl = holdsFocus(t) ? t : null;
    // (a loss that an earlier focusout reported is over: the focus went on to this element, which the update must not forget. Soak seed 3504867:
    // a box closed by Escape reports its loss, the block takes the focus, and the update that reads the report then wiped the block it had just seen)
    lostBlockFocus = false;
  });
  view.dom.addEventListener("focusout", (e) => {
    const t = e.target as HTMLElement | null;
    if (blockMode && !e.relatedTarget && holdsFocus(t)) {
      lostBlockFocus = true;
      recoverFocusLater(t, performance.now() - lastLeaveGesture < 400);
    }
    if (t === focusedEl) focusedEl = null;
  });
  /**
   * A block that has the focus can lose it with no later update to notice: an edit hides it (a collapsed ancestor) or CodeMirror takes it
   * out and puts it back, and WebKit reports it by a `focusout` with nowhere to go (or by none) AFTER the last update, so the focus rests on
   * the page body. One macrotask after such a `focusout`, if the body still has the focus, it goes back to the block (or the nearest
   * enclosing block that is shown, or the editor's text) - unless the user left on purpose: a press outside the editor or a Tab just before.
   */
  let lastLeaveGesture = -1e9;
  const leaveWin = view.dom.ownerDocument;
  const noteLeave = (e: Event): void => {
    if (e.type === "keydown" && (e as KeyboardEvent).key !== "Tab") return;
    if (e.type !== "keydown" && view.dom.contains(e.target as Node)) return;
    lastLeaveGesture = performance.now();
  };
  const leaveEvents = ["keydown", "pointerdown", "mousedown", "touchstart"];
  for (const type of leaveEvents)
    leaveWin.addEventListener(type, noteLeave, true);
  function recoverFocusLater(t: HTMLElement, userLeft: boolean): void {
    if (userLeft) return;
    setTimeout(() => {
      if (gone || !blockMode || holdFocus) return;
      const d = view.dom.ownerDocument;
      const a = d.activeElement;
      if (a && a !== d.body && a !== d.documentElement && a.isConnected) return;
      for (
        let el: HTMLElement | null = t;
        el && el !== view.contentDOM;
        el = el.parentElement
      ) {
        if (!el.isConnected || !holdsFocus(el) || !el.getClientRects().length)
          continue;
        el.focus({ preventScroll: true });
        if (d.activeElement === el) return;
      }
      view.contentDOM.focus({ preventScroll: true });
    }, 0);
  }
  injectSheets(view.dom, table);
  // the end of a press or a drag lays the blocks out again (the gap under the mouse goes) after CodeMirror's last measure of the drag, and a
  // size that went down and up again between two frames is reported by no observer: the heights are compared with the lines once it is over
  for (const type of ["pointerup", "pointercancel", "mouseup", "touchend"])
    view.dom.addEventListener(
      type,
      () => {
        gutterRepairs = 0;
        checkGutterLater();
      },
      true
    );
  // a window resize or a page zoom wraps lines differently (a wrapped line gets taller or shorter) without any editor update: the heights
  // are read again and compared with the page, with a second look after the browser has settled
  const onResize = (): void => {
    if (gone) return;
    gutterRepairs = 0;
    remeasureHeights(true);
    checkGutterLater();
    retryCheckLater(true);
  };
  const resizeWin = view.dom.ownerDocument.defaultView;
  resizeWin?.addEventListener("resize", onResize);
  let sizeWatch: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    let lastWidth = -1;
    sizeWatch = new ResizeObserver(() => {
      const w = view.dom.clientWidth;
      if (w === lastWidth) return;
      const first = lastWidth < 0;
      lastWidth = w;
      if (!first) onResize();
    });
    sizeWatch.observe(view.dom);
  }

  // the next key or touch of the pointer settles which block an edit left focused (a redo goes back to it)
  for (const type of ["keydown", "pointerdown", "mousedown", "touchstart"])
    view.dom.addEventListener(type, settleHistoryFocus, true);
  // the API entry points that change something are logged as actions of their own when called by a page or a test (inside a key or a mouse
  // handler they are part of that action)
  const named = <K extends keyof LezerBlockEditor>(
    name: K,
    action: (...a: never[]) => string,
    target: (...a: never[]) => BNode | null,
    detail?: (...a: never[]) => Record<string, unknown> | undefined
  ): void => {
    const orig = (ed[name] as unknown as (...a: unknown[]) => unknown).bind(ed);
    (ed as unknown as Record<string, unknown>)[name] = (...a: unknown[]) =>
      ed.act(
        (action as (...x: unknown[]) => string)(...a),
        (target as (...x: unknown[]) => BNode | null)(...a),
        detail &&
          (detail as (...x: unknown[]) => Record<string, unknown> | undefined)(
            ...a
          ),
        () => orig(...a)
      );
  };
  named(
    "insertTemplate",
    () => "template",
    ((_n: string, anchor?: BNode | null) => anchor ?? null) as never,
    ((n: string) => ({ name: n })) as never
  );
  named(
    "insertTemplateAt",
    () => "templateAt",
    ((
      _n: string,
      t: { slot: Slot; index: number } | { blank: BNode } | { at: number }
    ) => ("at" in t ? null : "blank" in t ? t.blank : t.slot.owner)) as never,
    ((n: string) => ({ name: n })) as never
  );
  named(
    "setBlockMode",
    () => "mode",
    () => null,
    ((on: boolean) => ({ blocks: on })) as never
  );
  named(
    "setMode",
    () => "mode",
    () => null,
    ((mode: string) => ({ blocks: mode === "blocks" })) as never
  );
  named(
    "collapse",
    ((_n: BNode, on: boolean) => (on ? "collapse" : "expand")) as never,
    ((n: BNode) => n) as never
  );
  named(
    "collapseAll",
    ((on: boolean) => (on ? "collapseAll" : "expandAll")) as never,
    () => null
  );
  named(
    "collapseRoot",
    ((_n: BNode, on: boolean) => (on ? "collapseRoot" : "expandRoot")) as never,
    ((n: BNode) => n) as never
  );
  named("toggleSelect", () => "toggleSelect", ((n: BNode) => n) as never);
  named(
    "clearSelection",
    () => "clearSelection",
    () => null
  );
  named("insertText", () => "insertText", ((s: Slot) => s.owner) as never);
  named("removeNode", () => "removeNodes", ((n: BNode) => n) as never);
  named(
    "removeNodes",
    () => "removeNodes",
    ((n: BNode[]) => n[0] ?? null) as never
  );
  named("replaceText", () => "replaceText", ((n: BNode) => n) as never);
  named("pasteText", () => "pasteText", ((n: BNode | null) => n) as never);
  named("pasteTexts", () => "pasteTexts", ((n: BNode | null) => n) as never);
  named(
    "replaceWithTexts",
    () => "replaceWithTexts",
    ((n: BNode) => n) as never
  );
  named(
    "moveNodes",
    () => "moveNodes",
    ((n: BNode[]) => n[0] ?? null) as never
  );
  named("moveNode", () => "moveNodes", ((n: BNode) => n) as never);
  named("setComment", () => "setComment", ((n: BNode) => n) as never);
  const unguarded: Record<string, () => unknown> = {};
  // the methods that only make sense with blocks showing throw in text mode (the old editor's rule)
  for (const name of [
    "roots",
    "focusedNode",
    "selection",
    "selectedBlocks",
  ] as const) {
    const orig = ed[name] as () => unknown;
    unguarded[name] = orig;
    (ed as unknown as Record<string, () => unknown>)[name] = () => {
      if (!blockMode)
        throw new Error(`${name}() is only available in block mode`);
      return orig();
    };
  }
  const whole = forwardView(ed, () => view) as LezerBlockEditor;
  const interaction = attachInteraction(whole);
  // the active block, for assistive technology: the real attribute on the element with role="tree"
  // (cleared when the focus leaves the blocks), and the old editor's misspelling on the scroller
  const setActive = (id: string | null): void => {
    if (id) view.contentDOM.setAttribute("aria-activedescendant", id);
    else view.contentDOM.removeAttribute("aria-activedescendant");
    // COMPATIBILITY SHIM: `aria-activedescendent` (sic) is not an ARIA attribute and a screen reader ignores it;
    // the old editor writes it on CodeMirror's scroller and its tests read it back. Kept in step with the real one.
    if (id) view.scrollDOM.setAttribute("aria-activedescendent", id);
    else view.scrollDOM.removeAttribute("aria-activedescendent");
  };
  view.dom.addEventListener("focusout", (e) => {
    const to = (e as FocusEvent).relatedTarget as Element | null;
    if (!to || !renderer.nodeOf(to) || !view.contentDOM.contains(to))
      setActive(null);
    placed?.classList.remove("blocks-comment-above");
    placed = null;
  });
  /**
   * The popup with a block's comment hangs from the top of the block; where that would put it below the bottom of the editor it is held at
   * the block's bottom edge instead and grows upwards (unless that leaves it above the top too). Placed when a block gets focus, and again
   * a frame later and when the editor scrolls.
   */
  let placed: HTMLElement | null = null;
  const placePopup = (): void => {
    const el = view.contentDOM.ownerDocument.activeElement;
    const pop = el?.querySelector?.(
      ":scope > .blocks-comment"
    ) as HTMLElement | null;
    // (the popup that was held at the bottom edge when its block had the focus is let go of when the focus is elsewhere: a block that kept
    // its element through an undo or a drop keeps the class otherwise)
    if (placed && placed !== pop)
      placed.classList.remove("blocks-comment-above");
    placed = pop;
    if (!pop) return;
    pop.classList.remove("blocks-comment-above");
    const room = view.dom.getBoundingClientRect();
    if (pop.getBoundingClientRect().bottom > room.bottom) {
      pop.classList.add("blocks-comment-above");
      if (pop.getBoundingClientRect().top < room.top)
        pop.classList.remove("blocks-comment-above");
    }
  };
  view.scrollDOM.addEventListener("scroll", placePopup);
  view.scrollDOM.addEventListener("scroll", checkDrawnLater);
  view.dom.addEventListener("focusin", (e) => {
    const n = renderer.nodeOf(e.target as Element);
    if (n) lastNode = n;
    const block = (e.target as Element).closest?.(".blocks-node[data-id]");
    setActive(n && block && view.contentDOM.contains(block) ? block.id : null);
    unqueue();
    placePopup();
    requestAnimationFrame(placePopup);
    // the old editor: a block that can be edited in place says so, after a moment, unless something else is said or the focus moves
    if (
      n &&
      blockMode &&
      n.slots.length === 0 &&
      (n.kind === "literal" || n.kind === "blank") &&
      !renderer.isCollapsed(n) &&
      !(e.target as Element).closest(".blocks-edit")
    )
      sayLater("Use enter to edit", 1250);
  });
  summarize();
  if (options.collapseAll) ed.collapseAll(true);
  marks();
  internals.set(whole, { field, blockMode: () => blockMode, unguarded });
  return whole;
}

const internals = new WeakMap<
  LezerBlockEditor,
  {
    field: StateField<LState>;
    blockMode: () => boolean;
    unguarded: Record<string, () => unknown>;
  }
>();

/** the block-only methods without the text-mode check (`roots`, `focusedNode`, `selection`, `selectedBlocks`): for tests and tools that read the tree in either mode */
export function inAnyMode(ed: LezerBlockEditor): {
  roots(): BNode[];
  focusedNode(): BNode | null;
  selection(): BNode[];
  selectedBlocks(): BNode[];
} {
  const u = (internals.get(ed) as { unguarded: Record<string, () => unknown> })
    .unguarded;
  return u as never;
}

/**
 * How often the editor's tree differed from a fresh parse of the same text
 * while the text had Lezer error nodes, and the editor's roots were exactly what
 * its own (incrementally reparsed) Lezer tree gives. Lezer's incremental parse
 * is not guaranteed to recover from errors the way a fresh parse does.
 */
export const divergences = { count: 0 };

/* ------------------------------------------------------------- the checker */

const FIELDS = [
  "kind",
  "from",
  "to",
  "value",
  "dataType",
  "modifier",
  "keyword",
  "keywordTo",
  "brackets",
] as const;

/** where two DOM trees first differ, as a short description (for the checker's message) */
function domDiff(live: Element, fresh: Element, path = ""): string {
  const here = `${path}/${live.className.toString().split(" ").slice(0, 2).join(".")}`;
  const names = new Set([
    ...live.getAttributeNames(),
    ...fresh.getAttributeNames(),
  ]);
  for (const a of names)
    if (live.getAttribute(a) !== fresh.getAttribute(a))
      return `${here} @${a}: live ${live.getAttribute(a)}, fresh ${fresh.getAttribute(a)}`;
  if (live.children.length !== fresh.children.length)
    return `${here}: ${live.children.length} children, fresh ${fresh.children.length}`;
  if (live.children.length === 0 && live.textContent !== fresh.textContent)
    return `${here}: text ${live.textContent}, fresh ${fresh.textContent}`;
  for (let i = 0; i < live.children.length; i++) {
    const d = domDiff(live.children[i], fresh.children[i], `${here}[${i}]`);
    if (d) return d;
  }
  return "";
}

/**
 * The live block tree equals a fresh parse of the text (kinds, slots, values,
 * ranges); links and byId are right; decorations match the roots; the live DOM
 * equals a fresh drawing. Empty is fine.
 */
export function checkLezerEditor(ed: LezerBlockEditor): string[] {
  const problems: string[] = [];
  const say = (m: string) => {
    if (problems.length < 30) problems.push(m);
  };
  const inner = internals.get(ed) as {
    field: StateField<LState>;
    blockMode: () => boolean;
  };
  const state = ed.view.state;
  const text = state.doc.toString();
  const prog = ed.doc.program;
  const roots = prog.slots[0].nodes;
  if (prog.to !== text.length)
    say(`program ends at ${prog.to}, the text has ${text.length}`);

  const refVersion = {};
  const compareLists = (live: BNode[], ref: BNode[], out: string[]): void => {
    const compare = (l: BNode, r: BNode, path: string): void => {
      for (const f of FIELDS) {
        if (l[f] !== r[f])
          return void out.push(
            `${path}: ${f} is ${String(l[f])}, expected ${String(r[f])}`
          );
      }
      if (l.slots.length !== r.slots.length)
        return void out.push(
          `${path}: ${l.slots.length} slots, expected ${r.slots.length}`
        );
      l.slots.forEach((ls, i) => {
        const rs = r.slots[i];
        if (ls.name !== rs.name || ls.kind !== rs.kind)
          return void out.push(`${path}: slot ${i} differs`);
        if (ls.nodes.length !== rs.nodes.length)
          return void out.push(
            `${path}.${ls.name}: ${ls.nodes.length} nodes, expected ${rs.nodes.length}`
          );
        ls.nodes.forEach((c, j) =>
          compare(c, rs.nodes[j], `${path}.${ls.name}[${j}]`)
        );
      });
      // the content hash (cached per document version) is the fresh parse's, for every node
      if (
        out.length === 0 &&
        contentHash(l, state.doc) !== contentHash(r, refVersion)
      )
        out.push(`${path}: content hash differs from a fresh parse's`);
    };
    if (live.length !== ref.length)
      return void out.push(`${live.length} roots, expected ${ref.length}`);
    live.forEach((r, i) => compare(r, ref[i], `roots[${i}]`));
  };
  const freshTree = (ed.options.parser as Parser).parse(text);
  const fresh = ed.language.parse(text);
  const diff: string[] = [];
  compareLists(roots, fresh, diff);
  if (diff.length) {
    const own = state.field(inner.field).tree;
    const mine: string[] = [];
    compareLists(roots, ed.language.fromTree(own, text), mine);
    let errors = false;
    for (const t of [own, freshTree])
      t.iterate({
        enter: (n) => {
          if (n.type.isError) errors = true;
        },
      });
    // (Lezer puts a skipped comment in another node when it reads on from an old tree: inside the statement before it, which ends without a
    // `;`, or as the parent of what follows an unterminated one. Neither tree has an error, and the editor draws what its own tree gives:
    // what is held to the fresh parse is the tree without its comments)
    const plain = (t: Tree): string => {
      let out = "";
      const walkIt = (c: ReturnType<Tree["cursor"]>): void => {
        do {
          const comment = /Comment$/.test(c.name);
          if (!comment) out += c.name;
          if (c.firstChild()) {
            if (!comment) out += "(";
            walkIt(c);
            if (!comment) out += ")";
            c.parent();
          }
          if (!comment) out += ",";
        } while (c.nextSibling());
      };
      walkIt(t.cursor());
      // (a node that held only a comment is no node with children)
      return out.replace(/([^,(]|^)\(\)/g, "$1");
    };
    if (mine.length === 0 && (errors || plain(own) === plain(freshTree)))
      divergences.count++;
    else
      for (const d of mine.length ? mine : diff)
        say(mine.length ? `(not what its own tree gives) ${d}` : d);
  }

  const seen = new Set<BNode>();
  const links = (n: BNode, path: string): void => {
    if (seen.has(n)) return say(`${path}: in the tree twice`);
    seen.add(n);
    if (ed.doc.byId.get(n.id) !== n)
      say(`${path}: byId does not hold node ${n.id}`);
    for (const slot of n.slots) {
      if (slot.owner !== n) say(`${path}.${slot.name}: slot owner wrong`);
      slot.nodes.forEach((c, i) => {
        if (c.parent !== n || c.slot !== slot)
          say(`${path}.${slot.name}[${i}]: parent/slot link wrong`);
        links(c, `${path}.${slot.name}[${i}]`);
      });
    }
  };
  links(prog, "program");
  for (const n of ed.renderer.selected())
    if (ed.doc.byId.get(n.id) !== n)
      say(`node ${n.id} is selected but no longer in the tree`);
  if (ed.doc.byId.size !== seen.size)
    say(`byId holds ${ed.doc.byId.size} nodes, the tree has ${seen.size}`);

  const decos: { from: number; to: number; node: BNode }[] = [];
  state.field(inner.field).decos.between(0, state.doc.length, (from, to, d) => {
    decos.push({ from, to, node: widgetNode(d) });
  });
  for (const d of decos)
    if (!roots.includes(d.node))
      say(`a decoration for node ${d.node.id}, which is not a root`);
  const vp = ed.view.viewport;
  const on = inner.blockMode();
  let freshR: Renderer | null = null;
  for (const r of roots) {
    const mine = decos.filter((d) => d.node === r);
    if (r.kind === "error" || !drawn(r)) {
      if (mine.length) say(`error root ${r.id} has a decoration`);
      continue;
    }
    if (mine.length !== 1) {
      say(`root ${r.id} [${r.from},${r.to}) has ${mine.length} decorations`);
      continue;
    }
    if (mine[0].from !== r.from || mine[0].to !== r.to)
      say(
        `root ${r.id}: decoration [${mine[0].from},${mine[0].to}), node [${r.from},${r.to})`
      );
    if (!ed.renderer.has(r)) {
      if (on && r.from >= vp.from && r.to <= vp.to)
        say(`root ${r.id} is in the viewport and has no element`);
      continue;
    }
    const el = ed.renderer.element(r);
    if (on && r.from >= vp.from && r.to <= vp.to && !el.isConnected)
      say(
        `root ${r.id} is in the viewport and its element is not in the document`
      );
    if (!freshR) {
      freshR = new Renderer(ed.language);
      freshR.attached = ed.renderer.attached;
      freshR.isAttached = ed.renderer.isAttached;
      freshR.adoptSelection(ed.renderer);
    }
    // (an open edit box, or the refusal under it, is in the block's DOM and not in a fresh drawing)
    if (el.querySelector(".blocks-edit")) continue;
    // (the popup of the focused block's comment may be held at the bottom edge: that is where it is, not what is drawn)
    const held = Array.from(el.querySelectorAll(".blocks-comment-above"));
    held.forEach((h) => h.classList.remove("blocks-comment-above"));
    const same = freshR.element(r).isEqualNode(el);
    const why = same ? "" : domDiff(el, freshR.element(r));
    held.forEach((h) => h.classList.add("blocks-comment-above"));
    if (!same)
      say(`root ${r.id}: its DOM is not what a fresh drawing gives (${why})`);
  }
  return problems;
}
