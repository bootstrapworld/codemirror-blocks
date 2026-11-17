/*
 * Ninth round, step 2c: the thinnest compatibility layer for TESTS ONLY. An object with the shape of the old editor's `API` (what `CodeMirrorBlocks()`
 * and `mountCMB` give) over a `LezerBlockEditor`, and AST nodes (`ASTNode`-shaped) over `BNode`s. Only what the old tests use, in the order of how
 * often they use it (counted in the notes). What is missing is missing on purpose: a test that needs it fails with "not in the compat layer".
 */
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { LezerBlockEditor } from "../../src/lezer-view";
import type { BNode } from "../../src/types";

export type Pos = { line: number; ch: number };

const posOf = (ed: LezerBlockEditor, offset: number): Pos => {
  const l = ed.view.state.doc.lineAt(Math.max(0, Math.min(offset, ed.view.state.doc.length)));
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
  get element(): HTMLElement | null {
    return this.api.ed.renderer.has(this.b) ? this.api.ed.renderer.element(this.b) : null;
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
    for (const s of this.b.slots) o[s.name] = s.kind === "one" ? this.api.wrap(s.nodes[0]) : s.nodes.map((n) => this.api.wrap(n));
    return o;
  }
  get parent(): ASTNode | null {
    return this.b.parent && this.b.parent.kind !== "program" ? this.api.wrap(this.b.parent) : null;
  }
  *children(): Generator<ASTNode> {
    for (const s of this.b.slots) for (const n of s.nodes) yield this.api.wrap(n);
  }
  toString(): string {
    return this.api.ed.copyText(this.b);
  }
}

export class AST {
  constructor(private readonly api: CompatAPI) {}
  get rootNodes(): ASTNode[] {
    return this.api.ed.roots().filter((r) => r.kind !== "error").map((r) => this.api.wrap(r));
  }
  toString(): string {
    return this.rootNodes.map((r) => r.toString()).join("\n");
  }
  getNodeById(id: string): ASTNode | undefined {
    const b = this.api.ed.doc.byId.get(Number(id));
    return b ? this.api.wrap(b) : undefined;
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
    for (const r of this.api.ed.roots()) if (r.kind !== "error") yield* go(this.api, r);
  }
}

export class CompatAPI {
  private wrapped = new Map<number, ASTNode>();
  private historyBase = 0;
  constructor(readonly ed: LezerBlockEditor) {}
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
    this.ed.change({ from: 0, to: this.ed.view.state.doc.length, insert: text });
  }
  lastLine(): number {
    return this.ed.view.state.doc.lines - 1;
  }
  getLine(n: number): string {
    return this.ed.view.state.doc.line(n + 1).text;
  }
  replaceRange(text: string, from: Pos, to: Pos = from): void {
    this.ed.change({ from: offsetOf(this.ed, from), to: offsetOf(this.ed, to), insert: text });
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
  getCursor(which: "head" | "anchor" | "from" | "to" = "head"): Pos {
    const r = this.ed.view.state.selection.main;
    return posOf(this.ed, which === "anchor" ? r.anchor : which === "from" ? r.from : which === "to" ? r.to : r.head);
  }
  setSelection(anchor: Pos, head: Pos = anchor): void {
    this.ed.view.dispatch({ selection: EditorSelection.range(offsetOf(this.ed, anchor), offsetOf(this.ed, head)) });
  }
  listSelections(): { anchor: Pos; head: Pos }[] {
    return this.ed.view.state.selection.ranges.map((r) => ({ anchor: posOf(this.ed, r.anchor), head: posOf(this.ed, r.head) }));
  }
  somethingSelected(): boolean {
    return this.ed.selection().length > 0 || this.ed.view.state.selection.ranges.some((r) => !r.empty);
  }
  // ---- history (CodeMirror 6's: `clearHistory` can only forget the depth it had, not drop the steps)
  historySize(): { undo: number; redo: number } {
    return { undo: Math.max(0, undoDepth(this.ed.view.state) - this.historyBase), redo: redoDepth(this.ed.view.state) };
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
    const ed = this.ed;
    return {
      getWrapperElement: () => ed.view.dom,
      getScrollerElement: () => ed.view.scrollDOM,
      getInputField: () => ed.view.contentDOM,
      coordsChar: () => ({ line: 0, ch: 0 }),
    };
  }
}

/** the methods the old tests use that this layer does not have, with what they would need (see the notes for how often each is used) */
const MISSING: Record<string, string> = {
  getSelections: "the old API answers with the selected blocks' text",
  setSelections: "several text selections",
  getSelection: "the old API answers with the selected block's text",
  addSelection: "text selections",
  replaceSelection: "replace the selected block",
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
export function makeAPI(ed: LezerBlockEditor): CompatAPI & Record<string, never> {
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
