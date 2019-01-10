import {poscmp, posWithinNode, nodeCommentContaining} from './utils';
import uuidv4 from 'uuid/v4';
import hashObject from 'object-hash';


// Compute the position of the end of a change (its 'to' property refers to the pre-change end).
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function changeEnd({from, to, text}) {
  if (!text) return to;
  let lastText = text[text.length-1];
  return {line: from.line+text.length-1, ch: lastText.length+(text.length==1 ? from.ch : 0)};
}

// Adjust a Pos to refer to the post-change position, or the end of the change if the change covers it.
// based on https://github.com/codemirror/CodeMirror/blob/master/src/model/change_measurement.js
function adjustForChange(pos, change, from) {
  if (poscmp(pos, change.from) < 0)           return pos;
  if (poscmp(pos, change.from) == 0 && from)  return pos; // if node.from==change.from, no change
  if (poscmp(pos, change.to) <= 0)            return changeEnd(change);
  let line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
  if (pos.line == change.to.line) ch += changeEnd(change).ch - change.to.ch;
  return {line: line, ch: ch};
}

// pathIsIndependentOfChangePath : [Path], [Path] -> Boolean
// a path is independant if it points above, before, or after the change
function pathIsIndependentOfChangePath(pathArray, changeArray) {
  return pathArray.length < changeArray.length       ||     // above: shorter paths are "above" the change point
    pathArray.findIndex((v, i) => (v<changeArray[i]) ||     // before: the node - or any ancestor - is a younger sibling of the change
      (v>changeArray[i] && i<changeArray.length-2)) > -1;   // after: any *ancestor only* is an older sibling
}

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

  // patch : Parser, String, [ChangeObjs] -> AST
  // FOR NOW: ASSUMES ALL CHANGES BOUNDARIES ARE NODE BOUNDARIES
  // produce the new AST, preserving all the unchanged DOM nodes from the old AST
  patch(parse, newAST, CMchanges) {
    let oldAST = this, dirtyNodes = new Set();

    // produces the path to the node immediately following the start of the change
    function getInsertionPath({from, to}) {
      let path = oldAST.getCommonAncestor(from, to), node = oldAST.getNodeByPath(path);
      let replacing = node && (poscmp(node.from, from)==0 && poscmp(node.to, to)==0);
      // if there's no path, or we're not replacing, search for the previous sibling
      if(!path || !replacing) {
        let siblings = path? [...oldAST.getNodeByPath(path)].slice(1) : oldAST.rootNodes;
        let spliceIndex = siblings.findIndex(n => poscmp(from, n.from) <= 0);
        if(spliceIndex == -1) spliceIndex = siblings.length;
        path = (path ? path+',' : "") + spliceIndex;
      }
      return path;
    }

    // For each CM change: (1) compute a sibling shift at the relevant path and 
    // (2) update the text posns in the AST to reflect the post-change coordinates
    let pathChanges = CMchanges.map(change => {
      let {from, to, text, removed} = change;
      // trim whitespace from change object, and figure out how many siblings are added/removed
      let startWS = removed[0].match(/^\s+/), endWS = removed[removed.length-1].match(/\s+$/);
      if(startWS) { from.ch += startWS[0].length; }
      if(endWS)   { to.ch   -= endWS[0].length;   }
      // HACK: we currently rely on being able to parse inserted text. Must fix.
      let insertedSiblings = parse( text.join('\n')  ).rootNodes.length;
      let path = getInsertionPath(change);
      // compute how many nodes were removed between {from, to}. Assume 0 to start.
      let removedCount = 0, fromNode = this.getNodeAfterCur(from), toNode = this.getNodeBeforeCur(to);
      if(fromNode && toNode) { // we might have removed something. Check to see.
        // find the nodes touching from & to, and see how many siblings fall between them (+ 1 if same node)
        removedCount = fromNode.path.split(",").pop() - fromNode.path.split(",").pop() + 1;
        if(removed == "") removedCount--; // if we're strictly inserting, subtract 1
      }
      oldAST.nodeIdMap.forEach(n => {
        n.from = adjustForChange(n.from, change, true );
        n.to   = adjustForChange(n.to,   change, false);
      });
      return {path: path, added: insertedSiblings, removed: removedCount };
    });
    // for each pathChange, nullify removed nodes and adjust the paths of affected nodes
    pathChanges.forEach(({path, added, removed}) => {
      let shift = added - removed;
      // force a re-render on the parent, since parent nodeType could change
      if(shift == 0) { oldAST.nodeIdMap.delete(oldAST.getNodeByPath(path).id); return; }
      let cArray = path.split(',').map(Number);
      let changeDepth = cArray.length-1, changeIdx = cArray[changeDepth];
      oldAST.nodeIdMap.forEach((node, id) => {
        let pArray = node.path.split(',').map(Number);
        // if the node is independent of the change, just return
        if(pathIsIndependentOfChangePath(pArray, cArray)) { return; }
        // If it's being removed, delete from nodeIdMap and mark its parent as dirty (if it has one)
        if(pArray[changeDepth] < (changeIdx + removed)) {
          let parent  = oldAST.getNodeParent(node);
          if(parent) { dirtyNodes.add(parent); }
          oldAST.nodeIdMap.delete(id);
        // Otherwise just update the path of other post-change nodes by +shift
        } else {
          pArray[changeDepth] += shift;
          node.path = pArray.join(',');
        }
      });
    });
    // copy over the DOM elt for unchanged nodes, and update their IDs to match
    oldAST.nodeIdMap.forEach(n => {
      let newNode = newAST.getNodeByPath(n.path);
      if(newNode) { n.el.id = 'block-node-' + newNode.id; newNode.el = n.el; }
    });
    // If we have a DOM elt, use it and update the id. Mark parents of nodes with DOM elts as dirty
    newAST.nodeIdMap.forEach(n => { if(!n.el){ dirtyNodes.add(newAST.getNodeParent(n) || n); }});
    // Ensure that no dirty node is the ancestor of another dirty node
    let dirty = [...dirtyNodes].sort((a, b) => a.path<b.path? -1 : a.path==b.path? 0 : 1);
    dirty.reduce((n1, n2) => n2.path.includes(n1.path)? dirtyNodes.delete(n2) && n1 : n2, false);
    newAST.dirtyNodes = new Set([...dirtyNodes].map(n => newAST.getNodeByPath(n.path)) // grab all the nodes
      .filter(n => n !== undefined));                                                  // remove deleted ones
    return newAST;
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

  // Produces an iterator over the children of this node.
  children() {
    return new ChildrenIterator(this, this.keys);
  }

  // Produces an iterator over all descendants of this node, including itself.
  descendants() {
    return new DescendantsIterator(this, this.keys);
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

export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', ['elts'], options);
    this.elts = elts;
    this.hash = hashObject(['unknown', elts.map(elt => elt.hash)]);
  }

  toDescription(level){
    if((this.level - level) >= descDepth) return this.options['aria-label'];
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.toDescription(level)).join(", ");
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }
}

