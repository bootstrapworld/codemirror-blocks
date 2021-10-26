import {
  poscmp,
  srcRangeIncludes,
  warn,
  setAfterDOMUpdate,
  getTempCM,
  minpos,
  maxpos,
  validateRanges,
  BlockError,
} from "./utils";
import { say, cancelAnnouncement } from "./announcer";
import { AppDispatch, AppStore, AppThunk } from "./store";
import {
  performEdits,
  edit_insert,
  edit_delete,
  edit_replace,
  edit_overwrite,
  EditInterface,
} from "./edits/performEdits";
import { AST, ASTNode, Pos } from "./ast";
import { AppAction, RootState } from "./reducers";
import {
  CodeMirrorFacade,
  CMBEditor,
  ReadonlyCMBEditor,
  ReadonlyRangedText,
} from "./editor";
import { SelectionOptions } from "codemirror";
import { useDispatch, useStore } from "react-redux";
import type { Language } from "./CodeMirrorBlocks";
import { Result } from "./edits/result";
import { useContext } from "react";
import { LanguageContext } from "./components/Context";

// All editing actions are defined here.
//
// Many actions take a Target as an option. A Target may be constructed by any
// of the methods on the `Targets` export below.
//
// Just about every action will return a result object, containing the new ast
// if successful, or an error value if unssucessful. See the types.
//
// The implementation of actions is in the folder `src/edits/`. IT IS PRIVATE,
// AND FOR THE MOST PART, NO FILE EXCEPT src/actions.js SHOULD NEED TO IMPORT IT.
// (Exception: speculateChanges and commitChanges are sometimes imported.)
// The implementation is complex, because while edits are best thought of as
// operations on the AST, they must all be transformed into text edits, and the
// only interface we have into the language's textual syntax are the `pretty`
// and `parse` methods.

// A _Target_ says where an action is directed. For example, a target may be a
// node or a drop target.
//
// These are the kinds of targets:
// - InsertTarget: insert at a location inside the AST.
// - ReplaceNodeTarget: replace an ast node.
// - OverwriteTarget: replace a range of text at the top level.
//
// These kinds of actions _have_ a target:
// - Paste: the target says where to paste.
// - Drag&Drop: the target says what's being dropped on.
// - Insert/Edit: the target says where the text is being inserted/edited.
//
// Targets are defined at the bottom of this file.

// Insert `text` at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export const insert =
  (
    text: string,
    target: Target,
    editor: CMBEditor,
    parse: Language["parse"],
    annt?: string
  ): AppThunk<Result<{ newAST: AST; focusId?: string | undefined }>> =>
  (dispatch, getState) => {
    checkTarget(target);
    const edits = [target.toEdit(getState().ast, text)];
    return dispatch(performEdits(edits, parse, editor, annt));
  };

/**
 * Generates a description of an edit involving certain nodes
 * that can be announced to the user.
 *
 * @param nodes the ast nodes that are involved
 * @param editWord a word describing the edit like "copied"
 * @returns the human readable description of the edit
 * @internal
 */
function createEditAnnouncement(nodes: ASTNode[], editWord: string) {
  nodes.sort((a, b) => poscmp(a.from, b.from)); // speak first-to-last
  return (
    editWord + " " + nodes.map((node) => node.shortDescription()).join(" and ")
  );
}

// Delete the given nodes.
// 'delete' is a reserved word, hence the trailing underscore
export const delete_ =
  (
    editor: CMBEditor,
    nodes: ASTNode[],
    parse: Language["parse"],
    editWord?: string
  ): AppThunk =>
  (dispatch, getState) => {
    if (nodes.length === 0) {
      return;
    }
    nodes.sort((a, b) => poscmp(b.from, a.from)); // To focus before first deletion
    const { ast } = getState();
    const edits = nodes.map((node) => edit_delete(ast, node));
    let annt: string | undefined = undefined;
    if (editWord) {
      annt = createEditAnnouncement(nodes, editWord);
      say(annt);
    }
    dispatch(performEdits(edits, parse, editor, annt));
    dispatch({ type: "SET_SELECTIONS", selections: [] });
  };

