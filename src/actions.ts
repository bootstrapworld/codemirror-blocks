import {
  poscmp,
  srcRangeIncludes,
  warn,
  setAfterDOMUpdate,
  cancelAfterDOMUpdate,
} from "./utils";
import type { afterDOMUpdateHandle } from "./utils";
import { say, cancelAnnouncement } from "./announcer";
import SHARED from "./shared";
import { AppDispatch, store } from "./store";
import {
  performEdits,
  edit_insert,
  edit_delete,
  edit_replace,
  edit_overwrite,
  EditInterface,
  OnSuccess,
  OnError,
} from "./edits/performEdits";
import { AST, ASTNode, Pos } from "./ast";
import { RootState } from "./reducers";

// All editing actions are defined here.
//
// Many actions take a Target as an option. A Target may be constructed by any
// of the methods on the `Targets` export below.
//
// Just about every action can take an optional `onSuccess` and `onError`
// callback. If the action is successful, it will call `onSuccess(newAST)`. If
// it fails, it will call `onError(theError)`.
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
export function insert(
  text: string,
  target: Target,
  onSuccess?: OnSuccess,
  onError?: OnError,
  annt?: string
) {
  checkTarget(target);
  const { ast } = store.getState();
  const edits = [target.toEdit(text)];
  performEdits(
    "cmb:insert",
    ast,
    edits,
    SHARED.parse,
    onSuccess,
    onError,
    annt
  );
}

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
  let annt =
    editWord + " " + nodes.map((node) => node.shortDescription()).join(" and ");
  return annt;
}

// Delete the given nodes.
export function delete_(nodes: ASTNode[], editWord?: string) {
  // 'delete' is a reserved word
  if (nodes.length === 0) return;
  const { ast } = store.getState();
  nodes.sort((a, b) => poscmp(b.from, a.from)); // To focus before first deletion
  const edits = nodes.map((node) => edit_delete(node));
  let annt: string;
  if (editWord) {
    annt = createEditAnnouncement(nodes, editWord);
    say(annt);
  }
  performEdits(
    "cmb:delete-node",
    ast,
    edits,
    SHARED.parse,
    undefined,
    undefined,
    annt
  );
  store.dispatch({ type: "SET_SELECTIONS", selections: [] });
}

// Copy the given nodes onto the clipboard.
export function copy(nodes: ASTNode[], editWord?: string) {
  if (nodes.length === 0) return;
  const { ast, focusId } = store.getState();
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
  for (let node of nodes) {
    let prefix = node.options && node.options.comment ? "\n" : postfix;
    text = text + prefix + node.toString();
    postfix = node.options && node.options.comment ? "\n" : " ";
  }
  copyToClipboard(text);
  // Copy steals focus. Force it back to the node's DOM element
  // without announcing via activateByNid().
  if (focusId) {
    ast.getNodeById(focusId).element.focus();
  }
}

// Paste from the clipboard at the given `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export function paste(
  target: Target,
  onSuccess?: OnSuccess,
  onError?: OnError
) {
  checkTarget(target);
  pasteFromClipboard((text) => {
    const { ast } = store.getState();
    const edits = [target.toEdit(text)];
    performEdits("cmb:paste", ast, edits, SHARED.parse, onSuccess, onError);
    store.dispatch({ type: "SET_SELECTIONS", selections: [] });
  });
}

// Drag from `src` (which should be a d&d monitor thing) to `target`.
// See the comment at the top of the file for what kinds of `target` there are.
export function drop(
  src: { id: string; content: string },
  target: Target,
  onSuccess?: OnSuccess,
  onError?: OnError
) {
  checkTarget(target);
  const { id: srcId, content: srcContent } = src;
  let { ast, collapsedList } = store.getState(); // get the AST, and which nodes are collapsed
  const srcNode = srcId ? ast.getNodeById(srcId) : null; // null if dragged from toolbar
  const content = srcNode ? srcNode.toString() : srcContent;

  // If we dropped the node _inside_ where we dragged it from, do nothing.
  if (srcNode && srcRangeIncludes(srcNode.srcRange(), target.srcRange())) {
    return;
  }

  let edits = [];
  let droppedHash: unknown;

  // Assuming it did not come from the toolbar...
  // (1) Delete the text of the dragged node, (2) and save the id and hash
  if (srcNode !== null) {
    edits.push(edit_delete(srcNode));
    droppedHash = ast.nodeIdMap.get(srcNode.id).hash;
  }

  // Insert or replace at the drop location, depending on what we dropped it on.
  edits.push(target.toEdit(content));
  // Perform the edits.
  performEdits("cmb:drop-node", ast, edits, SHARED.parse, onSuccess, onError);

  // Assuming it did not come from the toolbar, and the srcNode was collapsed...
  // Find the matching node in the new tree and collapse it
  if (srcNode !== null && collapsedList.find((id) => id == srcNode.id)) {
    let { ast } = store.getState();
    const newNode = [...ast.nodeIdMap.values()].find(
      (n) => n.hash == droppedHash
    );
    store.dispatch({ type: "COLLAPSE", id: newNode.id });
    store.dispatch({ type: "UNCOLLAPSE", id: srcNode.id });
  }
}

