import {
  warn,
  poscmp,
  srcRangeIncludes,
  changeEnd,
  logResults,
} from "../utils";
import { AST, ASTNode, Pos, prettyPrintingWidth } from "../ast";
import SHARED from "../shared";
import { commitChanges } from "./commitChanges";
import { speculateChanges } from "./speculateChanges";
import {
  FakeAstInsertion,
  FakeAstReplacement,
  cloneNode,
  ClonedASTNode,
} from "./fakeAstEdits";
import { store } from "../store";
import type { EditorChange } from "codemirror";
import { getReducerActivities } from "../reducers";

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
): Edit {
  return new InsertChildEdit(text, parent, field, pos);
}

export function edit_overwrite(text: string, from: Pos, to: Pos): Edit {
  return new OverwriteEdit(text, from, to);
}

export function edit_delete(node: ASTNode): Edit {
  if (node.parent) {
    return new DeleteChildEdit(node, node.parent);
  } else {
    return new DeleteRootEdit(node);
  }
}

export function edit_replace(text: string, node: ASTNode): Edit {
  if (node.parent) {
    // if the text is the empty string, return a Deletion instead
    if (text === "") {
      return new DeleteChildEdit(node, node.parent);
    }
    return new ReplaceChildEdit(text, node, node.parent);
  } else {
    return new ReplaceRootEdit(text, node);
  }
}

export type OnSuccess = (r: { newAST: AST; focusId: string }) => void;
export type OnError = (e: any) => void;

/**
 * performEdits : String, AST, Array<Edit>, Callback?, Callback? -> Void
 *
 * Attempt to commit a set of changes to CodeMirror. For more details, see the
 * `commitChanges` function. This function is identical to `commitChanges`,
 * except that this one takes higher-level `Edit` operations, constructed by the
 * functions: `edit_insert`, `edit_delete`, and `edit_replace`. Focus is
 * determined by the focus of the _last_ edit in `edits`.
 */
export function performEdits(
  origin: string,
  ast: AST,
  edits: Edit[],
  parse: (code: string) => AST,
  onSuccess: OnSuccess = (r: { newAST: AST; focusId: string }) => {},
  onError: OnError = (e: any) => {},
  annt?: string
) {
  // Ensure that all of the edits are valid.
  //console.log('XXX performEdits:55 doing performEdits');
  for (const edit of edits) {
    if (!(edit instanceof Edit)) {
      throw new Error(
        `performEdits - invalid edit ${edit}: all edits must be instances of Edit.`
      );
    }
  }
  // Use the focus hint from the last edit provided.
  const lastEdit = edits[edits.length - 1];
  const focusHint = (newAST: AST) => lastEdit.focusHint(newAST);
  // Sort the edits from last to first, so that they don't interfere with
  // each other's source locations or indices.
  edits.sort((a, b) => poscmp(b.from, a.from));
  // Group edits by shared ancestor, so that edits so grouped can be made with a
  // single textual edit.
  const editToEditGroup = groupEditsByAncestor(edits);
  // Convert the edits into CodeMirror-style change objects
  // (with `from`, `to`, and `text`, but not `removed` or `origin`).
  let changeArray: EditorChange[] = new Array();
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
    if (group) {
      // Convert the group into a text edit.
      if (!group.completed) {
        changeArray.push(group.toChangeObject());
        group.completed = true;
      }
    } else {
      if (edit.toChangeObject) {
        changeArray.push(edit.toChangeObject(ast));
      }
    }
  }
  //console.log(origin, "edits:", edits, "changeArray:", changeArray); // temporary logging
  /* More detailed logging:
  console.log(`${origin} - edits:`);
  for (let edit of edits) {
    console.log(`    ${edit.toString()}`);
  }
  console.log(`${origin} - text edits:`);
  for (let edit of changeArray) {
    console.log(`    ${edit.from.line}:${edit.from.ch}-${edit.to.line}:${edit.to.ch}="${edit.text}"`);
  }
  */
  // Set the origins
  for (const c of changeArray) {
    c.origin = origin;
  }
  // Validate the text edits.
  let result = speculateChanges(changeArray, parse);
  if (result.successful) {
    try {
      // Perform the text edits, and update the ast.
      SHARED.cm.operation(() => {
        for (let c of changeArray) {
          SHARED.cm.replaceRange(c.text, c.from, c.to, c.origin);
        }
      });
      //console.log('XXX performEdits:110 calling commitChanges');
      let { newAST, focusId } = commitChanges(
        changeArray,
        parse,
        false,
        focusHint,
        result.newAST,
        annt
      );
      onSuccess({ newAST, focusId });
    } catch (e) {
      logResults(getReducerActivities(), e);
    }
  } else {
    onError(result.exception);
  }
}

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
  toChangeObject?(ast: AST): EditorChange;
  findDescendantNode(ancestor: ASTNode, id: string): ASTNode;
  focusHint(newAST: AST): ASTNode | "fallback";
  toString(): string;
}

abstract class Edit implements EditInterface {
  from: Pos;
  to: Pos;
  node?: ASTNode;
  constructor(from: Pos, to: Pos) {
    this.from = from;
    this.to = to;
  }

