import {
  warn,
  poscmp,
  srcRangeIncludes,
  changeEnd,
  logResults,
} from "../utils";
import { AST, ASTNode, Pos, prettyPrintingWidth } from "../ast";
import { commitChanges } from "./commitChanges";
import { speculateChanges } from "./speculateChanges";
import {
  FakeAstInsertion,
  FakeAstReplacement,
  cloneNode,
  ClonedASTNode,
} from "./fakeAstEdits";
import type { AppThunk } from "../store";
import { getReducerActivities } from "../reducers";
import { err, ok, Result } from "./result";
import { CMBEditor, ReadonlyRangedText } from "../editor";
import CodeMirror from "codemirror";
import { Language } from "../CodeMirrorBlocks";

/**
 *
 * Edits made in the block editor cannot be described in strictly
 * textual terms! Deleting a root node may require removing extra
 * whitespace, and editing a child node often requires adding/removing
 * delimeter chars and pretty-printing.
 *
 * Instead, we define "abstract edits", which produce different
 * kinds of "Edits" depending on the action and whether the effected
 * node is a root or child. The workflow in this file is:
 *
 * <abstract edit(s)>  ->  Edits  ->  EditGroup  ->  CM ChangeObject
 */

/**
 * ABSTRACT EDITS
 * These abstract edits are exported, and used
 * by the actions.ts file:
 *
 * edit_insert : String, ASTNode, String, Pos -> Edit
 * Construct an edit to insert `text` in the list `parent.field` at the given `pos`.
 *
 * edit_overwrite : String, Pos, Pos -> Edit
 * Construct an edit to replace a range of source code with `text`. The range
 * must be at the toplevel: it can neither begin nor end inside a root node.
 *
 * edit_delete : ASTNode -> Edit
 * Construct an edit to delete the given node.
 *
 * edit_replace : String, ASTNode -> Edit
 * Construct an edit to replace `node` with `text`.
 */
export function edit_insert(
  text: string,
  parent: ASTNode,
  field: string,
  pos: Pos
): EditInterface {
  return new InsertChildEdit(text, parent, field, pos);
}

export function edit_overwrite(
  text: string,
  from: Pos,
  to: Pos
): EditInterface {
  return new OverwriteEdit(text, from, to);
}

export function edit_delete(ast: AST, node: ASTNode): EditInterface {
  const parent = ast.getNodeParent(node);
  if (parent) {
    return new DeleteChildEdit(node, parent, ast.getNodeBefore(node));
  } else {
    return new DeleteRootEdit(node);
  }
}

export function edit_replace(
  text: string,
  ast: AST,
  node: ASTNode
): EditInterface {
  const parent = ast.getNodeParent(node);
  if (parent) {
    // if the text is the empty string, return a Deletion instead
    if (text === "") {
      return new DeleteChildEdit(node, parent, ast.getNodeBefore(node));
    }
    return new ReplaceChildEdit(text, node, parent);
  } else {
    return new ReplaceRootEdit(text, node);
  }
}

const CMB_TEXT_CHANGE_ORIGIN = "codemirror-blocks-change-origin";

/**
 * An object representing a change to some text.
 *
 * This is similar to a CodeMirror.EditorChange object except that
 * the origin is always CMB_TEXT_CHANGE_ORIGIN to distinguish it
 * from change objects that were created outside of codemirror-blocks.
 *
 * Rather than creating objects of this type directly, you should instead
 * use {@link makeChangeObject}.
 *
 * Rather than checking the value of `origin` directly, you should use
 * {@link isChangeObject}
 */
export type ChangeObject = {
  /** Position (in the pre-change coordinate system) where the change started. */
  from: Pos;
  /** Position (in the pre-change coordinate system) where the change ended. */
  to: Pos;
  /** Array of strings representing the text that replaced the changed range (split by line). */
  text: string[];
  /** Origin, which should always be cmb: to distinguish it from codemirror changes */
  origin: typeof CMB_TEXT_CHANGE_ORIGIN;
};

export function makeChangeObject({
  from,
  to,
  text,
}: {
  from: Pos;
  to: Pos;
  text: string[];
}): ChangeObject {
  return { from, to, text, origin: CMB_TEXT_CHANGE_ORIGIN };
}

export function isChangeObject(
  change: CodeMirror.EditorChange | ChangeObject
): change is ChangeObject {
  return change.origin === CMB_TEXT_CHANGE_ORIGIN;
}