// Copy the given nodes onto the clipboard.
export function copy(
  state: Pick<RootState, "ast" | "focusId">,
  nodes: ASTNode[],
  editWord?: string
) {
  if (nodes.length === 0) return;
  const { ast, focusId } = state;
  // Pretty-print each copied node. Join them with spaces, or newlines for
  // commented nodes (to prevent a comment from attaching itself to a
  // different node after pasting).
  nodes.sort((a, b) => poscmp(a.from, b.from));
  let annt: string;
  if (editWord) {
    annt = createEditAnnouncement(nodes, editWord);
    say(annt);
  }
  let text = "";
  let postfix = "";
  for (const node of nodes) {
    const prefix = node.options && node.options.comment ? "\n" : postfix;
    text = text + prefix + node.toString();
    postfix = node.options && node.options.comment ? "\n" : " ";
  }
  copyToClipboard(text);
  // Copy steals focus. Force it back to the node's DOM element
  // without announcing via activateByNid().
  if (focusId) {
    ast.getNodeByIdOrThrow(focusId).element?.focus();
  }
}

// Paste from the clipboard at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export const paste =
  (editor: CMBEditor, target: Target, parse: Language["parse"]): AppThunk =>
  (dispatch, getState) => {
    checkTarget(target);
    pasteFromClipboard((text) => {
      const edits = [target.toEdit(getState().ast, text)];
      dispatch(performEdits(edits, parse, editor));
      dispatch({ type: "SET_SELECTIONS", selections: [] });
    });
  };

export function useDropAction() {
  // Drag from `src` (which should be a d&d monitor thing) to `target`.
  // See the comment at the top of the file for what kinds of `target` there are.
  const store: AppStore = useStore();
  const dispatch: AppDispatch = useDispatch();
  const language = useContext(LanguageContext);
  return function drop(
    editor: CMBEditor,
    src: { id: string; content: string },
    target: Target
  ) {
    if (!language) {
      throw new Error(`Can't use dropAction outside of a language context`);
    }
    checkTarget(target);
    const { id: srcId, content: srcContent } = src;
    const state = store.getState();
    const { collapsedList } = state;
    let { ast } = state; // get the AST, and which nodes are collapsed
    const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
    const content = srcNode ? srcNode.toString() : srcContent;

    // If we dropped the node _inside_ where we dragged it from, do nothing.
    if (srcNode && srcRangeIncludes(srcNode.srcRange(), target.srcRange())) {
      return;
    }

    const edits = [];
    let droppedHash: unknown;

    // Assuming it did not come from the toolbar...
    // (1) Delete the text of the dragged node, (2) and save the id and hash
    if (srcNode) {
      edits.push(
        edit_delete(state.ast, state.ast.getNodeByIdOrThrow(srcNode.id))
      );
      droppedHash = ast.getNodeByIdOrThrow(srcNode.id).hash;
    }

    // Insert or replace at the drop location, depending on what we dropped it on.
    edits.push(target.toEdit(ast, content));
    // Perform the edits.
    const editResult = dispatch(performEdits(edits, language.parse, editor));

    // Assuming it did not come from the toolbar, and the srcNode was collapsed...
    // Find the matching node in the new tree and collapse it
    if (srcNode && collapsedList.find((id) => id == srcNode.id)) {
      if (editResult.successful) {
        ast = editResult.value.newAST;
      }
      const newNode = [...ast.getAllNodes()].find((n) => n.hash == droppedHash);
      newNode && dispatch({ type: "COLLAPSE", id: newNode.id });
      dispatch({ type: "UNCOLLAPSE", id: srcNode.id });
    }
  };
}

// Set the cursor position.
export const setCursor = (editor: CMBEditor, cur: Pos | null): AppAction => {
  if (editor && cur) {
    editor.focus();
    editor.setCursor(cur);
  }
  return { type: "SET_CURSOR", cur };
};

