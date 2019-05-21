import {warn, poscmp, srcRangeIncludes} from '../utils';
import {prettyPrintingWidth} from '../ast';
import SHARED from '../shared';
import {commitChanges} from './commitChanges';
import {FakeAstInsertion, FakeAstReplacement, cloneNode} from './fakeAstEdits';


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
// functions: `edit_insert`, `edit_delete`, and `edit_replace`.
export function performEdits(label, ast, edits, onSuccess=()=>{}, onError=()=>{}) {
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
  // Convert the edits into text edits.
  let textEdits = new Array();
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
    if (group) {
      // Convert the group into a text edit.
      // If this group has already been visited, `toTextEdit` will return null.
      if (!group.completed) {
        textEdits.push(group.toTextEdit());
        group.completed = true;
      }
    } else {
      textEdits.push(edit.toTextEdit(ast));
    }
  }
  console.log(label, "edits:", edits, "textEdits:", textEdits); // temporary logging
  // Commit the text edits.
  const changes = cm => () => {
    for (const edit of textEdits) {
      cm.replaceRange(edit.text, edit.from, edit.to, label);
    }
  };
  commitChanges(changes, focusHint, onSuccess, onError);
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
}

class OverwriteEdit extends Edit {
  constructor(text, from, to) {
    super(from, to);
    this.text = text;
  }

  isTextEdit() {
    return true;
  }

  toTextEdit(ast) {
    let text = addWhitespace(ast, this.from, this.to, this.text);
    return {
      text,
      from: this.from,
      to: this.to
    };
  }

  focusHint(newAST) {
    return newAST.getNodeBeforeCur(this.to);
  }
}

class InsertChildEdit extends Edit {
  constructor(text, parent, field, pos) {
    super(pos, pos);
    this.text = text;
    this.parent = parent;
    this.pos = pos;
    this.fakeAstInsertion = new FakeAstInsertion(parent, field, pos);
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
}

class DeleteRootEdit extends Edit {
  constructor(node) {
    let range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
  }

  isTextEdit() {
    return true;
  }

  toTextEdit(_ast) {
    const {from, to} = removeWhitespace(this.from, this.to);
    return {
      text: "",
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
}

class DeleteChildEdit extends Edit {
  constructor(node, parent) {
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
}

class ReplaceRootEdit extends Edit {
  constructor(text, node) {
    let range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
  }

  isTextEdit() {
    return true;
  }

  toTextEdit(ast) {
    return {
      text: this.text,
      from: this.from,
      to: this.to
    };
  }

  focusHint(newAST) {
    return newAST.getNodeAfterCur(this.from);
  }
}

class ReplaceChildEdit extends Edit {
  constructor(text, node, parent) {
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
}

class EditGroup {
  constructor(ancestor, edits) {
    this.ancestor = ancestor;
    this.edits = edits;
  }

  toTextEdit() {
    // Perform the edits on a copy of the shared ancestor node.
    let range = this.ancestor.srcRange();
    let clonedAncestor = cloneNode(this.ancestor);
    for (const edit of this.edits) {
      edit.makeAstEdit(clonedAncestor);
    }
    // Return the text diff.
    let width = prettyPrintingWidth - range.from.ch;
    let newText = clonedAncestor.pretty().display(width).join("\n");
    return {
      from: range.from,
      to: range.to,
      text: newText
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