/**
 * Converts an array of Edit objects into an array of change objects
 */
function editsToChange(
  edits: EditInterface[],
  ast: AST,
  text: ReadonlyRangedText
): ChangeObject[] {
  // Sort the edits from last to first, so that they don't interfere with
  // each other's source locations or indices.
  edits.sort((a, b) => poscmp(b.from, a.from));
  // Group edits by shared ancestor, so that edits so grouped can be made with a
  // single textual edit.
  const editToEditGroup = groupEditsByAncestor(
    edits.filter((edit): edit is AstEdit => edit instanceof AstEdit)
  );
  // Convert the edits into CodeMirror-style change objects
  // (with `from`, `to`, and `text`, but not `removed` or `origin`).
  const changeObjects: ChangeObject[] = [];
  for (const edit of edits) {
    const group = edit instanceof AstEdit && editToEditGroup.get(edit);
    if (group) {
      // Convert the group into a text edit.
      if (!group.completed) {
        changeObjects.push(group.toChangeObject());
        group.completed = true;
      }
    } else {
      if (edit.toChangeObject) {
        changeObjects.push(edit.toChangeObject(ast, text));
      }
    }
  }
  return changeObjects;
}

export function applyEdits(
  edits: EditInterface[],
  ast: AST,
  editor: CMBEditor,
  parse: Language["parse"]
): Result<{
  newAST: AST;
  changeObjects: ChangeObject[];
}> {
  const changeObjects = editsToChange(edits, ast, editor);
  // Validate the text edits.
  const result = speculateChanges(changeObjects, parse, editor.getValue());
  if (result.successful) {
    editor.applyChanges(changeObjects);
    return ok({ newAST: result.value, changeObjects });
  }
  return err(result.exception);
}

/**
 * performEdits : String, AST, Array<Edit>, Callback?, Callback? -> Void
 *
 * Attempt to commit a set of changes to CodeMirror. For more details, see the
 * `commitChanges` function. This function is identical to `commitChanges`,
 * except that this one takes higher-level `Edit` operations, constructed by the
 * functions: `edit_insert`, `edit_delete`, and `edit_replace`. Focus is
 * determined by the focus of the _last_ edit in `edits`.
 */
export const performEdits =
  (
    edits: EditInterface[],
    parse: Language["parse"],
    editor: CMBEditor,
    annt?: string
  ): AppThunk<Result<{ newAST: AST; focusId?: string | undefined }>> =>
  (dispatch, getState) => {
    // Perform the text edits, and update the ast.
    const result = applyEdits(edits, getState().ast, editor, parse);
    if (result.successful) {
      try {
        // update the ast.
        const changeResult = dispatch(
          commitChanges(
            result.value.changeObjects,
            parse,
            editor,
            false,
            // Use the focus hint from the last edit provided.
            (newAST: AST) => edits[edits.length - 1].focusHint(newAST),
            result.value.newAST,
            annt
          )
        );
        return changeResult;
      } catch (e) {
        logResults(getReducerActivities(), e);
        return err(e);
      }
    } else {
      return err(result.exception);
    }
  };

/**
 * @internal
 * Edits
 * NOTE(pcardune): I don't think this needs to be exported?
 *
 * Edits overwrite, delete or replace a *root* node.
 * Instances represent *top-level text operations*, and
 * can be directly converted into a CM changeObject
 */
export interface EditInterface {
  from: Pos;
  to: Pos;
  node?: ASTNode;
  toChangeObject?(ast: AST, text: ReadonlyRangedText): ChangeObject;
  focusHint(newAST: AST): ASTNode | "fallback";
  toString(): string;
}

function findDescendantNode(ancestor: ASTNode, id: string) {
  for (const node of ancestor.descendants()) {
    if (node.id === id) {
      return node;
    }
  }
  throw new Error(
    `performEdits: Could not find descendant ${id} of ${ancestor.type} ${ancestor.id}`
  );
}

abstract class Edit implements EditInterface {
  from: Pos;
  to: Pos;
  node?: ASTNode;
  constructor(from: Pos, to: Pos) {
    this.from = from;
    this.to = to;
  }

  toChangeObject?(ast: AST, text: ReadonlyRangedText): ChangeObject;

  // The default behavior for most edits
  focusHint(newAST: AST) {
    if (this.node) {
      const newNode = newAST.getNodeById(this.node.id);
      return (newNode && newAST.getNodeBefore(newNode)) || "fallback";
    }
    return newAST.getFirstRootNode() || "fallback";
  }

