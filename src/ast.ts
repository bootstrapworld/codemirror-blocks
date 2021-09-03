import {poscmp, minpos, maxpos, posWithinNode, 
  nodeCommentContaining, genUniqueId, hashObject} from './utils';
import * as P from 'pretty-fast-pretty-printer';
import type CodeMirror from 'codemirror';
import type { Comment } from './nodes';
import type { NodeSpec } from './nodeSpec'
import type React from 'react';

/**
 * @internal
 * given a list of ASTNodes and a depth level, generate
 * a description of the collection suitable for screenreaders
 */
export function enumerateList(lst: ASTNode[], level: number) {
  const described = lst.map(l => l.describe(level)).slice(0);
  const last = described.pop();
  return (described.length == 0)? last : described.join(', ') + " and "+last;
}

/**
 * @internal
 * given a noun and an array, generate a (possibly-plural)
 * version of that noun
 */
export function pluralize(noun: string, set: any[]) {
  return set.length+' '+noun+(set.length != 1? 's' : '');
}

/**
 * @internal
 * The AST depth at which to switch from a short description to a long one
 */
const descDepth = 1;

/**
 * @internal
 * The pretty-printer is used to canonicalize the programs so that
 * switching from text to blocks and back is 1-to-1. This printing
 * algorithm needs to know how wide a line can be, so we set that 
 * internally here
 */
export const prettyPrintingWidth = 80;

/**
 * This is the the *Abstract Syntax Tree*. Parser implementations
 * are required to spit out an `AST` instance.
 */
export class AST {
  rootNodes: ASTNode[];
  reverseRootNodes: ASTNode[];
  nodeIdMap: Map<string, ASTNode>;
  nodeNIdMap: Map<number, ASTNode>;
  id: number;
  hash: any;

  constructor(rootNodes: ASTNode[], annotate = true) {
    // the `rootNodes` attribute simply contains a list of the top level nodes
    // that were parsed, in srcLoc order
    this.rootNodes = rootNodes;
    this.rootNodes.sort((a,b) => poscmp(a.from, b.from));
    // the `reverseRootNodes` attribute is a shallow, reversed copy of the rootNodes
    this.reverseRootNodes = rootNodes.slice().reverse();

    // *Unique* ID for every newly-parsed node. No ID is ever re-used.
    this.nodeIdMap  = new Map();
    // Index of each node (in-order walk). NIds always start at 0
    this.nodeNIdMap = new Map();

    // When an AST is to be used by CMB, it must be annotated.
    // This step is computationally intensive, and in certain instances
    // unecessary
    if(annotate) this.annotateNodes();

    this.id = -1; // just for the sake of having an id, though unused
    this.hash = hashObject(this.rootNodes.map(node => node.hash));
  }

  /**
   * toString : -> String
   * Pretty-print each rootNode on its own line, prepending whitespace
   */
  toString() {
    let lines: string[] = [];
    let prevNode: ASTNode | null = null;
    for (let node of this.rootNodes) {
      let numBlankLines = prevNode
          ? Math.max(0, node.srcRange().from.line - prevNode.srcRange().to.line - 1)
          : 0;
      lines.push("\n".repeat(numBlankLines) + node.toString());
      prevNode = node;
    }
    return lines.join("\n");
  }

  /**
   * children : -> ASTNode[]
   * Print out all the immediate "children" of the AST (root nodes)
   */
  children() {
    const that = this;
    return {
      *[Symbol.iterator]() {
        yield* that.rootNodes;
      }
    };
  }

  /**
   * descendants : -> ASTNode[]
   * Print out ALL the descendents (all generations) of each root node
   */
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