// Drag from `src` (which should be a d&d monitor thing) to the trash can, which
// just deletes the block.
export function dropOntoTrashCan(src: { id: string }) {
  const { ast } = store.getState();
  const srcNode = src.id ? ast.getNodeById(src.id) : null; // null if dragged from toolbar
  if (!srcNode) return; // Someone dragged from the toolbar to the trash can.
  let edits = [edit_delete(srcNode)];
  performEdits("cmb:trash-node", ast, edits, SHARED.parse);
}

// Set the cursor position.
export function setCursor(cur: Pos) {
  return (dispatch: AppDispatch) => {
    if (SHARED.cm && cur) {
      SHARED.cm.focus();
      SHARED.search.setCursor(cur);
      SHARED.cm.setCursor(cur);
    }
    dispatch({ type: "SET_CURSOR", cur });
  };
}

// Activate the node with the given `nid`.
export function activateByNid(
  nid: number | null,
  options?: { allowMove?: boolean; record?: boolean }
) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    options = { ...options, allowMove: true, record: true };
    let { ast, focusId, collapsedList } = getState();

    // If nid is null, try to get it from the focusId
    if (nid === null) {
      nid = ast?.getNodeById(focusId)?.nid;
    }

    // Get the currently-focused node *based strictly on focusId*
    // And the new node from the nid
    const currentNode = ast?.getNodeById(focusId);
    const newNode = ast?.getNodeByNId(nid);

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

    /*
    NOTE(Emmanuel): This was added for an a11y corner case years ago - still needed?
    // If there's a previously-focused node, see if the ids match
    // If so, we need to manually initiate a new focus event
    if (newNode.nid === currentNode?.nid) {
      // if this timeout fires after the node has been torn down, don't focus
      setTimeout(() => { if(newNode.element) newNode.element.focus(); }, 10);
    }
*/
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

      if (options.record && SHARED.search) {
        SHARED.search.setCursor(newNode.from);
      }
      // if this timeout fires after the node has been torn down, don't bother
      if (newNode.element && SHARED.cm) {
        const scroller = SHARED.cm.getScrollerElement();
        const wrapper = SHARED.cm.getWrapperElement();

        if (options.allowMove) {
          SHARED.cm.scrollIntoView(newNode.from);
          // get the *actual* bounding rect
          let { top, bottom, left, right } =
            newNode.element.getBoundingClientRect();
          let offset = wrapper.getBoundingClientRect();
          let scroll = SHARED.cm.getScrollInfo();
          top = top + scroll.top - offset.top;
          bottom = bottom + scroll.top - offset.top;
          left = left + scroll.left - offset.left;
          right = right + scroll.left - offset.left;
          SHARED.cm.scrollIntoView({ top, bottom, left, right });
        }
        scroller.setAttribute("aria-activedescendent", newNode.element.id);
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

function copyToClipboard(text: string) {
  SHARED.buffer.value = text;
  SHARED.buffer.select();
  document.execCommand("copy");
}

function pasteFromClipboard(done: (value: string) => void) {
  SHARED.buffer.value = "";
  SHARED.buffer.focus();
  setTimeout(() => {
    done(SHARED.buffer.value);
  }, 50);
}

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
  abstract getText(ast: AST): string;
  abstract toEdit(test: string): EditInterface;
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

  toEdit(text: string): EditInterface {
    return edit_insert(text, this.parent, this.field, this.pos);
  }
}

// Target an ASTNode. This will replace the node.
export class ReplaceNodeTarget extends Target {
  constructor(node: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  getText(ast: AST) {
    const { from, to } = ast.getNodeById(this.node.id);
    return SHARED.cm.getRange(from, to);
  }

  toEdit(text: string): EditInterface {
    return edit_replace(text, this.node);
  }
}

// Target a source range at the top level. This really has to be at the top
// level: neither `from` nor `to` can be inside any root node.
export class OverwriteTarget extends Target {
  constructor(from: Pos, to: Pos) {
    super(from, to);
  }

  getText() {
    return SHARED.cm.getRange(this.from, this.to);
  }

  toEdit(text: string): EditInterface {
    return edit_overwrite(text, this.from, this.to);
  }
}