  toString() {
    return `${this.from.line}:${this.from.ch}-${this.to.line}:${this.to.ch}`;
  }
}

class OverwriteEdit extends Edit {
  text: string;
  changeObject?: ChangeObject;
  constructor(text: string, from: Pos, to: Pos) {
    super(from, to);
    this.text = text;
  }

  toChangeObject(ast: AST) {
    let { text } = this;
    // if this root starts or ends on the same line as another, insert a newline
    const nodeBefore = ast.rootNodes.find(
      (node) =>
        node.srcRange().to.line == this.from.line &&
        node.srcRange().to.ch <= this.from.ch
    );
    const nodeAfter = ast.rootNodes.find(
      (node) =>
        node.srcRange().from.line == this.to.line &&
        this.to.ch <= node.srcRange().from.ch
    );
    if (nodeBefore) {
      text = "\n" + text;
    }
    if (nodeAfter) {
      text = text + "\n";
    }
    this.changeObject = makeChangeObject({
      text: text.split("\n"),
      from: this.from,
      to: this.to,
    });
    return this.changeObject;
  }

  focusHint(newAST: AST) {
    if (this.changeObject) {
      return (
        newAST.getNodeBeforeCur(changeEnd(this.changeObject)) || "fallback"
      );
    } else {
      warn(
        "OverwriteEdit",
        `Cannot determine focus hint before .toChangeObject(ast) is called.`
      );
      return "fallback";
    }
  }

  toString() {
    return `Overwrite ${super.toString()}`;
  }
}

class DeleteRootEdit extends Edit {
  constructor(node: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  toChangeObject(_ast: AST, text: ReadonlyRangedText) {
    const { from, to } = removeWhitespace(this.from, this.to, text);
    return makeChangeObject({
      text: [""],
      from,
      to,
    });
  }

  toString() {
    return `DeleteRoot ${super.toString()}`;
  }
}

class ReplaceRootEdit extends Edit {
  text: string;
  node: ASTNode;
  constructor(text: string, node: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
  }

  toChangeObject() {
    return makeChangeObject({
      text: this.text.split("\n"),
      from: this.from,
      to: this.to,
    });
  }

  focusHint(newAST: AST) {
    return newAST.getNodeAfterCur(this.from) || "fallback";
  }

  toString() {
    return `ReplaceRoot ${super.toString()}="${this.text}"`;
  }
}

/**
 * @internal
 * AstEdits
 *
 * AstEdits insert, delete or replace a *child* node.
 * Instances *cannot* be directly converted to CM
 * changeObject for two reasons:
 * 1) Some user edits require additional text! E.g. -
 *    inserting a new fn variable may also require
 *    inserting a separator).
 * 2) The user-entered text may not obey pretty-printing
 *    rules, so the edit will need to made, the parent
 *    will need to be pretty-printed, and the *resulting
 *    parent code* will be the actual CM edit
 * These require an intermediate, context-aware step,
 * which is defined in the makeAstEdit() method.
 */
abstract class AstEdit extends Edit {
  parent: ASTNode;
  constructor(from: Pos, to: Pos, parent: ASTNode) {
    super(from, to);
    this.parent = parent;
  }
  abstract makeAstEdit(clonedAncestor: ClonedASTNode): void;
}

class InsertChildEdit extends AstEdit {
  text: string;
  pos: Pos;
  fakeAstInsertion: FakeAstInsertion;
  constructor(text: string, parent: ASTNode, field: string, pos: Pos) {
    super(pos, pos, parent);
    this.text = text;
    this.pos = pos;
    this.fakeAstInsertion = new FakeAstInsertion(this.parent, field, pos);
  }

  makeAstEdit(clonedAncestor: ClonedASTNode) {
    const clonedParent = findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstInsertion.insertChild(clonedParent, this.text);
  }

  focusHint(newAST: AST) {
    return this.fakeAstInsertion.findChild(newAST) || "fallback";
  }

