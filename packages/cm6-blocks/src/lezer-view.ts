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
import type { Parser } from "@lezer/common";
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
  /** how many entries of the activity log are kept (default 200, as the old editor); the oldest are dropped, their changes folded into the log's starting text */
  activityLimit?: number;
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
  /** an error an action of the editor caught: a dismissible notice (role="alert") next to the editor, spoken once while it shows */
  reportError(error: unknown): void;
  /** what was announced, newest last (the last 50) */
  said: string[];
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

const drawn = (n: BNode): boolean => n.kind !== "error";
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
  const remeasureHeights = (): void => {
    (
      view as unknown as { viewState: { mustMeasureContent: unknown } }
    ).viewState.mustMeasureContent = true;
    view.requestMeasure();
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
  renderer.attached = commentOf;
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
      const frags = TreeFragment.applyChanges(v.fragments, cr);
      const tp = performance.now();
      const tree = parser.parse(s, frags);
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
      const noErrs = options.fastErrors !== false && v.errs.length === 0;
      let errs: [number, number][] = [];
      let lastError = -1;
      let lastAffected = -1;
      affected.forEach((k) => (lastAffected = Math.max(lastAffected, k)));
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
        lastError = sameErrors
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
        if (
          !drawn(r) ||
          (tr.changes.mapPos(p.from0, 1) === r.from &&
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
  const blockExtension: Extension = [
    pendingField,
    EditorView.updateListener.of(() => marks()),
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
  /** text was edited while in text mode since the blocks were last shown: the history starts over on the way back (see `setMode`) */
  let editedAsText = false;
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
    renderer.element(n).isConnected;

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
   * screen reader user hears the editor vanish. Every way the last block can go ends here: it is a net under the transaction.
   */
  function keepFocusInEditor(s: Snap | null): void {
    if (!s || (!s.node && s.boxPos === undefined) || gone || !blockMode) return;
    const doc_ = view.dom.ownerDocument;
    const active = doc_.activeElement;
    if (active && active !== doc_.body && view.dom.contains(active)) return;
    if (active && active !== doc_.body && active !== doc_.documentElement)
      return; // (the focus went somewhere on purpose)
    if (rootsSlot.nodes.some((r) => r.kind !== "error")) return;
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
  /** changes sorted, and those that overlap made one (every one must only delete: two blanks cannot be merged) */
  function mergeChanges(cs: TextChange[]): TextChange[] {
    const sorted = [...cs].sort((a, b) => a.from - b.from || a.to - b.to);
    const out: TextChange[] = [];
    for (const c of sorted) {
      const last = out[out.length - 1];
      if (last && c.from < last.to) {
        if (last.insert || c.insert)
          throw new Error(
            "two of the blocks overlap: they cannot be changed together"
          );
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

  let notice: HTMLElement | null = null;
  function reportError(error: unknown): void {
    if (notice?.isConnected) return; // (said once while it is showing)
    const doc = parent.ownerDocument;
    const n = (notice = doc.createElement("div"));
    n.className = "blocks-error-notice";
    n.setAttribute("role", "alert");
    const text = `Something went wrong: ${error instanceof Error ? error.message : String(error)}`;
    n.append(text + " ");
    const b = doc.createElement("button");
    b.textContent = "Dismiss";
    b.addEventListener("click", () => n.remove());
    n.append(b);
    parent.appendChild(n);
    say(text);
  }

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
  /** the first time the program is drawn as blocks: what is at its top level ("At the top level, this program contains 2 definitions and 1 call.") */
  let summarized = false;
  function summarize(): void {
    if (summarized || !rootsSlot.nodes.length) return;
    summarized = true;
    const counts = new Map<string, number>();
    for (const r of rootsSlot.nodes) {
      const label =
        (r.kind === "error"
          ? "unparsed text"
          : table.nodes[keyOfNode(r) ?? ""]?.label) ?? r.kind;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const parts = [...counts].map(
      ([l, n]) =>
        `${n} ${n === 1 ? l : /(s|x|sh|ch)$/.test(l) ? l + "es" : l + "s"}`
    );
    const list =
      parts.length > 2
        ? parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1]
        : parts.join(" and ");
    say(`At the top level, this program contains ${list}.`);
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
    editedAsText = false;
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
      dispatch(changeFor(slot, index, snippet));
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
    clearPending() {
      if (view.state.field(pendingField).size > 0)
        view.dispatch({ effects: setPending.of(null) });
    },
    pendingAt() {
      const it = view.state.field(pendingField).iter();
      return it.value ? it.from : null;
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
      const f = ed.focusedNode();
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
    reportError,
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
      const f = ed.focusedNode();
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
      const f = ed.focusedNode();
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
        put = changeFor(
          sl,
          target.index,
          snippets
            .map(
              (x, i) =>
                x.replace(/\n/g, "\n" + ind) +
                // (a comment block of its own keeps a blank line after it, or it would go with the block below)
                (moved[i].kind === "comment" &&
                !moved.includes(ownerOf(moved[i]) as BNode) &&
                sep.includes("\n")
                  ? "\n"
                  : "")
            )
            .reduce((a, x, i) => a + (glue(i - 1) ?? sep) + x)
        );
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
    destroy() {
      gone = true;
      if (sayTimer) clearTimeout(sayTimer);
      unqueue();
      region.remove();
      interaction.detach();
      view.destroy();
    },
  };

  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        userComp.of(options.extensions ?? []),
        historyComp.of(history()),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        field,
        compartment.of(blockExtension),
      ],
    }),
    dispatchTransactions(trs, v) {
      for (const t of trs) recorder.transaction(t);
      if (trs.some((t) => t.docChanged)) settleHistoryFocus();
      if (!blockMode && trs.some((t) => t.docChanged)) editedAsText = true;
      const snap = trs.some((t) => t.docChanged) ? takeSnapshot() : null;
      const focusBefore = snap && snap.node ? pathOf(snap.node) : null;
      const before = v.state;
      v.update(trs);
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
  injectSheets(view.dom, table);
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
  });
  /**
   * The popup with a block's comment hangs from the top of the block; where that would put it below the bottom of the editor it is held at
   * the block's bottom edge instead and grows upwards (unless that leaves it above the top too). Placed when a block gets focus, and again
   * a frame later and when the editor scrolls.
   */
  const placePopup = (): void => {
    const el = view.contentDOM.ownerDocument.activeElement;
    const pop = el?.querySelector?.(
      ":scope > .blocks-comment"
    ) as HTMLElement | null;
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
    if (mine.length === 0 && errors) divergences.count++;
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
    if (r.kind === "error") {
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
      freshR.adoptSelection(ed.renderer);
    }
    // (an open edit box, or the refusal under it, is in the block's DOM and not in a fresh drawing)
    if (el.querySelector(".blocks-edit")) continue;
    if (!freshR.element(r).isEqualNode(el))
      say(
        `root ${r.id}: its DOM is not what a fresh drawing gives (${domDiff(el, freshR.element(r))})`
      );
  }
  return problems;
}
