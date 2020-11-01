import {warn, poscmp, srcRangeIncludes, changeEnd, logResults} from '../utils';
import {prettyPrintingWidth} from '../ast';
import SHARED from '../shared';
import {commitChanges} from './commitChanges';
import {speculateChanges} from './speculateChanges';
import {FakeAstInsertion, FakeAstReplacement, cloneNode} from './fakeAstEdits';
import {store} from '../store';

// edit_insert : String, ASTNode, String, Pos -> Edit
//
// Construct an edit to insert `text` in the list `parent.field` at the given `pos`.
export function edit_insert(text, parent, field, pos) {
  return new InsertChildEdit(text, parent, field, pos);
}

// edit_overwrite : String, Pos, Pos -> Edit
//
// Construct an edit to replace a range of source code with `text`. The range
// must be at the toplevel: it can neither begin nor end inside a root node.
export function edit_overwrite(text, from, to) {
  return new OverwriteEdit(text, from, to);
}

// edit_delete : ASTNode -> Edit
//
// Construct an edit to delete the given node.
export function edit_delete(node) {
  if (node.parent) {
    return new DeleteChildEdit(node, node.parent);
  } else {
    return new DeleteRootEdit(node);
  }
}

// edit_replace : String, ASTNode -> Edit
//
// Construct an edit to replace `node` with `text`.
export function edit_replace(text, node) {
  if (node.parent) {
    return new ReplaceChildEdit(text, node, node.parent);
  } else {
    return new ReplaceRootEdit(text, node);
  }
}

// performEdits : String, AST, Array<Edit>, Callback?, Callback? -> Void
//
// Attempt to commit a set of changes to Code Mirror. For more details, see the
// `commitChanges` function. This function is identical to `commitChanges`,
// except that this one takes higher-level `Edit` operations, constructed by the
// functions: `edit_insert`, `edit_delete`, and `edit_replace`. Focus is
// determined by the focus of the _last_ edit in `edits`.
export function performEdits(origin, ast, edits, onSuccess=()=>{}, onError=()=>{}, annt) {
  // Ensure that all of the edits are valid.
  for (const edit of edits) {
    if (!(edit instanceof Edit)) {
      throw new Error(`performEdits - invalid edit ${edit}: all edits must be instances of Edit.`);
    }
  }
  // Use the focus hint from the last edit provided.
  const lastEdit = edits[edits.length - 1];
  const focusHint = (newAST) => lastEdit.focusHint(newAST);
  // Sort the edits from last to first, so that they don't interfere with
  // each other's source locations or indices.
  edits.sort((a, b) => poscmp(b.from, a.from));
  // Group edits by shared ancestor, so that edits so grouped can be made with a
  // single textual edit.
  const editToEditGroup = groupEditsByAncestor(edits);
  // Convert the edits into CodeMirror-style change objects
  // (with `from`, `to`, and `text`, but not `removed` or `origin`).
  let changeArray = new Array();
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
    if (group) {
      // Convert the group into a text edit.
      if (!group.completed) {
        changeArray.push(group.toChangeObject());
        group.completed = true;
      }
    } else {
      changeArray.push(edit.toChangeObject(ast));
    }
  }
  console.log(origin, "edits:", edits, "changeArray:", changeArray); // temporary logging
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
  let result = speculateChanges(changeArray);
  if (result.successful) {
    try {
    // Perform the text edits, and update the ast.
    SHARED.cm.operation(() => {
      for (let c of changeArray) {
        SHARED.cm.replaceRange(c.text, c.from, c.to, c.origin);
      }
    });
    let {newAST, focusId} = commitChanges(changeArray, false, focusHint, result.newAST, annt);
    onSuccess({newAST, focusId});
    } catch(e) {
      logResults(window.reducerActivities, e);
    }
  } else {
    onError(result.exception);
  }
}

class Edit {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  findDescendantNode(ancestor, id) {
    for (const node of ancestor.descendants()) {
      if (node.id === id) {
        return node;
      }
    }
    warn('performEdits', `Could not find descendant ${id} of ${ancestor.type} ${ancestor.id}`);
  }

  toString() {
    return `${this.from.line}:${this.from.ch}-${this.to.line}:${this.to.ch}`;
  }
}

class OverwriteEdit extends Edit {
  constructor(text, from, to) {
    super(from, to);
    this.text = text;
  }

  isTextEdit() {
    return true;
  }

  toChangeObject(ast) {
    let text = addWhitespace(ast, this.from, this.to, this.text);
    this.changeObject = {
      text: text.split("\n"),
      from: this.from,
      to: this.to
    };
    return this.changeObject;
  }

  focusHint(newAST) {
    if (this.changeObject) {
      return newAST.getNodeBeforeCur(changeEnd(this.changeObject));
    } else {
      warn('OverwriteEdit', `Cannot determine focus hint before .toChangeObject(ast) is called.`);
      return "fallback";
    }
  }

  toString() {
    return `Overwrite ${super.toString()}`;
  }
}

