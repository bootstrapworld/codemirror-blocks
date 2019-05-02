import {srcRangeIncludes} from '../utils';
import {prettyPrintingWidth} from '../ast';
import {commitChanges} from './commitChanges';


export function edit_insert(text, pos, parent, label) {
  if (parent) {
    return new InsertChildEdit(text, pos, parent, label);
  } else {
    return new InsertRootEdit(text, pos, label);
  }
}

export function edit_delete(node, label) {
  if (node.parent) {
    return new DeleteChildEdit(node, node.parent, label);
  } else {
    return new DeleteRootEdit(node, label);
  }
}

export function edit_replace(text, node, label) {
  if (node.parent) {
    return new ReplaceChildEdit(text, node, node.parent, label);
  } else {
    return new ReplaceRootEdit(text, node, label);
  }
}

export function performEdits(edits, ast) {
  // Ensure that all of the edits are valid.
  for (const edit of edits) {
    if (!(edit instanceof Edit)) {
      throw new Error(`performEdits - invalid edit ${edit}: all edits must be instances of Edit.`);
    }
  }
  // Sort the edits from last to first, so that they don't interfere with
  // each other's source locations or indices.
  edits.sort((a, b) => poscmp(b.from, a.from));
  // Group edits by shared ancestor, so that edits so grouped can be made with a
  // single textual edit.
  const editToEditGroup = groupEditsByAncestor(edits);
  // Convert the edits into text edits.
  let textEdits = new Array();
  for (const edit of edits) {
    if (let group = editToEditGroup[edit]) {
      if (let textEdit = group.toTextEdit()) {
        textEdits.push(textEdit); // Non-root edit: edit is oldText->newText
      }
    } else {
      textEdits.push(edit.toTextEdit(ast)); // Root edit
    }
  }
  // Commit the text edits.
  commitChanges(cm => () => {
    for (const edit of textEdits) {
      cm.replaceRange(edit.text, edit.from, edit.to, edit.label);
    }
  });
}


class Edit() {
  constructor(from, to, label) {
    this.from = from;
    this.to = to;
    this.label = label;
  }

  findDescendantNode(ancestor, id) {
    for (const node of ancestor.descendants()) {
      if (node.id === id) {
        return node;
      }
    }
  }
}

class InsertRootEdit extends Edit {
  constructor(text, pos, label) {
    super(pos, pos, label);
    this.text = text;
    this.pos = pos;
  }

  isTextEdit() {
    return true;
  }

  toTextEdit(ast) {
    let text = addWhitespace(this.pos, this.pos, this.text);
    return {
      text,
      from: this.pos,
      to: this.pos,
      label: this.label
    };
  }
}

class InsertChildEdit extends Edit {
  constructor(text, pos, parent, label) {
    super(pos, pos, label);
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
  constructor(node, label) {
    let range = this.node.srcRange();
    super(range.from, range.to, label);
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
      to,
      label: this.label
    };
  }
}

class DeleteChildEdit extends Edit {
  constructor(node, parent, label) {
    let range = this.node.srcRange();
    super(range.from, range.to, label);
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
  constructor(text, node, label) {
    let range = this.node.srcRange();
    super(range.from, range.to, label);
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
      to: this.to,
      label: this.label
    };
  }
}

class ReplaceChildEdit extends Edit {
  constructor(text, node, parent, label) {
    let range = this.node.srcRange();
    super(range.from, range.to, label);
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
      text: newText,
      label: this.edits[0].label
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
      editToEditGroup[edit] = group;
      // Check if any existing ancestors are below the parent.
      for (const [e, group] of editToEditGroup) {
        if (srcRangeIncludes(edit.parent.srcRange(), group.ancestor.srcRange())) {
          editToEditGroup[e] = group;
        }
      }
      // Check if the parent is below an existing ancestor.
      for (const [_, group] of editToEditGroup) {
        if (srcRangeIncludes(group.ancestor.srcRange(), edit.parent.srcRange())) {
          editToEditGroup[edit] = group;
          break; // Ancestors are disjoint; can only be contained in one.
        }
      }
    }
  }
  // Fill out the edit list of each edit group.
  for (const edit of edits) {
    if (let group = editToEditGroup[edit]) {
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
function addWhitespace(from, to, text) {
  // We may need to insert a space to ensure that different tokens don't end up
  // getting glommed together.
  let prevChar = SHARED.cm.getRange({line: from.line, ch: from.ch - 1}, from);
  let nextChar = SHARED.cm.getRange(to, {line: to.line, ch: to.ch + 1});
  if (!(prevChar == "" || prevChar == " ")) {
    text = " " + text;
  }
  if (!(nextChar == "" || nextChar == " ")) {
    text = text + " ";
  }
  return text;
}

// Get the text from `from` to `to`, but padded with newlines as needed to
// prevent comments from (i) commenting out code or (ii) becoming associated
// with the wrong node.
export function copyTextWithPadding(ast, from, to, needsPrecedingNewline) {
  if (ast.followsComment(from) || needsPrecedingNewline) {
    text = "\n" + text;
  }
  if (ast.precedesComment(to)) {
    text = text + "\n";
  }
  return text;
}
