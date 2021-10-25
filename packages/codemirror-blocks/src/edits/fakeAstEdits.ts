import * as P from "pretty-fast-pretty-printer";
import { warn, poscmp } from "../utils";
import { Required, Optional, List, Value } from "../nodeSpec";
import { ASTNode, NodeFields, UnknownFields } from "../ast";
import type { AST, Pos } from "../ast";
import { playSound, BEEP } from "../utils";

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
  parent: ASTNode;
  pos: Pos;
  spec: List;
  index: number;
  constructor(parent: ASTNode, fieldName: string, pos: Pos) {
    this.parent = parent;
    this.pos = pos;
    // Find the spec that matches the supplied field name.
    let spec: List | null = null;
    for (const s of parent.spec.childSpecs) {
      if (s instanceof List && s.fieldName === fieldName) {
        spec = s;
      }
    }
    if (spec === null) {
      throw new Error(
        "fakeAstEdits: Failed to find list to insert child into."
      );
    }
    this.spec = spec;
    // If `pos` is null, that means the list is empty.
    if (pos === null) {
      this.index = 0;
      return;
    }
    // `pos` lies inside the list. Find out where.
    const list = spec.getField(parent);
    // ideally, we'd use for(i in list) {...} here, but some badly-behaved
    // IDEs monkeypatch the Array prototype, causing that to fail
    for (let i = 0; i < list.length; i++) {
      if (poscmp(pos, list[i].srcRange().from) <= 0) {
        this.index = i;
        return;
      }
    }
    this.index = list.length;
    return;
  }

  insertChild(clonedParent: ASTNode, text: string) {
    const newChildNode = new FakeInsertNode(this.pos, this.pos, text);
    this.spec.getField(clonedParent).splice(this.index, 0, newChildNode);
  }

  // Find the inserted child. If more than one was inserted at once, find the
  // _last_.
  // Since nodeIds are not stable across edits, findChild may fail if the
  // parent node has been changed. In that case, return false to trigger
  // the fallback focusHint handler.
  findChild(newAST: AST) {
    try {
      const newParent = newAST.getNodeById(this.parent.id);
      if (!newParent) return null;
      const indexFromEnd = this.spec.getField(this.parent).length - this.index;
      const newIndex = this.spec.getField(newParent).length - indexFromEnd - 1;
      return this.spec.getField(newParent)[newIndex];
    } catch (e) {
      return false;
    }
  }
}

// Knows how to perform a fake replacement or deletion operation, and how to
// find the replaced child.
export class FakeAstReplacement {
  parent: ASTNode;
  child: ASTNode;
  spec: Required | Optional | List;
  index: number;
  constructor(parent: ASTNode, child: ASTNode) {
    this.parent = parent;
    this.child = child;
    for (const spec of parent.spec.childSpecs) {
      if (spec instanceof List) {
        const field = spec.getField(parent);
        for (const i of field.keys()) {
          if (field[i].id === child.id) {
            this.spec = spec;
            this.index = i;
            return;
          }
        }
      } else if (spec instanceof Required || spec instanceof Optional) {
        if (spec.getField(parent)?.id === child.id) {
          this.spec = spec;
          return;
        }
      }
    }
    warn(
      "new ReplacementPoint",
      "Failed to find child to be replaced/deleted."
    );
  }

  replaceChild(clonedParent: ClonedASTNode, text: string) {
    const newChildNode = new FakeInsertNode(
      this.child.from,
      this.child.to,
      text
    );
    if (this.spec instanceof List) {
      this.spec.getField(clonedParent)[this.index] = newChildNode;
    } else {
      this.spec.setField(clonedParent, newChildNode);
    }
  }

  deleteChild(clonedParent: ClonedASTNode) {
    if (this.spec instanceof List) {
      this.spec.getField(clonedParent).splice(this.index, 1); // Remove the i'th element.
    } else if (this.spec instanceof Optional) {
      this.spec.setField(clonedParent, null);
    } else {
      playSound(BEEP);
      this.spec.setField(
        clonedParent,
        new FakeBlankNode(this.child.from, this.child.to)
      );
    }
  }

  // Call only if you used `replaceChild`, not `deleteChild`.
  findChild(newAST: AST) {
    const newParent = newAST.getNodeById(this.parent.id);
    if (!newParent) return null;
    if (this.spec instanceof List) {
      return this.spec.getField(this.parent)[this.index];
    } else {
      return this.spec.getField(this.parent);
    }
  }
}

// A fake ASTNode that just prints itself with the given text.
class FakeInsertNode extends ASTNode<{ text: string }> {
  constructor(from: Pos, to: Pos, text: string, options = {}) {
    super({ from, to, type: "fakeInsertNode", fields: { text }, options });
  }

  toDescription(_level: number) {
    return "";
  }

  pretty() {
    const lines = this.fields.text.split("\n");
    return P.vertArray(lines.map(P.txt));
  }

  render(_props: { node: ASTNode }) {
    warn("fakeAstEdits", "FakeInsertNode didn't expect to be rendered!");
  }
}

// A fake ASTNode that just prints itself like a Blank.
class FakeBlankNode extends ASTNode {
  constructor(from: Pos, to: Pos, options = {}) {
    super({ from, to, type: "fakeBlankNode", fields: {}, options });
  }

  toDescription(_level: number) {
    return "";
  }

  pretty() {
    return P.txt("...");
  }

  render(_props: { node: ASTNode }) {
    warn("fakeAstEdits", "FakeBlankNode didn't expect to be rendered!");
  }
}

/**
 * An ASTNode that is a clone of another ASTNode.
 */
export class ClonedASTNode<
  Fields extends NodeFields = UnknownFields
> extends ASTNode<Fields> {
  // Make a copy of a node, to perform fake edits on (so that the fake edits don't
  // show up in the real AST). This copy will be deep over the ASTNodes, but
  // shallow over the non-ASTNode values they contain.
  constructor(oldNode: ASTNode<Fields>) {
    super({
      from: oldNode.from,
      to: oldNode.to,
      type: oldNode.type,
      fields: {} as Fields, // TODO(pcardune): construct this properly before calling super using the code below
      options: oldNode.options,
    });
    for (const spec of oldNode.spec.childSpecs) {
      if (spec instanceof Required) {
        spec.setField(this, cloneNode(spec.getField(oldNode)));
      } else if (spec instanceof Optional) {
        const field = spec.getField(oldNode);
        if (field) {
          spec.setField(this, cloneNode(field));
        } else {
          spec.setField(this, null);
        }
      } else if (spec instanceof Value) {
        spec.setField(this, spec.getField(oldNode));
      } else if (spec instanceof List) {
        spec.setField(this, spec.getField(oldNode).map(cloneNode));
      }
    }
    this.type = oldNode.type;
    this.id = oldNode.id;
    this.hash = oldNode.hash;
    this.spec = oldNode.spec;
    this.pretty = oldNode.pretty;
  }
  render(_props: { node: ASTNode }) {
    warn("fakeAstEdits", "ClonedASTNode didn't expect to be rendered!");
  }
  pretty(): P.Doc {
    throw new Error("ClonedASTNode didn't expect to be prettied!");
  }
}

// Make a copy of a node, to perform fake edits on (so that the fake edits don't
// show up in the real AST). This copy will be deep over the ASTNodes, but
// shallow over the non-ASTNode values they contain.
export function cloneNode<F extends NodeFields>(
  oldNode: ASTNode<F>
): ClonedASTNode<F> {
  return new ClonedASTNode(oldNode);
}
