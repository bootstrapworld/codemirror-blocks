import * as P from 'pretty-fast-pretty-printer';
import {warn, poscmp, srcRangeContains} from '../utils';
import {Required, Optional, List, Value} from '../nodeSpec';
import {ASTNode} from '../ast';


// Say that you have the source code `[1, 3]`, representing a list, and you
// insert `2` at a drop target in between `1` and `3`. We ultimately represent
// all edits as text edits, so what text edit shoudl this be?
//
// It can't just be to insert `2`, because that would be a syntax error.
// Instead, the insertion needs to include a comma, like `, 2` or `2, `.
//
// How do we get this edit? We don't want to ask every AST node to know how to
// deal with edits like this: that would be a lot to ask.
//
// Instead, we rely entirely on the existing `.pretty()` method. To make this
// edit, we will:
//
// 1. Clone the list node (whose source code is `[1, 3]`).
// 2. Create a FakeInsertNode with the text `2`.
// 3. Add this FakeInsertNode to the cloned list node. This cloned list node now
//    has three children.
// 4. Call `.pretty()` on the cloned list node, producing the text `[1, 2, 3]`.
//    (The FakeInsertNode's `.pretty()` method will just return "2".)
// 5. Construct a text edit from this: `[1, 3] -> [1, 2, 3]`.
// 6. Perform the text edit.
// 7. Re-parse the document. If the parse is successful, we replace the old AST
//    with the newly parsed AST. If unsuccessful, we don't perform the edit.
//    (Note that the cloned list node and the FakeInsertNode never appeared in
//     any real AST: they weren't in the old AST, and they're not in the newly
//     parsed AST either.)
//
// This file knows how to perform fake AST edits (steps 2&3).


// Knows how to perform a fake insertion operation, and how to find the inserted
// child after the AST is re-parsed.
export class FakeAstInsertion {
  constructor(parent, fieldName, pos) {
    this.parent = parent;
    this.pos = pos;
    // Find the spec that matches the supplied field name.
    let spec = null;
    for (const s of parent.spec.childSpecs) {
      if (s instanceof List && s.fieldName === fieldName) {
        spec = s;
      }
    }
    if (spec === null) {
      warn('fakeAstEdits', "Failed to find list to insert child into.");
    }
    this.spec = spec;
    // If `pos` is null, that means the list is empty.
    if (pos === null) {
      this.index = 0;
      return;
    }
    // `pos` lies inside the list. Find out where.
    const list = parent[fieldName];
    for (const i in list) {
      if (poscmp(pos, list[i].srcRange().from) <= 0) {
        this.index = i;
        return;
      }
    }
    this.index = list.length;
    return;
  }

  insertChild(clonedParent, text) {
    const newChildNode = new FakeInsertNode(this.pos, this.pos, text);
    clonedParent[this.spec.fieldName].splice(this.index, 0, newChildNode);
  }

  // Find the inserted child. If more than one was inserted at once, find the
  // _last_.
  findChild(newAST) {
    const newParent = newAST.getNodeById(this.parent.id);
    if (!newParent) return null;
    const indexFromEnd = this.parent[this.spec.fieldName].length - this.index;
    const newIndex = newParent[this.spec.fieldName].length - indexFromEnd - 1;
    return newParent[this.spec.fieldName][newIndex];
  }
}

// Knows how to perform a fake replacement or deletion operation, and how to
// find the replaced child.
export class FakeAstReplacement {
  constructor(parent, child) {
    this.parent = parent;
    this.child = child;
    for (const spec of parent.spec.childSpecs) {
      const field = parent[spec.fieldName];
      if (spec instanceof Required && field.id === child.id) {
        this.spec = spec;
        return;
      } else if (spec instanceof Optional && field && field.id === child.id) {
        this.spec = spec;
        return;
      } else if (spec instanceof List) {
        for (const i in field) {
          if (field[i].id === child.id) {
            this.spec = spec;
            this.index = i;
            return;
          }
        }
      }
    }
    warn('new ReplacementPoint', "Failed to find child to be replaced/deleted.");
  }

  replaceChild(clonedParent, text) {
    const newChildNode = new FakeInsertNode(this.child.from, this.child.to, text);
    if (this.index) {
      clonedParent[this.spec.fieldName][this.index] = newChildNode;
    } else {
      clonedParent[this.spec.fieldName] = newChildNode;
    }
  }

  deleteChild(clonedParent) {
    if (this.index) {
      clonedParent[this.spec.fieldName].splice(this.index, 1); // Remove the i'th element.
    } else if (this.spec instanceof Optional) {
      clonedParent[this.spec.fieldName] = null;
    } else {
      clonedParent[this.spec.fieldName] = new FakeBlankNode(this.child.from, this.child.to);
    }
  }

  // Call only if you used `replaceChild`, not `deleteChild`.
  findChild(newAST) {
    const newParent = newAST.getNodeById(this.parent.id);
    if (!newParent) return null;
    if (this.index) {
      return this.parent[this.spec.fieldName][this.index];
    } else {
      return this.parent[this.spec.fieldName];
    }
  }
}

// A fake ASTNode that just prints itself with the given text.
class FakeInsertNode extends ASTNode {
  constructor(from, to, text, options={}) {
    super(from, to, 'fakeInsertNode', options);
    this.text = text;
  }

  toDescription(level) {
    return "";
  }

  pretty() {
    return P.txt(this.text);
  }

  render(props) {
    warn('fakeAstEdits', "FakeInsertNode didn't expect to be rendered!");
  }
}

// A fake ASTNode that just prints itself like a Blank.
class FakeBlankNode extends ASTNode {
  constructor(from, to, options={}) {
    super(from, to, 'fakeBlankNode', options);
  }

  toDescription(level) {
    return "";
  }

  pretty() {
    return P.txt("...");
  }

  render(props) {
    warn('fakeAstEdits', "FakeBlankNode didn't expect to be rendered!");
  }
}

// Make a copy of a node, to perform fake edits on (so that the fake edits don't
// show up in the real AST). This copy will be deep over the ASTNodes, but
// shallow over the non-ASTNode values they contain.
export function cloneNode(oldNode) {
  let newNode = new ASTNode(oldNode.from, oldNode.to, oldNode.type, oldNode.options);
  for (const spec of oldNode.spec.childSpecs) {
    if (spec instanceof Required || spec instanceof Optional) {
      if (oldNode[spec.fieldName]) {
        newNode[spec.fieldName] = cloneNode(oldNode[spec.fieldName]);
      } else {
        newNode[spec.fieldName] = null;
      }
    } else if (spec instanceof Value) {
      newNode[spec.fieldName] = oldNode[spec.fieldName];
    } else if (spec instanceof List) {
      newNode[spec.fieldName] = oldNode[spec.fieldName].map(cloneNode);
    }
  }
  newNode.type = oldNode.type;
  newNode.id = oldNode.id;
  newNode.hash = oldNode.hash;
  newNode.spec = oldNode.spec;
  newNode.pretty = oldNode.pretty;
  return newNode;
}