  /**
   * annotateNodes : ASTNodes ASTNode -> Void
   * walk through the siblings, assigning aria-* attributes
   * and populating various maps for tree navigation
   */
  annotateNodes() {
    this.nodeIdMap.clear();
    this.nodeNIdMap.clear();

    let lastNode: ASTNode | null = null;
    let nid = 0;

    const processChildren = (nodes: ASTNode[], parent: ASTNode | undefined, level: number) => {
      nodes.forEach((node, i) => {
        this.validateNode(node);
        // Undefined if this DID NOT come from a patched AST.
        if (node.id === undefined) {
          node.id = genUniqueId();
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
        processChildren([...node.children()], node, level + 1);
        node.hash = node.spec.hash(node); // Relies on child hashes; must be bottom-up
      });
    };
    processChildren(this.rootNodes, undefined, 1);
  }

  /**
   * validateNode : ASTNode -> Void
   * Raise an exception if a Node has is invalid
   */
  validateNode(node: ASTNode) {
    const astFieldNames =
          ["from", "to", "type", "options", "spec", "isLockedP", "__alreadyValidated", "element", "isEditable"];
    // Check that the node doesn't define any of the fields we're going to add to it.
    const newFieldNames =
          ["id", "parent", "level", "nid", "prev", "next", "hash",
           "aria-setsize", "aria-posinset", "mark"];
    const invalidProp = newFieldNames.find(field => field in node && (node as any)[field] !== undefined)
    if (!node.__alreadyValidated && invalidProp) {
      throw new Error(`The property ${invalidProp} is used by ASTNode, and should not be overridden in subclasses.`);
    }

    node.__alreadyValidated = true;
    // Check that the node declares all of the required fields and methods.
    if (typeof node.type !== "string") {
      throw new Error(`ASTNodes must each have a fixed 'type', which must be a string.`);
    }
    if (typeof node.options !== "object") {
      throw new Error(`ASTNode.options is optional, but if provided it must be an object. This rule was broken by ${node.type}.`);
    }
    // Check that the Pos objects are correctly-formatted
    if([node.from?.line, node.from?.ch, node.to?.line, node.to?.ch]
        .some(v => typeof v !== "number")) {
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
    const expectedFieldNames = node.spec.fieldNames().concat(newFieldNames, astFieldNames);
    const undeclaredField = Object.getOwnPropertyNames(node).find(p => !expectedFieldNames.includes(p));
    if(undeclaredField) {
      throw new Error(`An ASTNode ${node.type} contains a field called '${undeclaredField}' that was not declared in its spec. All ASTNode fields must be mentioned in their spec.`);
    }
  }

  /**
   * getNodeById : id -> ASTNode
   * getNodeByNId : nid -> ASTNode
   * getter methods for the nodeMaps populated from annotateNodes()
   */
  getNodeById = (id: string) => this.nodeIdMap.get(id)
  getNodeByNId = (nid: number) => this.nodeNIdMap.get(nid)

  /**
   * Returns whether `u` is a strict ancestor of `v`
   * throws an exception if either isn't found
   */
  isAncestor = (uid: string, vid: string) => {
    let v = this.getNodeById(vid);
    const u = this.getNodeById(uid);
    if(!u) throw new Error(`The nodeId ${uid} was not found`);
    if(!v) throw new Error(`The nodeId ${vid} was not found`);
    if (v) { v = v.parent; }
    while (v && u && v.level > u.level) { v = v.parent; }
    return u === v;
  }

  /**
   * getNodeAfter : ASTNode -> ASTNode
   * Returns the next node or null
   */
  getNodeAfter = (selection: ASTNode) => selection.next || null;

  /**
   * getNodeBefore : ASTNode -> ASTNode
   * Returns the previous node or null
   */
  getNodeBefore = (selection: ASTNode) => selection.prev || null;

  // NOTE: If we have x|y where | indicates the cursor, the position of the cursor
  // is the same as the position of y's `from`. Hence, going forward requires ">= 0"
  // while going backward requires "< 0"

  /**
   * getNodeAfterCur : Cur -> ASTNode
   * Returns the next node or null
   */
  getNodeAfterCur = (cur: Pos) => {
    function loop(nodes: ASTNode[], parentFallback: ASTNode | null): ASTNode | null {
      let n = nodes.find(n => poscmp(n.to, cur) > 0); // find the 1st node that ends after cur
      if(!n) { return parentFallback; }               // return null if there's no node after the cursor
      if(poscmp(n.from, cur) >= 0) {
        return n; }                                   // if the node *starts* after the cursor too, we're done
      let children = [...n.children()];               // if *contains* cur, drill down into the children
      return (children.length == 0)? n : loop(children, n);
    }
    return loop(this.rootNodes, null);
  }

  /**
   * getNodeBeforeCur : Cur -> ASTNode
   * Returns the previous node or null
   */
  getNodeBeforeCur = (cur: Pos) => {
    function loop(nodes: ASTNode[], parentFallback: ASTNode | null): ASTNode | null {
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
   * Return the first (in source code order) root node, or `null` if there are none.
   */
  getFirstRootNode() {
    return this.rootNodes.length > 0 ? this.rootNodes[0] : null;
  }

  /**
   * getNodeContaining : CMCursor, ASTNodes[] -> ASTNode
   * Find the node that most tightly-encloses a given cursor
   */
  getNodeContaining(cursor: Pos, nodes = this.rootNodes): ASTNode | undefined {
    let n = nodes.find(node => posWithinNode(cursor, node) || nodeCommentContaining(cursor, node));
    return n && ([...n.children()].length === 0 ? n :
                 this.getNodeContaining(cursor, [...n.children()]) || n);
  }

  /**
   * getNodeAt : CMCursor, CMCursor -> ASTNode
   * return a node that whose from/to match two cursor locations, or whose
   * srcRange matches those locations. If none exists, return undefined
   */
  getNodeAt(from: Pos, to: Pos) {
    let n = [...this.nodeIdMap.values()].find(n => {
      let {from: srcFrom, to: srcTo} = n.srcRange();
      // happens when node is an ABlank
      if (n.from == null || n.to == null)
        return undefined;
      return (poscmp(from, n.from) == 0) && (poscmp(to, n.to) == 0)
        || (poscmp(from, srcFrom) == 0) && (poscmp(to, srcTo) == 0);
    });
    return n || undefined;
  }

  /**
   * getNodeParent : ASTNode -> ASTNode | Boolean
   * return the parent or false
   */
  getNodeParent = (node: ASTNode) => {
    return node.parent || false;
  }

  /**
   * getNextMatchingNode : (ASTNode->ASTNode?) (ASTNode->Bool) ASTNode [Bool] -> ASTNode?
   * Consumes a search function, a test function, and a starting ASTNode.
   * Calls searchFn over and over until testFn returns false
   * If inclusive is false, searchFn is applied right away.
   */
  getNextMatchingNode(
    searchFn: (node: ASTNode) => ASTNode | undefined,
    testFn: (node: ASTNode) => boolean,
    start: ASTNode,
    inclusive: boolean = false
  ) {
    let node = inclusive ? start : searchFn(start);
    while (node && testFn(node)) {
      node = searchFn(node);
    }
    return node;
  }

  /**
   * followsComment : {line, ch} -> bool
   * Is there a comment or a commented node to the left of this position, on the same line?
   */
  followsComment(pos: Pos) {
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
   * Is there a comment or a commented node to the right of this position, on the same line?
   */
  precedesComment(pos: Pos) {
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

export type Pos = {
  line: number;
  ch: number;
}

export type Range = {
  from: Pos,
  to: Pos,
}

export type NodeOptions = {
  comment?: Comment;
  "aria-label"?: string;
}

/**
 * Every node in the AST must inherit from the `ASTNode` class, which is used
 * to house some common attributes.
 */
export abstract class ASTNode<Opt extends NodeOptions = NodeOptions, Props = {}> {
  /**
   * @internal
   * Every node must have a Starting and Ending position, represented as 
   * {line, ch} objects, a human-readable string representing the type 
   * of the node (useful for debugging), a unique id, NId, depth 
   * in the tree, hash for quick comparisons, and aria properties for 
   * set size and position in set (for screenreaders)
   */
  from: Pos;
  to: Pos;
  type: string;
  id!: string;
  nid: number;
  level: number;
  hash: number;
  "aria-setsize": number;
  "aria-posinset": number;

  /**
   * @internal
   * Optional pointers to the node's parent and prev/next siblings
   * the options object always contains the aria-label, but can also
   * include other values
   */
  parent?: ASTNode;
  prev?: ASTNode;
  next?: ASTNode;
  options: Opt;

  /**
   * @internal
   * nodeSpec, which specifies node requirements (see nodeSpec.ts)
   * NOTE(pcardune): can we import the NodeSpec type here?
   */
  public static spec: NodeSpec;
  spec: NodeSpec;

  /**
   * @internal
   * A predicate, which prevents the node from being edited
   */
  isLockedP: boolean;

  /**
   * @internal
   * Stores the html element that this ast node was rendered into.
   */
  element: HTMLElement;

  /**
   * @internal
   * Used for unit testing only
   */
  isEditable: () => boolean;

  /**
   * @internal
   * Used to keep track of which nodes have had their properties
   * validated by {@link AST.validateNode}
   */
  __alreadyValidated: boolean = false;

  /**
   * @internal
   * the CM TextMarker which contains the element representing the node
   * (only relevant for rootNodes)
   */
  mark: CodeMirror.TextMarker;

  constructor(from: Pos, to: Pos, type: string, options: Opt) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.options = options;
    
    // If this node is commented, give its comment an id based on this node's id.
    if (options.comment) {
      options.comment.id = "block-node-" + this.id + "-comment";
    }

    // Make the spec more easily available.
    this.spec = (this.constructor as any).spec;

    this.isLockedP = false;
  }

  // based on the depth level, choose short v. long descriptions
  describe(level: number) {
    if ((this.level - level) >= descDepth) {
      return this.shortDescription(level);
    } else {
      return this.longDescription(level);
    }
  }
  // the short description is literally the ARIA label
  shortDescription(level?: number): string {
    return this.options["aria-label"] || "";
  }

  // the long description is node-specific, detailed, and must be
  // implemented by the ASTNode itself
  longDescription(level: number): string {
    throw new Error("ASTNodes must implement `.longDescription()`");
  }

  // Pretty-print the node and its children, based on the pp-width
  toString() {
    return this.pretty().display(prettyPrintingWidth).join("\n");
  }

  // Pretty-printing is node-specific, and must be implemented by
  // the ASTNode itself
  pretty(): P.Doc {
    throw new Error("Method not implemented.");
  }

  // Produces an iterator over the children of this node.
  children():Iterable<ASTNode> {
    return this.spec.children(this);
  }

  // Produces an iterator over all descendants of this node, including itself.
  descendants(): Iterable<ASTNode> {
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
  reactElement(props?: Props): React.ReactElement {
    return renderASTNode({node:this, ...props});
  }

  abstract render(props: Props): React.ReactElement | void;
}

function renderASTNode(props: {node: ASTNode}) {
  let node = props.node;
  if (typeof node.render === 'function') {
    return node.render.bind(node)(props);
  } else {
    throw new Error("Don't know how to render node of type: " + node.type);
  }
}

class DescendantsIterator {
  node: ASTNode;
  constructor(node: ASTNode) {
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
