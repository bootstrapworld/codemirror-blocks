import React from 'react';
import {poscmp, minpos, maxpos, posWithinNode, nodeCommentContaining} from './utils';
import uuidv4 from 'uuid/v4';
import hashObject from 'object-hash';


export function enumerateList(lst, level) {
  lst = lst.map(l => l.toDescription(level)).slice(0);
  var last = lst.pop();
  return (lst.length == 0)? last : lst.join(', ') + " and "+last;
}

export function pluralize(noun, set) {
  return set.length+' '+noun+(set.length != 1? 's' : '');
}

export const descDepth = 1;

// This is the root of the *Abstract Syntax Tree*.  parse implementations are
// required to spit out an `AST` instance.
export class AST {
  constructor(rootNodes) {
    // the `rootNodes` attribute simply contains a list of the top level nodes
    // that were parsed.
    this.rootNodes = rootNodes;
    // the `reverseRootNodes` attribute is a shallow, reversed copy of the rootNodes
    this.reverseRootNodes = rootNodes.slice().reverse();

    // the `nodeIdMap` attribute can be used to look up nodes by their id.
    // the other nodeMaps make it easy to determine node order
    this.nodeIdMap = new Map();
    this.nodeNIdMap = new Map();
    this.annotateNodes();
    this.id = -1; // just for the sake of having an id, though unused
    this.hash = hashObject(this.rootNodes.map(node => node.hash));
  }

  toString() {
    let lines = [];
    let prevNode = null;
    for (let node of this.rootNodes) {
      let numBlankLines = prevNode
          ? node.srcRange().from.line - prevNode.srcRange().to.line - 1
          : 0;
      lines.push("\n".repeat(numBlankLines) + node.toString());
      prevNode = node;
    }
    return lines.join("\n");
  }

  children() {
    const that = this;
    return {
      *[Symbol.iterator]() {
        yield* that.rootNodes;
      }
    };
  }

  descendants() {
    const that = this;
    return {
      *[Symbol.iterator]() {
        for (const node in that.rootNodes) {
          yield* node.descendants();
        }
      }
    };
  }

  // annotateNodes : ASTNodes ASTNode -> Void
  // walk through the siblings, assigning aria-* attributes
  // and populating various maps for tree navigation
  annotateNodes() {
    this.nodeIdMap.clear();
    this.nodeNIdMap.clear();

    let lastNode = null;
    let nid = 0;

    const loop = (nodes, parent, level) => {
      nodes.forEach((node, i) => {
        node.parent = parent;
        node.path = parent ? parent.path + ("," + i) : i.toString();
        node.level = level;
        node["aria-setsize"]  = nodes.length;
        node["aria-posinset"] = i + 1;
        node.nid = nid++;
        if (lastNode) {
          node.prev = lastNode;
          lastNode.next = node;
        }
        this.nodeIdMap.set(node.id, node);
        this.nodeNIdMap.set(node.nid, node);
        lastNode = node;
        loop([...node.children()], node, level + 1);
      });
    };
    loop(this.rootNodes, null, 1);
  }

  getNodeById = id => this.nodeIdMap.get(id)
  getNodeByNId = id => this.nodeNIdMap.get(id)

  /**
   * Returns whether `u` is a strict ancestor of `v`
   */
  isAncestor = (uid, vid) => {
    let v = this.getNodeById(vid);
    const u = this.getNodeById(uid);
    v = v.parent;
    while (v && v.level > u.level) {
      v = v.parent;
    }
    return u === v;
  }

  /**
   * getNodeAfter : ASTNode -> ASTNode
   *
   * Returns the next node or null
   */
  getNodeAfter = selection => selection.next || null;

  /**
   * getNodeBefore : ASTNode -> ASTNode
   *
   * Returns the previous node or null
   */
  getNodeBefore = selection => selection.prev || null;

  // NOTE: If we have x|y where | indicates the cursor, the position of the cursor
  // is the same as the position of y's `from`. Hence, going forward requires ">= 0"
  // while going backward requires "< 0"

  /**
   * getNodeAfterCur : Cur -> ASTNode
   *
   * Returns the next node or null
   */
  getNodeAfterCur = cur => {
    function loop(nodes) {
      let n = nodes.find(n => poscmp(n.to, cur) > 0); // find the 1st node that ends after cur
      if(!n) { return; }                              // return null if there's no node after the cursor
      if(poscmp(n.from, cur) >= 0) { return n; }      // if the node *starts* after the cursor too, we're done
      let children = [...n.children()];               // if *contains* cur, drill down into the children
      return (children.length == 0)? n : loop(children);
    }
    return loop(this.rootNodes);
  }

  /**
   * getNodeBeforeCur : Cur -> ASTNode
   *
   * Returns the previous node or null
   */
  getNodeBeforeCur = cur => {
    function loop(nodes) {
      // find the 1st node that begins before cur
      let n = nodes.slice(0).reverse().find(n => poscmp(n.from, cur) < 0);
      if(!n) { return; }                              // return null if there's no node before the cursor
      if(poscmp(n.to, cur) <= 0) { return n; }        // if the node *ends* before the cursor too, we're done
      let children = [...n.children()];               // if it contains cur, drill down into the children
      return (children.length == 0)? n : loop(children);
    }
    let res = loop(this.rootNodes);
    return res;
  }

  // return the node containing the cursor, or false
  getNodeContaining(cursor, nodes = this.rootNodes) {
    let n = nodes.find(node => posWithinNode(cursor, node) || nodeCommentContaining(cursor, node));
    return n && ([...n.children()].length === 0 ? n :
                 this.getNodeContaining(cursor, [...n.children()]) || n);
  }

