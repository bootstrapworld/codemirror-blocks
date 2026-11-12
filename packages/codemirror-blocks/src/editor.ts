import type { ASTNode } from "./ast";
import type { ActionFocus } from "./state/reducers";
import { poscmp } from "./utils";
import { keeperOf } from "./focus";

/**
 * Additional declarations of codemirror apis that are not in @types/codemirror... yet.
 * TODO(pcardune): open a pull request on this file to add these changes:
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/codemirror/index.d.ts
 */
declare module "codemirror" {
  interface DocOrEditor {
    /**
     * Get the currently selected code. Optionally pass a line separator to put between
     * the lines in the output. When multiple selections are present, they are concatenated
     * with instances of lineSep in between.
     */
    getSelection(lineSep?: string): string;

    /**
     * This method can be used to implement search/replace functionality.
     *  `query`: This can be a regular * expression or a string (only strings will match across lines -
     *          if they contain newlines).
     *  `start`: This provides the starting position of the search. It can be a `{line, ch} object,
     *          or can be left off to default to the start of the document
     *  `options`: options is an optional object, which can contain the property `caseFold: false`
     *          to disable case folding when matching a string, or the property `multiline: disable`
     *          to disable multi-line matching for regular expressions (which may help performance)
     */
    getSearchCursor(
      query: string | RegExp,
      start?: CodeMirror.Position,
      options?: { caseFold?: boolean; multiline?: boolean }
    ): SearchCursor;
  }
}

/**
 * Extensions to the codemirror API that are internal to CMB or
 * not documented in the codemirror docs.
 */
declare module "codemirror" {
  /**
   * Get a human readable name for a given keyboard event key.
   *
   * @deprecated This appears in src/edit/legacy.js of the codemirror source, so
   * presumably that means it's deprecated. See
   * https://github.com/codemirror/CodeMirror/blob/49a7fc497c85e5b51801b3f439f4bb126e3f226b/src/edit/legacy.js#L47
   * @param event the keyboard event from which to calculate a human readable name
   */
  function keyName(event: KeyboardEvent | React.KeyboardEvent): string;

  interface DocOrEditor {
    /**
     * Get a (JSON - serializeable) representation of the undo history.
     *
     * @types/codemirror-blocks uses any as the return type. The codemirror docs
     * do not say anything about the return type, but through our own testing,
     * it appears to be the following.
     */
    getHistory(): { done: HistoryItem[]; undone: HistoryItem[] };
  }

  /**
   * The codemirror documentation does not specify the interface of objects
   * used to track edit history. But we monkey patch those objects anyway
   * to keep track of additional information.
   */
  interface HistoryItem {
    /**
     * This is set by codemirror on certain history items but not on others.
     * We only monkey patch the history items that *do not* contain this property.
     */
    ranges?: CodeMirror.Range[];

    /**
     * The below are custom additions we make to certain history items.
     * These are applied in the reducer.
     */
    undoableAction?: string;
    actionFocus?: ActionFocus;
  }

  interface TextMarker {
    /**
     * Specifies the type of text marker, either one made with markText,
     * or one made with setBookmark. Ones made with setBookmark have
     * type == "bookmark". This property is not documented in the codemirror
     * docs.
     */
    type: string;

    /**
     * Specified the options that were used when the marker was created.
     * This property is not documented in the codemirror docs but apparently
     * works.
     */
    options: CodeMirror.TextMarkerOptions;

    /**
     * Whether or not this marker is for a top-level ast node
     */
    isBlockNode?: boolean;
  }
}

export type BlockNodeMarker = {
  clear: () => void;
  changed: () => void;
  /** Where the marker is now, or undefined once CodeMirror has dropped it */
  find: () => CodeMirror.MarkerRange | CodeMirror.Position | undefined;
  isBlockNode: true;
  replacedWith: HTMLElement;
};

export type Pos = {
  line: number;
  ch: number;
};

export interface ReadonlyRangedText {
  getValue(): string;
  getRange(from: Pos, to: Pos): string;
  getLastPos(): Pos;
}