  toString() {
    return `InsertChild ${super.toString()}`;
  }
}

class DeleteChildEdit extends AstEdit {
  node: ASTNode;
  private prevId?: string;
  fakeAstReplacement: FakeAstReplacement;
  constructor(node: ASTNode, parent: ASTNode, prev: ASTNode | null) {
    const range = node.srcRange();
    super(range.from, range.to, parent);
    this.node = node;
    this.prevId = prev?.id;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  focusHint(newAST: AST) {
    return (this.prevId && newAST.getNodeById(this.prevId)) || "fallback";
  }

  makeAstEdit(clonedAncestor: ClonedASTNode) {
    const clonedParent = findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstReplacement.deleteChild(clonedParent);
  }

  toString() {
    return `DeleteChild ${super.toString()}`;
  }
}

class ReplaceChildEdit extends AstEdit {
  text: string;
  node: ASTNode;
  fakeAstReplacement: FakeAstReplacement;

  constructor(text: string, node: ASTNode, parent: ASTNode) {
    const range = node.srcRange();
    super(range.from, range.to, parent);
    this.text = text;
    this.node = node;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  makeAstEdit(clonedAncestor: ClonedASTNode) {
    const clonedParent = findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstReplacement.replaceChild(clonedParent, this.text);
  }

  focusHint(newAST: AST) {
    return this.fakeAstReplacement.findChild(newAST) || "fallback";
  }

  toString() {
    return `ReplaceChild ${super.toString()}="${this.text}"`;
  }
}

/**
 * @internal
 * The EditGroup class
 *
 * Some edits can be grouped into an *editGroup*,
 * which can then be represented as a single CM
 * changeObject (e.g. - deleting multiple adjacent
 * siblings). An EditGroup represents this combination
 * and serves an an intermediary between one or more
 * AstEdits and the resulting CM changeObject.
 * (An Edit passes straight through.)
 */
class EditGroup {
  ancestor: ASTNode;
  edits: AstEdit[];
  completed?: boolean;

  constructor(ancestor: ASTNode, edits: AstEdit[]) {
    this.ancestor = ancestor;
    this.edits = edits;
  }

  toChangeObject(): ChangeObject {
    // Perform the edits on a copy of the shared ancestor node.
    const range = this.ancestor.srcRange();
    const clonedAncestor = cloneNode(this.ancestor);
    for (const edit of this.edits) {
      edit.makeAstEdit(clonedAncestor);
    }
    // Pretty-print to determine the new text.
    const width = prettyPrintingWidth - range.from.ch;
    const newText = clonedAncestor.pretty().display(width);
    return makeChangeObject({
      from: range.from,
      to: range.to,
      text: newText,
    });
  }
}

/**
 * @internal
 * Group edits by shared ancestor, so that edits so grouped can be made with a
 * single text replacement. Returns a Map from Edit to EditGroup.
 */
function groupEditsByAncestor(edits: AstEdit[]) {
  const editToEditGroup: Map<AstEdit, EditGroup> = new Map();
  // Group n AstEdits into m EditGroups (m <= n)
  for (const edit of edits) {
    // Start with the default assumption that this parent is independent.
    const group = new EditGroup(edit.parent, []);
    editToEditGroup.set(edit, group);
    // Check if any existing ancestors are below the parent.
    for (const [e, g] of editToEditGroup) {
      if (
        e !== edit &&
        srcRangeIncludes(edit.parent.srcRange(), g.ancestor.srcRange())
      ) {
        editToEditGroup.set(e, group);
      }
    }
    // Check if the parent is below an existing ancestor.
    for (const [e, g] of editToEditGroup) {
      if (
        e !== edit &&
        srcRangeIncludes(g.ancestor.srcRange(), edit.parent.srcRange())
      ) {
        editToEditGroup.set(edit, g);
        break; // Ancestors are disjoint; can only be contained in one.
      }
    }
  }
  // Associate each Edit with the parent EditGroup
  for (const edit of edits) {
    const group = editToEditGroup.get(edit);
    if (group) {
      group.edits.push(edit);
    }
  }
  return editToEditGroup;
}

/**
 * @internal
 * When deleting a root, don't leave behind excessive whitespace
 */
function removeWhitespace(from: Pos, to: Pos, text: ReadonlyRangedText) {
  const prevChar = text.getRange({ line: from.line, ch: from.ch - 1 }, from);
  const nextChar = text.getRange(to, { line: to.line, ch: to.ch + 1 });
  if (prevChar == " " && (nextChar == " " || nextChar == "")) {
    // Delete an excess space.
    return { from: { line: from.line, ch: from.ch - 1 }, to: to };
  } else if (nextChar == " " && prevChar == "") {
    // Delete an excess space.
    return { from: from, to: { line: to.line, ch: to.ch + 1 } };
  } else {
    return { from: from, to: to };
  }
}
