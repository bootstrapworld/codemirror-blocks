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

function commonSubstring(s1, s2) {
  if(!s1 || !s2) return false;
  let i = 0, len = Math.min(s1.length, s2.length);
  while(i<len && s1.charAt(i) == s2.charAt(i)){ i++; } 
  return s1.substring(0, i) || false; 
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
    this.nodePathMap = new Map();
    this.annotateNodes();
    this.id = -1; // just for the sake of having an id, though unused
    this.hash = hashObject(this.rootNodes.map(node => node.hash));
  }

  toString() {
    return this.rootNodes.map(r => r.toString()).join('\n');
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
    this.nodePathMap.clear();

    let lastNode = null;
    let nid = 0;

    const loop = (nodes, parent, level) => {
      nodes.forEach((node, i) => {
        node.parent = parent;
        node.path = parent ? parent.path + ("," + i) : i.toString();
        // node.nextSibling = i + 1 === nodes.length ? null : nodes[i + 1];
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
        this.nodePathMap.set(node.path, node);
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

  getNodeByPath(path) {
    return this.nodePathMap.get(path);
  }
  // return the path to the node containing both cursor positions, or false
  getCommonAncestor(c1, c2) {
    let n1 = this.getNodeContaining(c1), n2 = this.getNodeContaining(c2);
    if(!n1 || !n2) return false;
    // false positive: an insertion (c1=c2) that touches n.from or n.to
    if((poscmp(c2, c1) == 0) && ((poscmp(n1.from, c1) == 0) || (poscmp(n1.to, c1) == 0))) {
      return this.getNodeParent(n1) && this.getNodeParent(n1).path; // Return the parent, if there is one
    }
    return commonSubstring(n1.path, n2.path);
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
  getNodeAfterCur = cur => this.rootNodes.find(n => poscmp(n.from, cur) >= 0) || null

  /**
   * getToplevelNodeBeforeCur : Cur -> ASTNode
   *
   * Returns the previous toplevel node or null
   */
  getToplevelNodeBeforeCur = cur => {
    return this.reverseRootNodes.find(n => poscmp(n.from, cur) < 0) || null;
  }

  /**
   * getToplevelNodeAfterCur : Cur -> ASTNode
   *
   * Returns the after toplevel node or null
   */
  getToplevelNodeAfterCur = this.getNodeAfterCur

  /**
   * getNodeBeforeCur : Cur -> ASTNode
   *
   * Returns the previous node or null
   */
  getNodeBeforeCur = cur => {
    // TODO: this implementation is very inefficient. Once reactify is merged,
    // we can implement a more efficient version using binary search on an indexing array
    let result = null;
    for (const node of this.nodeIdMap.values()) {
      if (poscmp(node.from, cur) < 0 && (result === null || poscmp(node.from, result.from) >= 0)) {
        result = node;
      }
    }
    return result;
  }

  // return the node containing the cursor, or false
  getNodeContaining(cursor, nodes = this.rootNodes) {
    let n = nodes.find(node => posWithinNode(cursor, node) || nodeCommentContaining(cursor, node));
    return n && ([...n.children()].length === 0 ? n :
                 this.getNodeContaining(cursor, [...n.children()]) || n);
  }
  // return an array of nodes that fall bwtween two locations
  getNodesBetween(from, to) {
    return [...this.nodeIdMap.values()].filter(n => (poscmp(from, n.from) < 1) && (poscmp(to, n.to) > -1));
  }
  // return all the root nodes that contain the given positions, or fall between them
  getRootNodesTouching(start, end, rootNodes=this.rootNodes){
    return rootNodes.filter(node =>
      posWithinNode(start, node) || posWithinNode(end, node) ||
      ( (poscmp(start, node.from) < 0) && (poscmp(end, node.to) > 0) ));
  }
  // return the parent or false
  getNodeParent = node => {
    let path = node.path.split(",");
    path.pop();
    return this.nodePathMap.get(path.join(",")) || false;
  }
  // return the first child, if it exists
  getNodeFirstChild(node) {
    return this.nodePathMap.get(node.path+",0");
  }

  getClosestNodeFromPath(keyArray) {
    let path = keyArray.join(',');
    // if we have no valid key, give up
    if(keyArray.length == 0) return false;
    // if we have a valid key, return the node
    if(this.nodePathMap.has(path)) { return this.nodePathMap.get(path); }
    // if not at the 1st sibling, look for a previous one
    else if(keyArray[keyArray.length-1] > 0) { keyArray[keyArray.length-1]--; }
    // if we're at the first child, go up a generation
    else { keyArray.pop(); }
    return this.getClosestNodeFromPath(keyArray);
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
      return {from: minpos(this.from, comment.from),
              to:   maxpos(this.to,   comment.to)};
    } else {
      return {from: this.from, to: this.to};
    }
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