export interface ReadonlyCMBEditor extends ReadonlyRangedText {
  scrollASTNodeIntoView(node: ASTNode): void;
  /** Give the block keyboard focus: the user has moved to it (see focus.ts) */
  focusBlock(node: ASTNode): void;
  /** Something has happened that could have dropped keyboard focus (see focus.ts) */
  checkFocus(): void;

  getTopmostAction(which: "undo" | "redo"): CodeMirror.HistoryItem;

  getAllBlockNodeMarkers(): BlockNodeMarker[];
  getAllTextMarkers(): CodeMirror.TextMarker<CodeMirror.MarkerRange>[];
  getCursor(): Pos;
  getSearchCursor(
    query: string | RegExp,
    start: Pos,
    options: { caseFold: boolean }
  ): CodeMirror.SearchCursor;

  /**
   * Whether or not the editor currently has focus
   */
  hasFocus(): boolean;
  /**
   * Is CodeMirror in the middle of redrawing lines? (Moving their nodes then
   * makes it fail.)
   */
  isRedrawing(): boolean;
}

export interface RangedText extends ReadonlyRangedText {
  setValue(value: string): void;
  replaceRange(
    replacement: string | string[],
    from: Pos,
    to: Pos,
    origin: string | undefined
  ): void;
}

export interface CMBEditor extends ReadonlyCMBEditor, RangedText {
  applyChanges(changes: CodeMirror.EditorChange[]): void;
  focus(): void;
  setCursor(cur: Pos): void;
  undo(): void;
  redo(): void;
  refresh(): void;
  replaceMarkerWidget(from: Pos, to: Pos, widget: HTMLElement): BlockNodeMarker;
}

function isTextMarkerRange(
  marker: CodeMirror.TextMarker<CodeMirror.MarkerRange | Pos>
): marker is CodeMirror.TextMarker<CodeMirror.MarkerRange> {
  return marker.type !== "bookmark";
}

export function isBlockNodeMarker(
  marker: CodeMirror.TextMarker | BlockNodeMarker
): marker is BlockNodeMarker {
  return Boolean(marker.isBlockNode);
}

export class CodeMirrorFacade implements CMBEditor {
  readonly codemirror: CodeMirror.Editor;
  private redrawing = false;
  constructor(codemirror: CodeMirror.Editor) {
    this.codemirror = codemirror;
    // (CodeMirror says a line is redrawn just before it swaps the line in)
    codemirror.on("renderLine", () => {
      this.redrawing = true;
      queueMicrotask(() => (this.redrawing = false));
    });
    codemirror.on("update", () => (this.redrawing = false));
  }

  isRedrawing() {
    return this.redrawing;
  }

  getValue() {
    return this.codemirror.getValue();
  }
  getRange(from: Pos, to: Pos): string {
    return this.codemirror.getRange(from, to);
  }
  getLastPos(): Pos {
    const lastLine = this.codemirror.lastLine();
    return {
      line: lastLine,
      ch: this.codemirror.getLine(lastLine).length,
    };
  }

  getSearchCursor(
    query: string | RegExp,
    start: Pos,
    options: { caseFold: boolean }
  ): CodeMirror.SearchCursor {
    return this.codemirror.getSearchCursor(query, start, options);
  }
  getTopmostAction(which: "undo" | "redo"): CodeMirror.HistoryItem {
    // `getHistory()` hands back *copies* of the change events, so anything we
    // annotate on them would be lost. The doc's own `history` property is
    // undocumented, but it holds the live events that undo/redo operate on.
    const doc = this.codemirror.getDoc() as CodeMirror.Doc & {
      history?: {
        done: CodeMirror.HistoryItem[];
        undone: CodeMirror.HistoryItem[];
      };
    };
    const history = doc.history ?? doc.getHistory();
    const items = which === "undo" ? history.done : history.undone;
    for (let i = items.length - 1; i >= 0; i--) {
      if (!items[i].ranges) {
        return items[i];
      }
    }
    // TODO(pcardune): Make it ok to return "undefined" when there is no
    // topmost action. See https://github.com/bootstrapworld/codemirror-blocks/issues/586.
    return {};
  }
  getAllBlockNodeMarkers(): BlockNodeMarker[] {
    return this.codemirror
      .getAllMarks()
      .filter(isBlockNodeMarker) as BlockNodeMarker[];
  }
  getAllTextMarkers() {
    return this.codemirror
      .getAllMarks()
      .filter(
        (m): m is CodeMirror.TextMarker<CodeMirror.MarkerRange> =>
          !isBlockNodeMarker(m) && isTextMarkerRange(m)
      );
  }