// Activate the node with the given `nid`.
export function activateByNid(
  editor: ReadonlyCMBEditor,
  nid: number | null,
  options: { allowMove?: boolean; record?: boolean } = {}
): AppThunk {
  return (dispatch, getState) => {
    options = { ...options, allowMove: true, record: true };
    const { ast, focusId, collapsedList } = getState();

    // If nid is null, try to get it from the focusId
    if (nid === null && focusId) {
      nid = ast.getNodeById(focusId)?.nid ?? null;
    }

    // Get the new node from the nid
    const newNode = nid === null ? null : ast.getNodeByNId(nid);

    // If there is no valid node found in the AST, bail.
    // (This could also mean a node was selected in the toolbar!
    // It's ok to do nothing: screenreaders will still announce it -
    // we just don't want to activate them.)
    if (!newNode) {
      return;
    }

    // If the element has been ellided by CM, it won't be in the DOM. This
    // can lead to situations where CM ellides the *currently-focused* elt,
    // which confuses the screenreader. In these situations, we focus on
    // a dummy element that just says "stand by" (see ToggleEditor.js).
    // When the new node is available, focus will shift automatically.
    if (!document.contains(newNode.element)) {
      const sr = document.getElementById("SR_fix_for_slow_dom");
      // In the event that everything has been unmounted,
      // for example in a unit test, then neither newNode.element nor
      // SR_fix_for_slow_down will exist. So check to see if it's still
      // there before attempting to focus it.
      if (sr) {
        sr.focus();
      }
    }

    cancelAnnouncement(); // clear any overrideable announcements
    // FIXME(Oak): if possible, let's not hard code like this
    if (
      ["blank", "literal"].includes(newNode.type) &&
      !collapsedList.includes(newNode.id)
    ) {
      say("Use enter to edit", 1250, true); // wait 1.25s, and allow to be overridden
    }

    setAfterDOMUpdate(() => {
      dispatch({ type: "SET_FOCUS", focusId: newNode.id });

      // if this timeout fires after the node has been torn down, don't bother
      if (newNode.element) {
        if (options.allowMove) {
          editor.scrollASTNodeIntoView(newNode);
        }
        newNode.element.focus();
      }
    });
  };
}

function checkTarget(target: Target) {
  if (!(target instanceof Target)) {
    warn(
      "actions",
      `Expected target ${target} to be an instance of the Target class.`
    );
  }
}

// lazily create a hidden buffer, for use with copy/cut/paste
let _buffer: HTMLTextAreaElement;
function getCopyPasteBuffer() {
  if (_buffer) {
    return _buffer;
  }
  _buffer = document.createElement("textarea");
  _buffer.ariaHidden = "true";
  _buffer.tabIndex = -1;
  _buffer.style.opacity = "0";
  _buffer.style.height = "1px";
  document.body.appendChild(_buffer);
  return _buffer;
}

function copyToClipboard(text: string) {
  const buffer = getCopyPasteBuffer();
  buffer.value = text;
  buffer.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch((e) => {
      console.error("Failed copying to clipboard: ", e);
      // lets try using the deprecated API:
      document.execCommand("copy");
    });
  } else if (document.execCommand) {
    document.execCommand("copy");
  }
}

function pasteFromClipboard(done: (value: string) => void) {
  const buffer = getCopyPasteBuffer();
  buffer.value = "";
  buffer.focus();
  setTimeout(() => {
    done(buffer.value);
  }, 50);
}

