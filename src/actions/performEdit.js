import {warn, poscmp, srcRangeIncludes} from '../utils';
import {prettyPrintingWidth} from '../ast';
import {commitChanges} from './commitChanges';
import SHARED from '../shared';


export function edit_insert(text, pos, parent=null) {
  if (parent) {
    return new InsertChildEdit(text, pos, parent);
  } else {
    return new InsertRootEdit(text, pos);
  }
}

export function edit_delete(node) {
  if (node.parent) {
    return new DeleteChildEdit(node, node.parent);
  } else {
    return new DeleteRootEdit(node);
  }
}

export function edit_replace(text, node) {
  if (node.parent) {
    return new ReplaceChildEdit(text, node, node.parent);
  } else {
    return new ReplaceRootEdit(text, node);
  }
}

export function performEdits(label, ast, edits, onSuccess=()=>{}, onError=()=>{}) {
  // Ensure that all of the edits are valid.
  for (const edit of edits) {
    if (!(edit instanceof Edit)) {
      throw new Error(`performEdits - invalid edit ${edit}: all edits must be instances of Edit.`);
    }
  }
  // Sort the edits from last to first, so that they don't interfere with
  // each other's source locations or indices.
  edits.sort((a, b) => poscmp(b.from, a.from));
  console.log("@? EDITS:", edits); // TODO: temporary logging
  // Group edits by shared ancestor, so that edits so grouped can be made with a
  // single textual edit.
  const editToEditGroup = groupEditsByAncestor(edits);
  // Convert the edits into text edits.
  let textEdits = new Array();
  for (const edit of edits) {
    let group = editToEditGroup.get(edit);
    if (group) {
      let textEdit = group.toTextEdit();
      if (textEdit) {
        textEdits.push(textEdit); // Non-root edit: edit is oldText->newText
      }
    } else {
      textEdits.push(edit.toTextEdit(ast)); // Root edit
    }
  }
  console.log("@? TEXT EDITS:", textEdits); // TODO: temporary logging
  // Commit the text edits.
  const changes = cm => () => {
    for (const edit of textEdits) {
      cm.replaceRange(edit.text, edit.from, edit.to, label);
    }
  };
  commitChanges(changes, onSuccess, onError);
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
    warn('edit', `Could not find descendant ${id} of ${ancestor.type} ${ancestor.id}`);
  }
}

class InsertRootEdit extends Edit {
  constructor(text, pos) {
    super(pos, pos);
    this.text = text;
    this.pos = pos;
  }

  isTextEdit() {
    return true;
  }

  toTextEdit(ast) {
    let text = addWhitespace(ast, this.pos, this.pos, this.text);
    return {
      text,
      from: this.pos,
      to: this.pos
    };
  }
}

class InsertChildEdit extends Edit {
  constructor(text, pos, parent) {
    super(pos, pos);
    this.text = text;
    this.pos = pos;
    this.parent = parent;
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(ancestor) {
    let parent = super.findDescendantNode(ancestor, this.parent.id);
    parent._insertChild(this.pos, this.text);
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

  toTextEdit(ast) {
    const {from, to} = removeWhitespace(this.from, this.to);
    return {
      text: "",
      from,
      to
    };
  }
}

class DeleteChildEdit extends Edit {
  constructor(node, parent) {
    let range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
    this.parent = parent;
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(ancestor) {
    let parent = super.findDescendantNode(ancestor, this.parent.id);
    parent._deleteChild(this.node);
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
      text: "",
      from: this.from,
      to: this.to
    };
  }
}

class ReplaceChildEdit extends Edit {
  constructor(text, node, parent) {
    let range = node.srcRange();
    super(range.from, range.to);
    this.text = text;
    this.node = node;
    this.parent = parent;
  }

  isTextEdit() {
    return false;
  }

  makeAstEdit(ancestor) {
    let parent = super.findDescendantNode(ancestor, this.parent.id);
    parent._replaceChild(this.node, text);
  }
}

class EditGroup {
  constructor(ancestor, edits) {
    this.ancestor = ancestor;
    this.edits = edits;
  }

  toTextEdit() {
    // Only perform the edit once.
    if (this.completed) return null;
    this.completed = true;
    // Perform the edits on a copy of the shared ancestor node.
    let range = this.ancestor.srcRange();
    let clonedAncestor = this.ancestor._clone();
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
      for (const [e, group] of editToEditGroup) {
        if (srcRangeIncludes(edit.parent.srcRange(), group.ancestor.srcRange())) {
          editToEditGroup.set(e, group);
        }
      }
      // Check if the parent is below an existing ancestor.
      for (const [_, group] of editToEditGroup) {
        if (srcRangeIncludes(group.ancestor.srcRange(), edit.parent.srcRange())) {
          editToEditGroup.set(edit, group);
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