  replaceRange(
    replacement: string | string[],
    from: Pos,
    to: Pos,
    origin: string | undefined
  ): void {
    this.codemirror.replaceRange(replacement, from, to, origin);
  }
  hasFocus(): boolean {
    return this.codemirror.hasFocus();
  }
  focus(): void {
    this.codemirror.focus();
  }
  getCursor(): Pos {
    return this.codemirror.getCursor();
  }
  setCursor(cur: Pos): void {
    this.codemirror.setCursor(cur);
  }
  undo(): void {
    this.codemirror.undo();
  }
  redo(): void {
    this.codemirror.redo();
  }
  setValue(value: string) {
    this.codemirror.setValue(value);
  }
  refresh() {
    this.codemirror.refresh();
  }

  applyChanges(changes: CodeMirror.EditorChange[]) {
    this.codemirror.operation(() => {
      for (const change of changes) {
        this.codemirror.replaceRange(
          change.text,
          change.from,
          change.to,
          change.origin
        );
      }
    });
  }

  focusBlock(node: ASTNode) {
    keeperOf(this.codemirror)?.request(node);
  }

  checkFocus() {
    keeperOf(this.codemirror)?.check();
  }

  scrollASTNodeIntoView(node: ASTNode) {
    if (!node.element) {
      throw new Error(
        "can't scroll an ast node into view if it doesn't have an element set"
      );
    }
    // Removing the focused block while CodeMirror patches its display fires the
    // block's blur handlers right then, and one of them can ask to scroll:
    // CodeMirror cannot measure in the middle of its own update, so wait.
    if (window.event?.type === "blur" || window.event?.type === "focusout") {
      queueMicrotask(() => {
        // (the block may be gone by then)
        // (and the event is still the current one in a microtask run right
        // after its handler: asking again would defer for ever)
        if (node.element) this.scrollToElement(node, node.element);
      });
      return;
    }
    this.scrollToElement(node, node.element);
  }

  private scrollToElement(node: ASTNode, element: HTMLElement) {
    // (a block CodeMirror has dropped from a long document is drawn again once
    // its line is in view)
    this.codemirror.scrollIntoView(node.from);
    // a block that was just removed still has its element, but nowhere to scroll to
    if (!element.isConnected) return;
    // get the *actual* bounding rect
    let { top, bottom, left, right } = element.getBoundingClientRect();
    const offset = this.codemirror.getWrapperElement().getBoundingClientRect();
    const scroll = this.codemirror.getScrollInfo();
    top = top + scroll.top - offset.top;
    bottom = bottom + scroll.top - offset.top;
    left = left + scroll.left - offset.left;
    right = right + scroll.left - offset.left;
    this.codemirror.scrollIntoView({ top, bottom, left, right });
    this.codemirror
      .getScrollerElement()
      .setAttribute("aria-activedescendent", element.id);
  }

  replaceMarkerWidget(
    from: Pos,
    to: Pos,
    widget: HTMLElement
  ): BlockNodeMarker {
    // clear any existing block node markers
    for (const m of this.codemirror.findMarks(from, to)) {
      if (!m.isBlockNode) continue;
      // (findMarks also gives the markers that only touch the range: a new
      // marker beside a block must leave it alone)
      const range = m.find();
      if (
        !range ||
        "line" in range ||
        (poscmp(range.from, to) < 0 && poscmp(range.to, from) > 0)
      ) {
        m.clear();
      }
    }

    let mark: CodeMirror.TextMarker;
    // CM treats 0-width ranges differently than other ranges, so check
    if (poscmp(from, to) === 0) {
      mark = this.codemirror.setBookmark(from, {
        widget,
      });
    } else {
      mark = this.codemirror.markText(from, to, {
        replacedWith: widget,
      });
    }
    mark.isBlockNode = true;
    return mark as BlockNodeMarker;
  }
}
