/*
 * Ninth round, step 2c: the thinnest compatibility layer for TESTS ONLY. An object with the shape of the old editor's `API` (what `CodeMirrorBlocks()`
 * and `mountCMB` give) over a `LezerBlockEditor`, and AST nodes (`ASTNode`-shaped) over `BNode`s. Only what the old tests use, in the order of how
 * often they use it (counted in the notes). What is missing is missing on purpose: a test that needs it fails with "not in the compat layer".
 */
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { LezerBlockEditor } from "../../src/lezer-view";
import { contentHash } from "../../src/hash";
import { hasError } from "../../src/lezer";
import type { BNode } from "../../src/types";

export type Pos = { line: number; ch: number };

const defaultCoordsChar = () => ({ line: 0, ch: 0 });
const posOf = (ed: LezerBlockEditor, offset: number): Pos => {
  const l = ed.view.state.doc.lineAt(
    Math.max(0, Math.min(offset, ed.view.state.doc.length))
  );
  return { line: l.number - 1, ch: offset - l.from };
};
const offsetOf = (ed: LezerBlockEditor, p: Pos): number => {
  const d = ed.view.state.doc;
  const l = d.line(Math.max(1, Math.min(p.line + 1, d.lines)));
  return Math.min(l.from + p.ch, l.to);
};

/** What the old tests call an ASTNode (`.id`, `.element`, `.from`, `.to` as {line, ch}, `.type`, `.value`, `.level`, `.children()`, `.parent`) */
export class ASTNode {
  private readonly api!: CompatAPI;
  readonly b!: BNode;
  constructor(api: CompatAPI, b: BNode) {
    // (not enumerable: a failing comparison of two nodes must not print, or serialise, the whole editor)
    Object.defineProperty(this, "api", { value: api, enumerable: false });
    Object.defineProperty(this, "b", { value: b, enumerable: false });
  }
  toJSON() {
    return { id: this.id, type: this.type, value: this.value };
  }
  get id(): string {
    return String(this.b.id);
  }
  /** what the old nodes' `hash` is for tests: equal for equal content (kind, keyword, value, children), whatever the place or the id */
  get hash(): number {
    return contentHash(this.b, this.api.ed.view.state.doc);
  }
  get element(): HTMLElement | null {
    return this.api.ed.renderer.has(this.b)
      ? this.api.ed.renderer.element(this.b)
      : null;
  }
  get from(): Pos {
    return posOf(this.api.ed, this.b.from);
  }
  get to(): Pos {
    return posOf(this.api.ed, this.b.to);
  }
  get type(): string {
    return this.b.kind;
  }
  get value(): string | undefined {
    return this.b.value;
  }
  get level(): number {
    let n = 0;
    for (let p = this.b.parent; p && p.kind !== "program"; p = p.parent) n++;
    return n + 1;
  }
  /** the old nodes' `fields`: each of the table's slots by name (a "one" slot: the node, a list: an array); the old names (`func`, `args`, ...) are the table's for calls */
  get fields(): Record<string, ASTNode | ASTNode[]> {
    const o: Record<string, ASTNode | ASTNode[]> = {};
    for (const s of this.b.slots)
      o[s.name] =
        s.kind === "one"
          ? this.api.wrap(s.nodes[0])
          : s.nodes.map((n) => this.api.wrap(n));
    return o;
  }
  get parent(): ASTNode | null {
    return this.b.parent && this.b.parent.kind !== "program"
      ? this.api.wrap(this.b.parent)
      : null;
  }
  *children(): Generator<ASTNode> {
    for (const s of this.b.slots)
      for (const n of s.nodes) yield this.api.wrap(n);
  }
  toString(): string {
    return this.api.ed.copyText(this.b);
  }
}

