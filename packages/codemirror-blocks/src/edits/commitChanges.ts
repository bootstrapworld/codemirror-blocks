import { AppThunk } from "../state/store";
import { poscmp, adjustForChange, minimizeChange } from "../utils";
import { activateByNid } from "../state/actions";
import patch from "./patchAst";
import { AST, ASTNode } from "../ast";
import type { EditorChange } from "codemirror";
import { ReadonlyCMBEditor, ReadonlyRangedText } from "../editor";
import { ChangeObject } from "./performEdits";
import * as actions from "../state/actions";
import * as selectors from "../state/selectors";
import { RootState } from "../state/reducers";

export type FocusHint = (ast: AST) => ASTNode | undefined | "fallback";

/**
 * Commit a set of text changes to CodeMirror. This can only be called if you
 * _know_ that the changes are valid (will parse successfully); to determine
 * this, call {@link speculateChanges}.
 *
 * @param changes The array of change objects to commit.
 * @param editor a ReadonlyCMBEditor instance containing the text that will be changed.
 * @param isUndoOrRedo must be `true` iff these changes originated from
 *   an undo or redo event.
 * @param focusHint an optional function that returns an ASTNode to focus on. If it
 *   returns `"fallback"`, then the focus will be computed from the changes using
 *   {@link computeFocusNodeFromChanges}. If no focus hint is given, then no node will
 *   be focused.
 * @param astHint the AST you get from parsing the result of these changes (which
 *   you may know from a call to `speculateChanges()`).
 * @param annt
 *
 * @returns the new AST constructed from the changes and the id of the node that was
 *   focused (if one was found)
 */
export const commitChanges =
  (
    changes: ChangeObject[],
    editor: ReadonlyCMBEditor,
    isUndoOrRedo: boolean,
    focusHint?: FocusHint,
    astHint?: AST,
    annt?: string
  ): AppThunk<{ newAST: AST; focusId?: string }> =>
  (dispatch, getState) => {
    const oldAST = selectors.getAST(getState());
    const oldFocus = selectors.getFocusedNode(getState());

    // If we haven't already parsed the AST during speculateChanges, parse it now.
    const newNodes: ASTNode[] = astHint
      ? [...astHint.rootNodes]
      : oldAST.language.parse(editor.getValue());
    // Patch the tree and set the state
    const newAST = AST.from(
      oldAST.language.id,
      patch([...oldAST.rootNodes], newNodes)
    );
    dispatch(actions.setAST(newAST));

    // Try to set the focus using hinting data. If that fails, use the first root
    let focusId: string | undefined = newAST.getFirstRootNode()?.id;
    if (focusHint) {
      // if there is hinting data, try that as well.
      const node = computeFocusNodeFromHint(
        editor,
        changes,
        focusHint,
        getState()
      );
      if (node) {
        dispatch(activateByNid(editor, node.nid));
        focusId = node.id;
      }
    }
    if (!isUndoOrRedo) {
      // `DO` must be dispatched every time _any_ edit happens on CodeMirror:
      // this is what populates our undo stack.
      const newFocus = focusId ? newAST.getNodeById(focusId) : undefined;
      const topmostAction = editor.getTopmostAction("undo");
      topmostAction.undoableAction = annt;
      topmostAction.actionFocus = {
        oldFocusNId: oldFocus?.nid,
        newFocusNId: newFocus?.nid,
      };
      dispatch(actions.setFocusedNode(newFocus));
    }
    return { newAST, focusId };
  };

// Use the focus hint to determine focus, unless:
// 1. There is no focus hint, or
// 2. There is a focus hint, but when you call it it returns "fallback".
// In those cases, use `computeFocusNodeFromChanges` instead.
const computeFocusNodeFromHint = (
  editor: ReadonlyCMBEditor,
  changes: EditorChange[],
  focusHint: FocusHint,
  state: RootState
): ASTNode | undefined => {
  const collapsedList = selectors.getCollapsedList(state);
  const newAST = selectors.getAST(state);

  let focusNode = focusHint(newAST);
  if (focusNode === "fallback") {
    focusNode =
      computeFocusNodeFromChanges(editor, changes, newAST) ?? undefined;
  }

  let focusNId = focusNode?.nid;
  while (focusNode) {
    const parent = newAST.getNodeParent(focusNode);
    if (!parent) {
      break;
    }
    focusNode = parent;
    if (collapsedList.includes(focusNode.id)) {
      focusNId = focusNode.nid;
    }
  }
  // get the nid and activate
  if (focusNId !== undefined) {
    return newAST.getNodeByNIdOrThrow(focusNId);
  }
  return undefined;
};

// computeFocusNodeFromChanges : [CMchanges], AST -> Number
// compute the focusId by identifying the node in the newAST that was
//   (a) most-recently added (if there's any insertion)
//   (b) before the first-deleted (in the case of deletion)
//   (c) first root node (in the case of deleting a pre-existing first node)
//   (d) null (in the case of deleting the only nodes in the tree)
// NOTE(Justin): This is a set of _heuristics_ that are likely but not
// guaranteed to work, because textual edits may obscure what's really going on.
// Whenever possible, a `focusHint` should be given.
function computeFocusNodeFromChanges(
  text: ReadonlyRangedText,
  changes: EditorChange[],
  newAST: AST
): ASTNode | null {
  let insertion = false as EditorChange | false;
  const startLocs = changes.map((change) => {
    let { removed } = change;
    if (!removed) {
      removed = text.getRange(change.from, change.to).split("\n");
    }
    change = minimizeChange({ ...change, removed });
    change.from = adjustForChange(change.from, change, true);
    change.to = adjustForChange(change.to, change, false);
    if (change.text.join("").length > 0) insertion = change; // remember the most-recent insertion
    return change.from; // return the starting srcLoc of the change
  });
  if (insertion) {
    // Case A: grab the inserted node, *or* the node that ends in
    // insertion's ending srcLoc (won't ever be null post-insertion)
    const insertedNode = newAST.getNodeAt(insertion.from, insertion.to);
    const lastNodeInserted = newAST.getNodeBeforeCur(insertion.to);
    return insertedNode || lastNodeInserted;
  } else {
    startLocs.sort(poscmp); // sort the deleted ranges
    const focusNode = newAST.getNodeBeforeCur(startLocs[0]); // grab the node before the first
    // Case B: If the node exists, use the Id.
    // Case C: If not, use the first node...unless...
    // Case D: the tree is empty, so return null
    return focusNode || newAST.getFirstRootNode() || null;
  }
}
