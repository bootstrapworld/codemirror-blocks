import SHARED from './shared';
import {edit_replace, edit_insert, edit_replaceToplevelText} from './edits/performEdits';


// A _Target_ says where an action is directed. For example, a target may be a
// node or a drop target.
//
// These kinds of actions _have_ a target:
//
// - Paste: the target says where to paste.
// - Drag&Drop: the target says what's being dropped on.
// - Insert/Edit: the target says where the text is being inserted/edited.


// Target a node. This will overwrite the node.
export function node(n) {
  return new NodeTarget(n);
}

// Target a DropTarget. 
export function dropTarget(pos, parentNode) {
  return new DropTargetTarget(pos, parentNode);
}

// Target a source range at the top level. This really has to be at the top
// level: neither `from` nor `to` can be inside any root node.
export function topLevel(from, to) {
  return new TopLevelTarget(from, to);
}

// Target just to the left of a node.
export function leftOf(node) {
  if (node.parent) {
    return new DropTargetTarget(node.srcRange().from, node.parent);
  } else {
    const pos = node.srcRange().from;
    return new TopLevelTarget(pos, pos);
  }
}

// Target just to the right of a node.
export function rightOf(node) {
  if (node.parent) {
    return new DropTargetTarget(node.srcRange().to, node.parent);
  } else {
    const pos = node.srcRange().to;
    return new TopLevelTarget(pos, pos);
  }
}


export class Target {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  srcRange() {
    return {from: this.from, to: this.to};
  }
}

class NodeTarget extends Target {
  constructor(node) {
    const range = node.srcRange();
    super(range.from, range.to);
    this.node = node;
    if (this.node.parent) {
      this.replacementPoint = node.parent._findReplacementPoint(node);
    }
  }

  getText() {
    return SHARED.cm.getRange(this.from, this.to);
  }

  toEdit(text) {
    return edit_replace(text, this.node);
  }

  findMe(newAST) {
    if (this.replacementPoint) {
      return this.replacementPoint.findChild(newAST);
    } else {
      return ast.getNodeAfterCur(this.from);
    }
  }
}

class DropTargetTarget extends Target {
  constructor(pos, parent) {
    super(pos, pos);
    this.parent = parent;
    this.insertionPoint = parent._findInsertionPoint(pos);
  }

  getText() {
    return "";
  }

  toEdit(text) {
    return edit_insert(text, this.from, this.parent);
  }

  findMe(newAST) {
    return this.insertionPoint.findChild(newAST);
  }
}

class TopLevelTarget extends Target {
  constructor(from, to) {
    super(from, to);
  }

  getText() {
    return SHARED.cm.getRange(this.from, this.to);
  }

  toEdit(text) {
    if (this.from === this.to) {
      return edit_insert(text, this.from);
    } else {
      return edit_replaceToplevelText(text, this.from, this.to);
    }
  }

  findMe(newAST) {
    return newAST.getNodeAfterCur(this.from);
  }
}