export class FunctionApp extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'functionApp', ['func', 'args'], options);
    this.func = func;
    this.args = args;
    this.hash = hashObject(['function-app', func.hash, args.map(arg => arg.hash)]);
  }

  toDescription(level){
    // if it's the top level, enumerate the args
    if((this.level  - level) == 0) {
      return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
    }
    // if we've bottomed out, use the aria label
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    // if we're in between, use "f of A, B, C" format
    else return `${this.func.toDescription()} of `+ this.args.map(a  => a.toDescription(level)).join(", ");
      
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.func;
    for (let arg of this.args) {
      yield arg;
    }
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }
}

export class IdentifierList extends ASTNode {
  constructor(from, to, kind, ids, options={}) {
    super(from, to, 'identifierList', ['ids'], options);
    this.kind = kind;
    this.ids = ids;
    this.hash = hashObject(['identifierList', this.kind, this.ids.map(id => id.hash)]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return enumerateList(this.ids, level);
  }

  toString() {
    return `${this.ids.join(' ')}`;
  }
}

export class StructDefinition extends ASTNode {
  constructor(from, to, name, fields, options={}) {
    super(from, to, 'structDefinition', ['name', 'fields'], options);
    this.name = name;
    this.fields = fields;
    this.hash = hashObject(['structDefinition', name.hash, fields.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with
            ${this.fields.toDescription(level)}`;
  }

  toString() {
    return `(define-struct ${this.name} (${this.fields.toString()}))`;
  }
}

export class VariableDefinition extends ASTNode {
  constructor(from, to, name, body, options={}) {
    super(from, to, 'variableDefinition', ['name', 'body'], options);
    this.name = name;
    this.body = body;
    this.hash = hashObject(['variableDefinition', name.hash, body.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(define ${this.name} ${this.body})`;
  }
}

export class LambdaExpression extends ASTNode {
  constructor(from, to, args, body, options={}) {
    super(from, to, 'lambdaExpression', ['args', 'body'], options);
    this.args = args;
    this.body = body;
    this.hash = hashObject(['lambdaExpression', args.hash, body.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(lambda (${this.args.toString()}) ${this.body})`;
  }
}

export class FunctionDefinition extends ASTNode {
  constructor(from, to, name, params, body, options={}) {
    super(from, to, 'functionDefinition', ['name', 'params', 'body'], options);
    this.name = name;
    this.params = params;
    this.body = body;
    this.hash = hashObject(['functionDefinition', name.hash, params.hash, body.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be a function of 
            ${this.params.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(define (${this.name} ${this.params.toString()}) ${this.body})`;
  }
}

export class CondClause extends ASTNode {
  constructor(from, to, testExpr, thenExprs, options={}) {
    super(from, to, 'condClause', ['testExpr', 'thenExprs'], options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
    this.hash = hashObject(['condClause', testExpr.hash, thenExprs.map(e => e.hash)]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)}, then, ${this.thenExprs.map(te => te.toDescription(level))}`;
  }

  toString() {
    return `[${this.testExpr} ${this.thenExprs.join(' ')}]`;
  }
}

export class CondExpression extends ASTNode {
  constructor(from, to, clauses, options={}) {
    super(from, to, 'condExpression', ['clauses'], options);
    this.clauses = clauses;
    this.hash = hashObject(['condExpression', this.clauses.map(clause => clause.hash)]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.toDescription(level))}`;
  }

  toString() {
    const clauses = this.clauses.map(c => c.toString()).join(' ');
    return `(cond ${clauses})`;
  }
}

export class IfExpression extends ASTNode {
  constructor(from, to, testExpr, thenExpr, elseExpr, options={}) {
    super(from, to, 'ifExpression', ['testExpr', 'thenExpr', 'elseExpr'], options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
    this.hash = hashObject(['ifExpression', testExpr.hash, thenExpr.hash, elseExpr.hash]);
  }

  toDescription(level){
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `an if expression: if ${this.testExpr.toDescription(level)}, then ${this.thenExpr.toDescription(level)} `+
            `else ${this.elseExpr.toDescription(level)}`;
  }

  toString() {
    return `(if ${this.testExpr} ${this.thenExpr} ${this.elseExpr})`;
  }
}

export class Literal extends ASTNode {
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', [], options);
    this.value = value;
    this.dataType = dataType;
    this.hash = hashObject(['literal', this.value, this.dataType]);
  }

  *[Symbol.iterator]() {
    yield this;
  }

  toString() {
    return `${this.value}`;
  }
}

export class Comment extends ASTNode {
  constructor(from, to, comment, options={}) {
    super(from, to, 'comment', [], options);
    this.comment = comment;
    this.hash = hashObject(['comment', this.comment]);
  }

  toString() {
    return `${this.comment}`;
  }
}

export class Blank extends ASTNode {
  constructor(from, to, value, dataType='blank', options={}) {
    super(from, to, 'blank', [], options);
    this.value = value || "...";
    this.dataType = dataType;
    this.hash = hashObject(['blank', this.value, this.dataType]);
  }

  toString() {
    return `${this.value}`;
  }
}

export class Sequence extends ASTNode {
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sequence', ['exprs'], options);
    this.exprs = exprs;
    this.name = name;
    this.hash = hashObject(['sequence', this.name, this.exprs.map(expr => expr.hash)]);
  }

  toDescription(level) {
    if((this.level  - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
  }

  toString() {
    return `(${this.name} ${this.exprs.join(" ")})`;
  }
}

// TODO(Oak): Justin moves the above somewhere else. Need to change