/**
 * Override CM's native setSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
export const setSelections =
  (
    ed: CodeMirrorFacade,
    ranges: Array<{ anchor: CodeMirror.Position; head: CodeMirror.Position }>,
    primary?: number,
    options?: { bias?: number; origin?: string; scroll?: boolean },
    replace = true
  ): AppThunk =>
  (dispatch, getState) => {
    const { ast } = getState();
    const tmpCM = getTempCM(ed);
    tmpCM.setSelections(ranges, primary, options);
    const textRanges: {
      anchor: CodeMirror.Position;
      head: CodeMirror.Position;
    }[] = [];
    const nodes: string[] = [];
    try {
      validateRanges(ranges, ast);
    } catch (e) {
      throw new BlockError(e, "API Error");
    }
    // process the selection ranges into an array of ranges and nodes
    tmpCM.listSelections().forEach(({ anchor, head }) => {
      const c1 = minpos(anchor, head);
      const c2 = maxpos(anchor, head);
      const node = ast.getNodeAt(c1, c2);
      if (node) {
        nodes.push(node.id);
      } else textRanges.push({ anchor: anchor, head: head });
    });
    if (textRanges.length) {
      if (replace) {
        ed.codemirror.setSelections(textRanges, primary, options);
      } else {
        ed.codemirror.addSelection(textRanges[0].anchor, textRanges[0].head);
      }
    }
    dispatch({ type: "SET_SELECTIONS", selections: nodes });
  };

/**
 * Override CM's native extendSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
export const extendSelections =
  (
    ed: CodeMirrorFacade,
    heads: CodeMirror.Position[],
    opts?: SelectionOptions,
    to?: CodeMirror.Position
  ): AppThunk =>
  (dispatch) => {
    const tmpCM: CodeMirror.Editor = getTempCM(ed);
    tmpCM.setSelections(listSelections(ed, dispatch));
    if (to) {
      tmpCM.extendSelections(heads, opts);
    } else {
      tmpCM.extendSelection(heads[0], to, opts);
    }
    // if one of the ranges is invalid, setSelections will raise an error
    setSelections(ed, tmpCM.listSelections(), undefined, opts);
  };

/**
 * Override CM's native replaceSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
export const replaceSelections =
  (
    ed: CodeMirrorFacade,
    replacements: string[],
    select?: "around" | "start"
  ): AppThunk =>
  (dispatch) => {
    const tmpCM: CodeMirror.Editor = getTempCM(ed);
    tmpCM.setSelections(listSelections(ed, dispatch));
    tmpCM.replaceSelections(replacements, select);
    ed.setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if (select == "around") {
      setSelections(ed, tmpCM.listSelections(), undefined, undefined);
    }
    const cur =
      select == "start"
        ? tmpCM.listSelections().pop()?.head
        : tmpCM.listSelections().pop()?.anchor;
    setCursor(ed, cur ?? null);
  };

/**
 * Override CM's native listSelections method, using the selection
 * state from the block editor
 */
export const listSelections = (ed: CodeMirrorFacade, dispatch: AppDispatch) => {
  const { selections, ast } = dispatch((_, getState) => getState());
  const tmpCM = getTempCM(ed);
  // write all the ranges for all selected nodes
  selections.forEach((id) => {
    const node = ast.getNodeByIdOrThrow(id);
    tmpCM.addSelection(node.from, node.to);
  });
  // write all the existing selection ranges
  ed.codemirror
    .listSelections()
    .map((s) => tmpCM.addSelection(s.anchor, s.head));
  // return all the selections
  return tmpCM.listSelections();
};

// The class of all targets.
export abstract class Target {
  from: Pos;
  to: Pos;
  node?: ASTNode;

  constructor(from: Pos, to: Pos) {
    this.from = from;
    this.to = to;
  }

  srcRange() {
    return { from: this.from, to: this.to };
  }
  abstract getText(ast: AST, text: ReadonlyRangedText): string;
  abstract toEdit(ast: AST, text: string): EditInterface;
}

// Insert at a location inside the AST.
export class InsertTarget extends Target {
  parent: ASTNode;
  field: string;
  pos: Pos;
  constructor(parentNode: ASTNode, fieldName: string, pos: Pos) {
    super(pos, pos);
    this.parent = parentNode;
    this.field = fieldName;
    this.pos = pos;
  }

  getText() {
    return "";
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_insert(text, this.parent, this.field, this.pos);
  }
}

// Target an ASTNode. This will replace the node.
export class ReplaceNodeTarget extends Target {
  node: ASTNode;

  constructor(node: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  getText(ast: AST, text: ReadonlyRangedText) {
    const { from, to } = ast.getNodeByIdOrThrow(this.node.id);
    return text.getRange(from, to);
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_replace(text, ast, this.node);
  }
}

// Target a source range at the top level. This really has to be at the top
// level: neither `from` nor `to` can be inside any root node.
export class OverwriteTarget extends Target {
  constructor(from: Pos, to: Pos) {
    super(from, to);
  }

  getText(ast: AST, text: ReadonlyRangedText) {
    return text.getRange(this.from, this.to);
  }

  toEdit(ast: AST, text: string): EditInterface {
    return edit_overwrite(text, this.from, this.to);
  }
}
