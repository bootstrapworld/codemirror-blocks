import React from 'react';
import {poscmp, minpos, maxpos, posWithinNode, 
  nodeCommentContaining, gensym, hashObject} from './utils';
import * as P from 'pretty-fast-pretty-printer';
import { node } from 'prop-types';


export function enumerateList(lst, level) {
  lst = lst.map(l => l.describe(level)).slice(0);
  var last = lst.pop();
  return (lst.length == 0)? last : lst.join(', ') + " and "+last;
}

export function pluralize(noun, set) {
  return set.length+' '+noun+(set.length != 1? 's' : '');
}

const descDepth = 1;

export const prettyPrintingWidth = 80;

// This is the root of the *Abstract Syntax Tree*.  parse implementations are
// required to spit out an `AST` instance.
export class AST {
  rootNodes: ASTNode[];
  reverseRootNodes: ASTNode[];
  nodeIdMap: Map<any, any>;
  nodeNIdMap: Map<any, any>;
  id: number;
  hash: any;

  constructor(rootNodes, annotate = true) {
    // the `rootNodes` attribute simply contains a list of the top level nodes
    // that were parsed, in srcLoc order
    this.rootNodes = rootNodes;
    this.rootNodes.sort((a,b) => poscmp(a.from, b.from));
    // the `reverseRootNodes` attribute is a shallow, reversed copy of the rootNodes
    this.reverseRootNodes = rootNodes.slice().reverse();

    // the `nodeIdMap` attribute can be used to look up nodes by their id.
    // the other nodeMaps make it easy to determine node order
    this.nodeIdMap = new Map();
    this.nodeNIdMap = new Map();
    if(annotate) this.annotateNodes();
    this.id = -1; // just for the sake of having an id, though unused
    this.hash = hashObject(this.rootNodes.map(node => node.hash));
  }

