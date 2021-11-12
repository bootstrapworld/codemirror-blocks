import type { ASTNode } from "./ast";
import type { ActionFocus } from "./state/reducers";
import { poscmp } from "./utils";

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

  getTopmostAction(which: "undo" | "redo"): CodeMirror.HistoryItem;

  getAllBlockNodeMarkers(): BlockNodeMarker[];
  getAllTextMarkers(): CodeMirror.TextMarker<CodeMirror.MarkerRange>[];
  getCursor(): Pos;
  getSearchCursor(
    query: string | RegExp,
    start: Pos,
    options: { caseFold: boolean }
  ): CodeMirror.SearchCursor;
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
  constructor(codemirror: CodeMirror.Editor) {
    this.codemirror = codemirror;
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
    const items =
      which === "undo"
        ? this.codemirror.getDoc().getHistory().done
        : this.codemirror.getDoc().getHistory().undone;
    for (let i = items.length - 1; i >= 0; i--) {
      if (!items[i].ranges) {
        return items[i];
      }
    }
    throw new Error(`No undoable found`);
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

  scrollASTNodeIntoView(node: ASTNode) {
    if (!node.element) {
      throw new Error(
        "can't scroll an ast node into view if it doesn't have an element set"
      );
    }
    this.codemirror.scrollIntoView(node.from);
    // get the *actual* bounding rect
    let { top, bottom, left, right } = node.element.getBoundingClientRect();
    const offset = this.codemirror.getWrapperElement().getBoundingClientRect();
    const scroll = this.codemirror.getScrollInfo();
    top = top + scroll.top - offset.top;
    bottom = bottom + scroll.top - offset.top;
    left = left + scroll.left - offset.left;
    right = right + scroll.left - offset.left;
    this.codemirror.scrollIntoView({ top, bottom, left, right });
    this.codemirror
      .getScrollerElement()
      .setAttribute("aria-activedescendent", node.element.id);
  }

  replaceMarkerWidget(
    from: Pos,
    to: Pos,
    widget: HTMLElement
  ): BlockNodeMarker {
    // clear any existing block node markers
    for (const m of this.codemirror.findMarks(from, to)) {
      if (m.isBlockNode) {
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