  // return a node that whose from/to match two cursor locations, or undefined
  getNodeAt(from, to) {
    let n = [...this.nodeIdMap.values()].find(n => (poscmp(from, n.from) == 0) && (poscmp(to, n.to) == 0));
    return n || false;
  }

  // return the parent or false
  getNodeParent = node => {
    return node.parent || false;
  }

  /**
   * getNextMatchingNode : (ASTNode->ASTNode?) (ASTNode->Bool) ASTNode [Bool] -> ASTNode?
   *
   * Consumes a search function, a test function, and a starting ASTNode.
   * Calls searchFn over and over until testFn returns false
   * If inclusive is false, searchFn is applied right away.
   */
  getNextMatchingNode(searchFn, testFn, start, inclusive=false) {
    let node = inclusive ? start : searchFn(start);
    while (node && testFn(node)) {
      node = searchFn(node);
    }
    return node;
  }

  /**
   * followsComment : {line, ch} -> bool
   *
   * Is this position on the same line as a comment, following it?
   */
  followsComment(pos) {
    // TODO: efficiency
    for (const node of this.nodeIdMap.values()) {
      if (node.options.comment
          && node.options.comment.to.line == pos.line
          && node.options.comment.to.ch <= pos.ch) {
        return true;
      }
    }
    return false;
  }

  /**
   * precedesComment : {line, ch} -> bool
   *
   * Is this position on the same line as a comment, before it?
   */
  precedesComment(pos) {
    // TODO: efficiency
    for (const node of this.nodeIdMap.values()) {
      if (node.options.comment
          && node.options.comment.from.line == pos.line
          && pos.ch <= node.options.comment.from.ch) {
        return true;
      }
    }
    return false;
  }
}

// Every node in the AST inherits from the `ASTNode` class, which is used to
// house some common attributes.
export class ASTNode {
  constructor(from, to, type, keys, options) {

    // The `from` and `to` attributes are objects containing the start and end
    // positions of this node within the source document. They are in the format
    // of `{line: <line>, ch: <column>}`.
    this.from = from;
    this.to = to;

    // Every node has a `type` attribute, which is simply a human readable
    // string sepcifying what type of node it is. This helps with debugging and
    // with writing renderers.
    this.type = type;

    // A node can contain other nodes in its fields. For example, a
    // function call node may have a field called `func` that contains
    // the function expression being called, and a field called `args`
    // that contains an Array of the argument expressions. Fields like
    // `func` and `args` that can contain other nodes must be listed
    // under `keys`. In this example, `keys === ["func", "args"]`.
    // Each key must name a field that contains one of the following:
    //
    // 1. an ASTNode
    // 2. An Array of ASTNodes
    // 3. null (this is to allow an optional ASTNode)
    this.keys = keys;

    // Every node also has an `options` attribute, which is just an open ended
    // object that you can put whatever you want in it. This is useful if you'd
    // like to persist information from your parse about a particular node, all
    // the way through to the renderer. For example, when parsing wescheme code,
    // human readable aria labels are generated by the parse, stored in the
    // options object, and then rendered in the renderers.
    this.options = options;

    // Every node also has a globally unique `id` which can be used to look up
    // it's corresponding DOM element, or to look it up in `AST.nodeIdMap`
    this.id = uuidv4(); // generate a unique ID

    // Every node has a hash value which is dependent on
    // 1. type
    // 2. children (ordered)
    // but not on srcloc and id.
    //
    // Two subtrees with identical value are supposed to have the same hash
    this.hash = null; // null for now

    // If this node is commented, give its comment an id based on this node's id.
    if (options.comment) {
      options.comment.id = "block-node-" + this.id + "-comment";
    }
  }

  toDescription(){
    return this.options["aria-label"];
  }

  toString() {
    return this.pretty().display(80).join("\n");
  }

  // Produces an iterator over the children of this node.
  children() {
    return new ChildrenIterator(this, this.keys);
  }

  // Produces an iterator over all descendants of this node, including itself.
  descendants() {
    return new DescendantsIterator(this, this.keys);
  }

  // srcRange :: -> {from: {line, ch}, to: {line, ch}}
  // Get the _full_ source location range of this node, including its comment if it has one.
  srcRange() {
    const comment = this.options.comment;
    if (comment) {
      return {
        from: minpos(this.from, comment.from),
        to:   maxpos(this.to,   comment.to)
      };
    } else {
      return {from: this.from, to: this.to};
    }
  }

  // Create a React _element_ (an instantiated component) for this node.
  reactElement(props) {
    return renderASTNode({node:this, ...props});
  }
}

function renderASTNode(props) {
  let node = props.node;
  if (typeof node.render === 'function') {
    return node.render.bind(node)(props);
  } else {
    throw new Error("Don't know how to render node of type: " + node.type);
  }
}


class ChildrenIterator {
  constructor(self, keys) {
    this.self = self;
    this.keys = keys;
  }

  *[Symbol.iterator]() {
    for (let i in this.keys) {
      let key = this.keys[i];
      let value = this.self[key];
      if (value instanceof ASTNode) {
        yield value;
      } else if (value instanceof Array) {
        for (let j in value) {
          let element = value[j];
          if (element instanceof ASTNode) {
            yield element;
          }
        }
      }
    }
  }
}

class DescendantsIterator {
  constructor(self, keys) {
    this.self = self;
    this.keys = keys;
  }

  *[Symbol.iterator]() {
    yield this.self;
    for (let child of this.self.children()) {
      for (let descendant of child.descendants()) {
        yield descendant;
      }
    }
  }
}