class InsertChildEdit extends Edit {
  constructor(text, parent, field, pos) {
    super(pos, pos);
    this.text = text;
    this.parent = getNode(parent);
    this.pos = pos;
    this.fakeAstInsertion = new FakeAstInsertion(this.parent, field, pos);
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(clonedAncestor) {
    let clonedParent = super.findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstInsertion.insertChild(clonedParent, this.text);
  }

  focusHint(newAST) {
    return this.fakeAstInsertion.findChild(newAST) || "fallback";
  }

  toString() {
    return `InsertChild ${super.toString()}`;
  }
}

class DeleteRootEdit extends Edit {
  constructor(node) {
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  isTextEdit() {
    return true;
  }

  toChangeObject(_ast) {
    const {from, to} = removeWhitespace(this.from, this.to);
    return {
      text: [""],
      from,
      to
    };
  }

  focusHint(newAST) {
    if (this.node.prev) {
      return newAST.getNodeById(this.node.prev.id) || "fallback";
    } else {
      return newAST.getFirstRootNode();
    }
  }

  toString() {
    return `DeleteRoot ${super.toString()}`;
  }
}

class DeleteChildEdit extends Edit {
  constructor(node, parent) {
    node = getNode(node);
    parent = getNode(parent);
    let range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
    this.parent = parent;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(clonedAncestor) {
    const clonedParent = super.findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstReplacement.deleteChild(clonedParent);
  }

  focusHint(newAST) {
    if (this.node.prev) {
      return newAST.getNodeById(this.node.prev.id) || "fallback";
    } else {
      return newAST.getFirstRootNode();
    }
  }

  toString() {
    return `DeleteChild ${super.toString()}`;
  }
}

class ReplaceRootEdit extends Edit {
  constructor(text, node) {
    node = getNode(node);
    let range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
  }

  isTextEdit() {
    return true;
  }

  toChangeObject(_ast) {
    return {
      text: this.text.split("\n"),
      from: this.from,
      to: this.to
    };
  }

  focusHint(newAST) {
    return newAST.getNodeAfterCur(this.from);
  }

  toString() {
    return `ReplaceRoot ${super.toString()}="${this.text}"`;
  }
}

class ReplaceChildEdit extends Edit {
  constructor(text, node, parent) {
    node = getNode(node);
    parent = getNode(parent);
    let range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
    this.parent = parent;
    this.fakeAstReplacement = new FakeAstReplacement(parent, node);
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(clonedAncestor) {
    let clonedParent = super.findDescendantNode(clonedAncestor, this.parent.id);
    this.fakeAstReplacement.replaceChild(clonedParent, this.text);
  }

  focusHint(newAST) {
    return this.fakeAstReplacement.findChild(newAST) || "fallback";
  }

  toString() {
    return `ReplaceChild ${super.toString()}="${this.text}"`;
  }
}

class EditGroup {
  constructor(ancestor, edits) {
    this.ancestor = getNode(ancestor);
    this.edits = edits;
  }

  toChangeObject() {
    // Perform the edits on a copy of the shared ancestor node.
    let range = this.ancestor.srcRange();
    let clonedAncestor = cloneNode(this.ancestor);
    for (const edit of this.edits) {
      edit.makeAstEdit(clonedAncestor);
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

// Group edits by shared ancestor, so that edits so grouped can be made with a
// single text replacement. Returns a Map from Edit to EditGroup.
function groupEditsByAncestor(edits) {
  let editToEditGroup = new Map(); // {Edit: EditGroup}
  for (const edit of edits) {
    if (!edit.isTextEdit()) {
      // Start with the default assumption that this parent is independent.
      let group = new EditGroup(edit.parent, []);
      editToEditGroup.set(edit, group);
      // Check if any existing ancestors are below the parent.
      for (const [e, g] of editToEditGroup) {
        if (e !== edit && srcRangeIncludes(edit.parent.srcRange(), g.ancestor.srcRange())) {
          editToEditGroup.set(e, group);
        }
      }
      // Check if the parent is below an existing ancestor.
      for (const [e, g] of editToEditGroup) {
        if (e !== edit && srcRangeIncludes(g.ancestor.srcRange(), edit.parent.srcRange())) {
          editToEditGroup.set(edit, g);
          break; // Ancestors are disjoint; can only be contained in one.
        }
      }
    }
  }
  // Fill out the edit list of each edit group.
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
    if (group) {
      group.edits.push(edit);
    }
  }
  return editToEditGroup;
}

// If deleting a block would leave behind excessive whitespace, delete some of
// that whitespace.
function removeWhitespace(from, to) {
  let prevChar = SHARED.cm.getRange({line: from.line, ch: from.ch - 1}, from);
  let nextChar = SHARED.cm.getRange(to, {line: to.line, ch: to.ch + 1});
  if (prevChar == " " && (nextChar == " " || nextChar == "")) {
    // Delete an excess space.
    return {from: {line: from.line, ch: from.ch - 1}, to: to};
  } else if (nextChar == " " && prevChar == "") {
    // Delete an excess space.
    return {from: from, to: {line: to.line, ch: to.ch + 1}};
  } else {
    return {from: from, to: to};
  }
}

// Pad `text` with spaces as needed, when a block will be inserted.
export function addWhitespace(ast, from, to, text) {
  // We may need to insert a newline to make sure that comments don't end up
  // getting associated with the wrong node, and we may need to insert a space
  // to ensure that different tokens don't end up getting glommed together.
  let prevChar = SHARED.cm.getRange({line: from.line, ch: from.ch - 1}, from);
  let nextChar = SHARED.cm.getRange(to, {line: to.line, ch: to.ch + 1});
  if (ast.followsComment(from) && prevChar != "") {
    text = "\n" + text;
  } else if (!(prevChar == "" || prevChar == " ")) {
    text = " " + text;
  }
  if (ast.precedesComment(to) && nextChar != "") {
    text = text + "\n";
  } else if (!(nextChar == "" || nextChar == " ")) {
    text = text + " ";
  }
  return text;
}

function getNode(node) {
  let {ast} = store.getState();
  return ast.getNodeById(node.id);
}