  toString() {
    let lines = [];
    let prevNode = null;
    for (let node of this.rootNodes) {
      let numBlankLines = prevNode
          ? Math.max(0, node.srcRange().from.line - prevNode.srcRange().to.line - 1)
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
          yield* (node as unknown as ASTNode).descendants();
        }
      }
    };
  }

  // annotateNodes : ASTNodes ASTNode -> Void
  // walk through the siblings, assigning aria-* attributes
  // and populating various maps for tree navigation
  annotateNodes() {
    //console.log('XXX ast:86 doing annotateNodes');
    this.nodeIdMap.clear();
    this.nodeNIdMap.clear();

    let lastNode = null;
    let nid = 0;

    const loop = (nodes, parent, level) => {
      nodes.forEach((node, i) => {
        this.validateNode(node);
        if (node.id === undefined) {
          // May be defined, if this piece of AST came from the previous AST.
          node.id = gensym();
        }
        node.parent = parent;
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
        node.hash = node.spec.hash(node); // Relies on child hashes; must be bottom-up
      });
    };
    loop(this.rootNodes, null, 1);
  }

  validateNode(node) {
    const astFieldNames =
          ["from", "to", "type", "options", "spec", "__alreadyValidated", "element"];
    // Check that the node doesn't define any of the fields we're going to add to it.
    const newFieldNames =
          ["id", "parent", "level", "nid", "prev", "next", "hash",
           "aria-setsize", "aria-posinset", "mark"];
    if (!node.__alreadyValidated) {
      for (let p in node) {
        if (newFieldNames.includes(p)) {
          throw new Error(`The property ${p} is used by ASTNode, and should not be overridden in subclasses.`);
        }
      }
    }
    node.__alreadyValidated = true;
    // Check that the node declares all of the required fields and methods.
    if (typeof node.type !== "string") {
      throw new Error(`ASTNodes must each have a fixed 'type', which must be a string.`);
    }
    if (typeof node.options !== "object") {
      throw new Error(`ASTNode.options is optional, but if provided it must be an object. This rule was broken by ${node.type}.`);
    }
    if (!node.from || !node.to
        || typeof node.from.line !== "number" || typeof node.from.ch !== "number"
        || typeof node.to.line !== "number" || typeof node.to.ch !== "number") {
      throw new Error(`ASTNode.from and .to are required and must have the form {line: number, to: number} (they are source locations). This rule was broken by ${node.type}.`);
    }
    if (typeof node.pretty !== "function") {
      throw new Error(`ASTNode ${node.type} needs to have a pretty() method, but does not.`);
    }
    if (typeof node.render !== "function") {
      throw new Error(`ASTNode ${node.type} needs to have a render() method, but does not.`);
    }
    // Check that the node obeys its own spec.
    if (!node.spec) {
      throw new Error(`ASTNode ${node.type} needs to have a static 'spec' of type NodeSpec, declaring the types of its fields.`);
    }
    node.spec.validate(node);
    // Check that the node doesn't contain any extraneous data.
    // (If it does, its hash is probably wrong. All data should be declared in the spec.)
    let speccedFieldNames = node.spec.fieldNames();
    for (let field in node) {
      if (node.hasOwnProperty(field)) {
        if (!newFieldNames.includes(field)
            && !speccedFieldNames.includes(field)
            && !astFieldNames.includes(field)) {
          throw new Error(`An ASTNode ${node.type} contains a field called '${field}' that was not declared in its spec. All ASTNode fields must be mentioned in their spec.`);
        }
      }
    }
  }

  getNodeById = id => this.nodeIdMap.get(id)
  getNodeByNId = nid => this.nodeNIdMap.get(nid)

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
    function loop(nodes, parentFallback) {
      //console.log('ast:211, cur?=', !!cur);
      let n = nodes.find(n => poscmp(n.to, cur) > 0); // find the 1st node that ends after cur
      //console.log('ast:213');
      if(!n) {
        //console.log('ast:214');
        return parentFallback; }               // return null if there's no node after the cursor
      if(poscmp(n.from, cur) >= 0) {
        //console.log('ast:218');
        return n; }      // if the node *starts* after the cursor too, we're done
      //console.log('ast:220');
      let children = [...n.children()];               // if *contains* cur, drill down into the children
      //console.log('ast:222');
      return (children.length == 0)? n : loop(children, n);
    }
    return loop(this.rootNodes, null);
  }

  /**
   * getNodeBeforeCur : Cur -> ASTNode
   *
   * Returns the previous node or null
   */
  getNodeBeforeCur = cur => {
    function loop(nodes, parentFallback) {
      // find the last node that begins before cur
      let n = nodes.slice(0).reverse().find(n => poscmp(n.from, cur) < 0);
      if(!n) { return parentFallback; }               // return null if there's no node before the cursor
      let children = [...n.children()];               // if it contains cur, drill down into the children
      return (children.length == 0)? n : loop(children, n);
    }
    return loop(this.rootNodes, null);
  }

  /**
   * getFirstRootNode : -> ASTNode
   *
   * Return the first (in source code order) root node, or `null` if there are none.
   */
  getFirstRootNode() {
    return this.rootNodes.length > 0 ? this.rootNodes[0] : null;
  }

  // return the node containing the cursor, or false
  getNodeContaining(cursor, nodes = this.rootNodes) {
    let n = nodes.find(node => posWithinNode(cursor, node) || nodeCommentContaining(cursor, node));
    return n && ([...n.children()].length === 0 ? n :
                 this.getNodeContaining(cursor, [...n.children()]) || n);
  }

  // return a node that whose from/to match two cursor locations, or whose
  // srcRange matches those locations. If none exists, return undefined
  getNodeAt(from, to) {
    let n = [...this.nodeIdMap.values()].find(n => {
      let {from: srcFrom, to: srcTo} = n.srcRange();
      // happens when node is an ABlank
      if (n.from == null || n.to == null)
        return undefined;
      return (poscmp(from, n.from) == 0) && (poscmp(to, n.to) == 0)
        || (poscmp(from, srcFrom) == 0) && (poscmp(to, srcTo) == 0);
    });
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
   * Is there a comment or a commented node to the left of this position, on the same line?
   */
  followsComment(pos) {
    // TODO: efficiency
    for (const node of this.nodeIdMap.values()) {
      if (node.options.comment?.to?.line == pos.line
          && node.options.comment?.to?.ch <= pos.ch) {
        return true;
      } else if (node.options.comment
                 && node.to.line == pos.line
                 && node.to.ch <= pos.ch) {
        return true
      }
    }
    return false;
  }

  /**
   * precedesComment : {line, ch} -> bool
   *
   * Is there a comment or a commented node to the right of this position, on the same line?
   */
  precedesComment(pos) {
    // TODO: efficiency
    for (const node of this.nodeIdMap.values()) {
      if (node.options.comment?.from?.line == pos.line
          && pos.ch <= node.options.comment?.from?.ch) {
        return true;
      } else if (node.options.comment
                 && node.from.line == pos.line
                 && pos.ch <= node.from.ch) {
        return true;
      }
    }
    return false;
  }
}