  toChangeObject?(ast: AST): EditorChange;

  findDescendantNode(ancestor: ASTNode, id: string) {
    for (const node of ancestor.descendants()) {
      if (node.id === id) {
        return node;
      }
    }
    warn(
      "performEdits",
      `Could not find descendant ${id} of ${ancestor.type} ${ancestor.id}`
    );
  }

  // The default behavior for most edits
  focusHint(newAST: AST) {
    return !this.node.prev
      ? newAST.getFirstRootNode()
      : newAST.getNodeById(this.node.prev.id) || "fallback";
  }

  toString() {
    return `${this.from.line}:${this.from.ch}-${this.to.line}:${this.to.ch}`;
  }
}

class OverwriteEdit extends Edit {
  text: string;
  changeObject?: {
    text: string[];
    from: Pos;
    to: Pos;
  };
  constructor(text: string, from: Pos, to: Pos) {
    super(from, to);
    this.text = text;
  }

  toChangeObject(ast: AST) {
    let { from, to, text } = this;
    // if this root starts or ends on the same line as another, insert a newline
    const nodeBefore = ast.rootNodes.find(
      (r) => r.to.line == from.line && r.to.ch <= from.ch
    );
    const nodeAfter = ast.rootNodes.find(
      (r) => r.from.line == to.line && to.ch <= r.from.ch
    );
    if (nodeBefore) {
      text = "\n" + text;
    }
    if (nodeAfter) {
      text = text + "\n";
    }
    this.changeObject = {
      text: text.split("\n"),
      from: this.from,
      to: this.to,
    };
    return this.changeObject;
  }

  focusHint(newAST: AST) {
    if (this.changeObject) {
      return newAST.getNodeBeforeCur(changeEnd(this.changeObject));
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
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  toChangeObject(_ast: AST) {
    const { from, to } = removeWhitespace(this.from, this.to);
    return {
      text: [""],
      from,
      to,
    };
  }

  toString() {
    return `DeleteRoot ${super.toString()}`;
  }
}

class ReplaceRootEdit extends Edit {
  text: string;
  node: ASTNode;
  constructor(text: string, node: ASTNode) {
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
  }

  toChangeObject(_ast: AST) {
    return {
      text: this.text.split("\n"),
      from: this.from,
      to: this.to,
    };
  }

  focusHint(newAST: AST) {
    return newAST.getNodeAfterCur(this.from);
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
    this.parent = getNode(parent);
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
    let clonedParent = super.findDescendantNode(clonedAncestor, this.parent.id);
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
  fakeAstReplacement: FakeAstReplacement;
  constructor(node: ASTNode, parent: ASTNode) {
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to, parent);
    this.node = node;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  makeAstEdit(clonedAncestor: ClonedASTNode) {
    const clonedParent = super.findDescendantNode(
      clonedAncestor,
      this.parent.id
    );
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
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to, parent);
    this.text = text;
    this.node = node;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  makeAstEdit(clonedAncestor: ClonedASTNode) {
    let clonedParent = super.findDescendantNode(clonedAncestor, this.parent.id);
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
  edits: Edit[];
  completed?: boolean;

  constructor(ancestor: ASTNode, edits: AstEdit[]) {
    this.ancestor = getNode(ancestor);
    this.edits = edits;
  }

  toChangeObject() {
    // Perform the edits on a copy of the shared ancestor node.
    let range = this.ancestor.srcRange();
    let clonedAncestor = cloneNode(this.ancestor);
    for (const edit of this.edits) {
      if (edit instanceof AstEdit) {
        edit.makeAstEdit(clonedAncestor);
      }
    }
    // Pretty-print to determine the new text.
    let width = prettyPrintingWidth - range.from.ch;
    let newText = clonedAncestor.pretty().display(width);
    return {
      from: range.from,
      to: range.to,
      text: newText,
    };
  }
}

/**
 * @internal
 * Group edits by shared ancestor, so that edits so grouped can be made with a
 * single text replacement. Returns a Map from Edit to EditGroup.
 */
function groupEditsByAncestor(edits: Edit[]) {
  let editToEditGroup: Map<Edit, EditGroup> = new Map(); // {Edit: EditGroup}
  // Group n AstEdits into m EditGroups (m <= n)
  for (const edit of edits) {
    if (edit instanceof AstEdit) {
      // Start with the default assumption that this parent is independent.
      let group = new EditGroup(edit.parent, []);
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
  }
  // Associate each Edit with the parent EditGroup
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
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
function removeWhitespace(from: Pos, to: Pos) {
  let prevChar = SHARED.cm.getRange({ line: from.line, ch: from.ch - 1 }, from);
  let nextChar = SHARED.cm.getRange(to, { line: to.line, ch: to.ch + 1 });
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

/**
 * @internal
 * Ensure that we are getting the most up-to-date ASTNode
 * for a given node ID
 */
function getNode(node: ASTNode) {
  let { ast } = store.getState();
  return ast.getNodeById(node.id);
}