export class AST {
  constructor(private readonly api: CompatAPI) {}
  get rootNodes(): ASTNode[] {
    return this.api.ed
      .roots()
      .filter((r) => r.kind !== "error")
      .map((r) => this.api.wrap(r));
  }
  toString(): string {
    return this.rootNodes.map((r) => r.toString()).join("\n");
  }
  getNodeById(id: string): ASTNode | undefined {
    const b = this.api.ed.doc.byId.get(Number(id));
    return b ? this.api.wrap(b) : undefined;
  }
  getNodeByIdOrThrow(id: string): ASTNode {
    const n = this.getNodeById(id);
    if (!n) throw new Error(`no node with id ${id}`);
    return n;
  }
  getAllNodes(): Generator<ASTNode> {
    return this.walk();
  }
  /** every node, parents before children */
  *walk(): Generator<ASTNode> {
    const go = function* (api: CompatAPI, n: BNode): Generator<ASTNode> {
      yield api.wrap(n);
      for (const s of n.slots) for (const c of s.nodes) yield* go(api, c);
    };
    for (const r of this.api.ed.roots())
      if (r.kind !== "error") yield* go(this.api, r);
  }
}

export class CompatAPI {
  private wrapped = new Map<number, ASTNode>();
  private historyBase = 0;
  constructor(readonly ed: LezerBlockEditor) {
    // jsdom has no layout, so the view cannot find a position under a point: a test that mocks the old `coordsChar` of `getCM()` (the drop on whitespace) says where the point is
    ed.view.posAtCoords = ((c: { x: number; y: number }) => {
      const cm = this.getCM();
      if (cm.coordsChar === defaultCoordsChar) return null;
      return offsetOf(ed, cm.coordsChar({ left: c.x, top: c.y }) as Pos);
    }) as typeof ed.view.posAtCoords;
  }
  private cm: ReturnType<CompatAPI["makeCM"]> | null = null;
  wrap(b: BNode): ASTNode {
    let w = this.wrapped.get(b.id);
    if (!w) this.wrapped.set(b.id, (w = new ASTNode(this, b)));
    return w;
  }
  private unwrap(n: ASTNode | BNode): BNode {
    return n instanceof ASTNode ? n.b : n;
  }
  // ---- the text
  getValue(): string {
    return this.ed.view.state.doc.toString();
  }
  setValue(text: string): void {
    this.ed.change({
      from: 0,
      to: this.ed.view.state.doc.length,
      insert: text,
    });
  }
  lastLine(): number {
    return this.ed.view.state.doc.lines - 1;
  }
  getLine(n: number): string {
    return this.ed.view.state.doc.line(n + 1).text;
  }
  replaceRange(text: string, from: Pos, to: Pos = from): void {
    this.ed.change({
      from: offsetOf(this.ed, from),
      to: offsetOf(this.ed, to),
      insert: text,
    });
  }
  // ---- the tree
  getAst(): AST {
    return new AST(this);
  }
  getFocusedNode(): ASTNode | undefined {
    // (the old API answers undefined when nothing is focused)
    const n = this.ed.focusedNode();
    return n ? this.wrap(n) : undefined;
  }
  getSelectedNodes(): ASTNode[] {
    return this.ed.selection().map((n) => this.wrap(n));
  }
  // ---- modes
  setBlockMode(on: boolean): void {
    this.ed.setBlockMode(on);
  }
  getBlockMode(): boolean {
    return true;
  }
  // ---- cursor and selection (the text's)
  setCursor(p: Pos): void {
    const o = offsetOf(this.ed, p);
    this.ed.view.dispatch({ selection: EditorSelection.cursor(o) });
  }
  /**
   * The old API's rule (CodeMirror-api.tsx `getCursor`, run in Chromium in the thirteenth round): while a BLOCK has the DOM focus the answer is the
   * focused block's start (`from`, the default) or end (`"to"`; any other `which` throws); otherwise it is CodeMirror's own cursor. The text cursor
   * itself does not move with the focus (in the old editor, in a real browser, `getCM().getCursor()` stays where it was).
   */
  getCursor(which?: "head" | "anchor" | "from" | "to"): Pos {
    const node = this.ed.focusedNode();
    const el = document.activeElement;
    if (
      node &&
      el &&
      /block-node/.test(el.id) &&
      this.ed.view.dom.contains(el)
    ) {
      if (which === undefined || which === "from")
        return posOf(this.ed, node.from);
      if (which === "to") return posOf(this.ed, node.to);
      throw new Error(
        `getCursor() with ${which} is not supported on a focused block`
      );
    }
    const r = this.ed.view.state.selection.main;
    return posOf(
      this.ed,
      which === "anchor"
        ? r.anchor
        : which === "to"
          ? r.to
          : which === "from"
            ? r.from
            : r.head
    );
  }
  // ---- selections (thirteenth round): the old API's block-aware ranges. A range that is exactly one block SELECTS the block (the editor's own
  // selection by node); any other range must lie between blocks (outside every block, or on a root's edge) and stays a text selection; a range that
  // ends inside a block "partially covers a node" and throws.
  private allNodes(): BNode[] {
    const o: BNode[] = [];
    const go = (n: BNode) => {
      o.push(n);
      for (const s of n.slots) for (const c of s.nodes) go(c);
    };
    for (const r of this.ed.roots()) if (r.kind !== "error") go(r);
    return o;
  }
  private blockAt(a: number, b: number): BNode | undefined {
    return this.allNodes().find(
      (n) => n.from === a && n.to === b && b > a && n.kind !== "comment"
    );
  }
  private validateRange(a: number, b: number): void {
    if (this.blockAt(a, b)) return;
    const roots = this.ed.roots();
    const topLevel = (o: number) =>
      !this.allNodes().some(
        (n) => n.from < o && o < n.to && n.kind !== "program"
      ) || roots.some((r) => r.from === o || r.to === o);
    if (topLevel(a) && topLevel(b)) return;
    const p = (o: number) => posOf(this.ed, o);
    throw new Error(
      `The range {line:${p(a).line}, ch:${p(a).ch}}, {line:${p(b).line}, ch:${p(b).ch}} partially covers a node, which is not allowed`
    );
  }
  setSelections(
    ranges: { anchor: Pos; head?: Pos }[],
    _primary?: number,
    _opts?: unknown
  ): void {
    const rs = ranges.map((r) => {
      const a = offsetOf(this.ed, r.anchor);
      const h = offsetOf(this.ed, r.head ?? r.anchor);
      return { a, h, lo: Math.min(a, h), hi: Math.max(a, h) };
    });
    for (const r of rs) this.validateRange(r.lo, r.hi);
    const nodes: BNode[] = [];
    const text: typeof rs = [];
    for (const r of rs) {
      const n = r.lo !== r.hi ? this.blockAt(r.lo, r.hi) : undefined;
      if (n) nodes.push(n);
      else text.push(r);
    }
    this.ed.clearSelection();
    for (const n of nodes) this.ed.renderer.setSelected(n, true); // (only the node: the old API selects its id alone, not what is inside)
    const sel = text.length
      ? EditorSelection.create(text.map((r) => EditorSelection.range(r.a, r.h)))
      : this.ed.view.state.selection;
    this.ed.view.dispatch({ selection: sel });
  }
  setSelection(anchor: Pos, head: Pos = anchor, opts?: unknown): void {
    this.setSelections([{ anchor, head }], undefined, opts);
  }
  addSelection(anchor: Pos, head: Pos = anchor): void {
    this.setSelections([...this.listSelections(), { anchor, head }]);
  }
  listSelections(): { anchor: Pos; head: Pos }[] {
    const nodes = this.ed.selectedBlocks();
    // (with blocks selected the cursor is not a selection: only text that is really selected stays)
    const text = this.ed.view.state.selection.ranges.filter(
      (r) => !nodes.length || !r.empty
    );
    const all = [
      ...nodes.map((n) => ({
        anchor: posOf(this.ed, n.from),
        head: posOf(this.ed, n.to),
        at: n.from,
      })),
      ...text.map((r) => ({
        anchor: posOf(this.ed, r.anchor),
        head: posOf(this.ed, r.head),
        at: r.from,
      })),
    ].sort((x, y) => x.at - y.at);
    return all.map(({ anchor, head }) => ({ anchor, head }));
  }
  getSelections(sep = "\n"): string[] {
    const d = this.ed.view.state.doc;
    return this.listSelections().map((r) => {
      const a = offsetOf(this.ed, r.anchor);
      const h = offsetOf(this.ed, r.head);
      return d.sliceString(Math.min(a, h), Math.max(a, h), sep);
    });
  }
  getSelection(sep = "\n"): string {
    return this.getSelections(sep).join(sep);
  }
  /** each selected block (and text range) is replaced; the new text must be whole blocks. `around`: the new block is selected; `start`: the cursor goes to its start */
  replaceSelections(texts: string[], select?: "around" | "start"): void {
    const ranges = this.listSelections().map((r) => ({
      a: offsetOf(this.ed, r.anchor),
      h: offsetOf(this.ed, r.head),
    }));
    const lang = this.ed.language;
    texts.forEach((t, i) => {
      if (!ranges[i] || ranges[i].a === ranges[i].h) return;
      const parsed = lang.parse(t);
      if (
        parsed.length === 0 ||
        parsed.some((n) => n.kind === "error" || hasError(n))
      )
        throw new Error(`replaceSelection: "${t}" is not whole blocks`);
    });
    const changes = ranges
      .map((r, i) => ({
        from: Math.min(r.a, r.h),
        to: Math.max(r.a, r.h),
        insert: texts[i] ?? texts[0],
      }))
      .sort((x, y) => x.from - y.from);
    this.ed.clearSelection();
    this.ed.change(changes.length === 1 ? changes[0] : (changes as never));
    const first = changes[0];
    if (first) {
      if (select === "around") {
        const n = this.blockAt(first.from, first.from + first.insert.length);
        if (n) this.ed.renderer.setSelected(n, true);
      } else
        this.ed.view.dispatch({
          selection: EditorSelection.cursor(
            select === "start" ? first.from : first.from + first.insert.length
          ),
        });
    }
  }
  replaceSelection(text: string, select?: "around" | "start"): void {
    this.replaceSelections(
      Array(this.listSelections().length).fill(text),
      select
    );
  }
  somethingSelected(): boolean {
    return (
      this.ed.selection().length > 0 ||
      this.ed.view.state.selection.ranges.some((r) => !r.empty)
    );
  }
  // ---- history (CodeMirror 6's: `clearHistory` can only forget the depth it had, not drop the steps)
  historySize(): { undo: number; redo: number } {
    return {
      undo: Math.max(0, undoDepth(this.ed.view.state) - this.historyBase),
      redo: redoDepth(this.ed.view.state),
    };
  }
  clearHistory(): void {
    this.historyBase = undoDepth(this.ed.view.state);
  }
  undo(): void {
    undo(this.ed.view);
  }
  redo(): void {
    redo(this.ed.view);
  }
  // ---- the page
  focus(): void {
    this.ed.focusEditor();
  }
  hasFocus(): boolean {
    return this.ed.view.dom.contains(document.activeElement);
  }
  getScrollerElement(): HTMLElement {
    return this.ed.view.scrollDOM;
  }
  getWrapperElement(): HTMLElement {
    return this.ed.view.dom;
  }
  getCM() {
    return (this.cm ??= this.makeCM());
  }
  private makeCM() {
    const ed = this.ed;
    return {
      getWrapperElement: () => ed.view.dom,
      getScrollerElement: () => ed.view.scrollDOM,
      getInputField: () => ed.view.contentDOM,
      coordsChar: defaultCoordsChar as (c?: unknown) => {
        line: number;
        ch: number;
      },
      /** CodeMirror's OWN cursor (the one that does not follow block focus) */
      getCursor: (which: "head" | "anchor" | "from" | "to" = "head") => {
        const r = ed.view.state.selection.main;
        return posOf(
          ed,
          which === "anchor"
            ? r.anchor
            : which === "from"
              ? r.from
              : which === "to"
                ? r.to
                : r.head
        );
      },
    };
  }
}

/** the methods the old tests use that this layer does not have, with what they would need (see the notes for how often each is used) */
const MISSING: Record<string, string> = {
  getHistory: "the CM5 history object",
  setHistory: "the CM5 history object",
  markText: "text marks on blocks",
  getLineHandle: "CM5 line handles",
  startOperation: "CM5 operations",
  setSize: "CM5 setSize",
  setGutterMarker: "CM5 gutters",
  setBookmark: "CM5 bookmarks",
  scrollTo: "CM5 scrollTo",
  scrollIntoView: "CM5 scrollIntoView",
  runMode: "CM5 runMode",
};
export function makeAPI(
  ed: LezerBlockEditor
): CompatAPI & Record<string, never> {
  const api = new CompatAPI(ed);
  return new Proxy(api, {
    get(t, k, r) {
      if (typeof k === "string" && !(k in t) && k in MISSING) {
        return () => {
          throw new Error(`not in the compat layer: cmb.${k} (${MISSING[k]})`);
        };
      }
      return Reflect.get(t, k, r);
    },
  }) as never;
}