// Every node in the AST inherits from the `ASTNode` class, which is used to
// house some common attributes.
export class ASTNode {
  from: any;
  to: any;
  type: any;
  options: any;
  id: string;
  level: any;
  hash: any;
  public static spec: any;
  spec: any;
  constructor(from, to, type, options) {

    // The `from` and `to` attributes are objects containing the start and end
    // positions of this node within the source document. They are in the format
    // of `{line: <line>, ch: <column>}`.
    this.from = from;
    this.to = to;

    // Every node has a `type` attribute, which is simply a human readable
    // string sepcifying what type of node it is. This helps with debugging and
    // with writing renderers.
    this.type = type;

    // Every node also has an `options` attribute, which is just an open ended
    // object that you can put whatever you want in it. This is useful if you'd
    // like to persist information from your parse about a particular node, all
    // the way through to the renderer. For example, when parsing wescheme code,
    // human readable aria labels are generated by the parse, stored in the
    // options object, and then rendered in the renderers.
    this.options = options;

    // Every node also has a globally unique `id` which can be used to look up
    // its corresponding DOM element, or to look it up in `AST.nodeIdMap`.
    // It is set in AST.annotateNodes().
    
    // If this node is commented, give its comment an id based on this node's id.
    if (options.comment) {
      options.comment.id = "block-node-" + this.id + "-comment";
    }

    // Make the spec more easily available.
    this.spec = (this.constructor as any).spec;
  }

  describe(level) {
    if ((this.level - level) >= descDepth) {
      return this.shortDescription(level);
    } else {
      return this.longDescription(level);
    }
  }

  // Every node must, on construction, set its own `.hash` field. Its hash must
  // be determined by its type, its (ordered) children, and any other content it
  // contains, but _not_ on its `srcloc` or `id`. Subtrees with identical values
  // must have the same hash.
  //
  // `computeHash()` computes a hash for a node in the common case where the
  // _only_ content of a node is `this.type` and `this.children()`. However,
  // some nodes have other content. For example, a Binop node could have an `op`
  // field that's a string like "+" or "*". In this case, `computeHash()` will
  // not include `op` in the hash because `op` is not a child (only ASTNodes are
  // children). Thus you would need to compute `.hash` yourself. For other
  // examples of node types that cannot rely on `.computeHash()`, see Literal and
  // Comment.
  computeHash() {
    return this.hash = hashObject([this.type, [...this.children()].map(c => c.hash)]);
  }

  shortDescription(_level) {
    return this.options["aria-label"];
  }

  longDescription(_level) {
    throw "ASTNodes must implement `.longDescription()`";
  }

  toString() {
    return this.pretty().display(prettyPrintingWidth).join("\n");
  }
  pretty(): P.Doc {
    throw new Error("Method not implemented.");
  }

  // Produces an iterator over the children of this node.
  children() {
    return this.spec.children(this);
  }

  // Produces an iterator over all descendants of this node, including itself.
  descendants() {
    return new DescendantsIterator(this);
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
  reactElement(props?) {
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

class DescendantsIterator {
  node: ASTNode;
  constructor(node) {
    this.node = node;
  }

  *[Symbol.iterator]() {
    yield this.node;
    for (let child of this.node.children()) {
      for (let descendant of child.descendants()) {
        yield descendant;
      }
    }
  }
}
