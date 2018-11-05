import {poscmp} from './utils';
const uuidv4 = require('uuid/v4');

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

// Ensure that no node in the set is the ancestor of another node in the set
function removeChildren(nodes) {
  let clean = [...nodes].sort((a, b) => a.path<b.path? -1 : a.path==b.path? 0 : 1);
  clean.reduce((n1, n2) => n2.path.includes(n1.path)? nodes.delete(n2) && n1 : n2, false);
  return nodes;
}

// given an oldAST, newAST and changeset, mark what was deleted+inserted
function markChanges(oldAST, newAST, changes) {
  let insertedRanges = new Set();
  changes.forEach(c => {
    // insertion: add to the insertedRanges set, and update the range locations
    if(c.text.join("").length > 0) insertedRanges.add({from: c.from, to: c.to});
    insertedRanges.forEach(r => {
      r.from = adjustForChange(r.from, c, true ); 
      r.to   = adjustForChange(r.to  , c, false);
    });
    // deletion: mark all nodes within oldAST as "deleted", then update node locations
    if(c.removed.join("").length > 0) 
      oldAST.getNodesBetween(c.from, c.to).forEach(n => n.deleted = true);
    oldAST.nodeIdMap.forEach(n => {
      n.from = adjustForChange(n.from, c, true );
      n.to   = adjustForChange(n.to,   c, false);
    });
  });
  // mark all the inserted notes in newAST as "inserted"
  insertedRanges.forEach(r =>
    newAST.getNodesBetween(r.from, r.to).forEach(n => n.inserted = true));
}

// patch : AST, AST, [ChangeObjs] -> AST
// FOR NOW: ASSUMES ALL CHANGES BOUNDARIES ARE NODE BOUNDARIES
// produce the new AST, preserving all the unchanged DOM nodes from the old AST
// and a set of nodes that must be re-rendered
export function patch(oldAST, newAST, CMchanges) {
  let dirtyNodes = new Set();
  markChanges(oldAST, newAST, CMchanges); // mark deleted and inserted nodes as such
  
  let newNodes = [...newAST.nodeIdMap.values()];
  let oldNodes = [...oldAST.nodeIdMap.values()];
  // Mark deleted node's parents as dirty, so they can be redrawn later
  oldNodes.forEach( n => { if(n.deleted) (oldAST.getNodeParent(n) || n).dirty = true; });
  
  // walk through the nodes, unifying those that are unchanged
  let newIdx = 0;
  oldNodes.forEach(oldNode => {
    let newNode = newNodes[newIdx];

    // skip over any inserted nodes
    while(newNode && newNodes[newIdx].inserted) { newNode = newNodes[newIdx++]; }

    // If we're out of newNodes, or if the oldNode was deleted, move to the next oldNode
    if(!newNode || oldNode.deleted) { return; }

    // This node hasn't been changed (although its children might have!) -- unify properties
    newNodes[newIdx].id = oldNode.id;       // keep the ID (for react reconciliation later)
    newNodes[newIdx].el = oldNode.el;       // keep the el (for old drawing code)
    newNodes[newIdx].dirty = oldNode.dirty; // keep dirty state (for old drawing code)
    newIdx++;
  });
  // Dirty nodes need to be added. Nodes without an el need their parents added (if they exist)
  newNodes.forEach(n => { if(n.dirty) dirtyNodes.add(n); });
  newNodes.forEach(n => { if(!n.el) dirtyNodes.add(newAST.getNodeParent(n) || n); });
  newAST.dirtyNodes = new Set(removeChildren(dirtyNodes));
  newAST.annotateNodes();
  return newAST;
}

function posWithinNode(pos, node) {
  return (poscmp(node.from, pos) <= 0) && (poscmp(node.to, pos) >  0)
    ||   (poscmp(node.from, pos) <  0) && (poscmp(node.to, pos) >= 0);
}

function nodeCommentContaining(pos, node) {
  return node.options.comment && posWithinNode(pos, node.options.comment);
}

function enumerateList(lst, level) {
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
    this.nodePathMap = new Map();
    this.nextNodeMap = new WeakMap();
    this.prevNodeMap = new WeakMap();
    this.annotateNodes();
  }

  toString() {
    return this.rootNodes.map(r => r.toString()).join('\n');
  }

  // annotateNodes : ASTNodes ASTNode -> Void
  // walk through the siblings, assigning aria-* attributes
  // and populating various maps for tree navigation
  annotateNodes(nodes=this.rootNodes, parent=false) {
    let lastNode = null;

    const loop = (nodes, parent) => {
      nodes.forEach((node, i) => {
        node.path = parent ? parent.path + ("," + i) : i.toString();
        node["aria-setsize"]  = nodes.length;
        node["aria-posinset"] = i + 1;
        node["aria-level"]    = 1 + (parent ? parent.path.split(",").length : 0);
        if (lastNode) {
          this.nextNodeMap.set(lastNode, node);
          this.prevNodeMap.set(node, lastNode);
        }
        this.nodeIdMap.set(node.id, node);
        this.nodePathMap.set(node.path, node);
        lastNode = node;
        const children = [...node].slice(1); // the first elt is always the parent
        loop(children, node);
      });
    };

    loop(nodes, parent);
  }

  getNodeById(id) {
    return this.nodeIdMap.get(id);
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
  getNodeAfter = selection => this.nextNodeMap.get(selection) || null;

  /**
   * getNodeBefore : ASTNode -> ASTNode
   *
   * Returns the previous node or null
   */
  getNodeBefore = selection => this.prevNodeMap.get(selection) || null;

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
    return n && ([...n].length == 1? n : this.getNodeContaining(cursor, [...n].slice(1)) || n);
  }
  // return an array of nodes that fall bewtween two locations
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
    // it's corresponding DOM element, or to look it up in `AST.nodeIdMap`
    this.id = uuidv4(); // generate a unique ID
  }

  toDescription(){
    return this.options["aria-label"];
  }
}

export class Unknown extends ASTNode {
  constructor(from, to, elts, options={}) {
    super(from, to, 'unknown', options);
    this.elts = elts;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let elt of this.elts) {
      yield elt;
    }
  }

  toDescription(level){
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `an unknown expression with ${pluralize("children", this.elts)} `+ 
      this.elts.map((e, i, elts)  => (elts.length>1? (i+1) + ": " : "")+ e.toDescription(level)).join(", ");
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }
}

export class Expression extends ASTNode {
  constructor(from, to, func, args, options={}) {
    super(from, to, 'expression', options);
    this.func = func;
    this.args = args;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.func;
    for (let arg of this.args) {
      yield arg;
    }
  }

  toDescription(level){
    // if it's the top level, enumerate the args
    if((this['aria-level'] - level) == 0) { 
      return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
    }
    // if we've bottomed out, use the aria label
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    // if we're in between, use "f of A, B, C" format
    else return `${this.func.toDescription()} of `+ this.args.map(a  => a.toDescription(level)).join(", ");
      
  }

  toString() {
    return `(${this.func} ${this.args.join(' ')})`;
  }
}

export class IdentifierList extends ASTNode {
  constructor(from, to, kind, ids, options={}) {
    super(from, to, 'identifierList', options);
    this.kind = kind;
    this.ids = ids;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let id of this.ids) {
      yield id;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return enumerateList(this.ids, level);
  }

  toString() {
    return `${this.ids.join(' ')}`;
  }
}

export class StructDefinition extends ASTNode {
  constructor(from, to, name, fields, options={}) {
    super(from, to, 'structDefinition', options);
    this.name = name;
    this.fields = fields;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.fields;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with
            ${this.fields.toDescription(level)}`;
  }

  toString() {
    return `(define-struct ${this.name} (${this.fields.toString()}))`;
  }
}

export class VariableDefinition extends ASTNode {
  constructor(from, to, name, body, options={}) {
    super(from, to, 'variableDefinition', options);
    this.name = name;
    this.body = body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    let insert = ["literal", "blank"].includes(this.body.type)? "" : "the result of:";
    return `define ${this.name} to be ${insert} ${this.body.toDescription(level)}`;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.body;
  }

  toString() {
    return `(define ${this.name} ${this.body})`;
  }
}

export class LambdaExpression extends ASTNode {
  constructor(from, to, args, body, options={}) {
    super(from, to, 'lambdaExpression', options);
    this.args = args;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.args;
    yield this.body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
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
    super(from, to, 'functionDefinition', options);
    this.name = name;
    this.params = params;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.params;
    yield this.body;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
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
    super(from, to, 'condClause', options);
    this.testExpr = testExpr;
    this.thenExprs = thenExprs;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.testExpr;
    for(let thenExpr of this.thenExprs) {
      yield thenExpr;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)}, then, ${this.thenExprs.map(te => te.toDescription(level))}`;
  }

  toString() {
    return `[${this.testExpr} ${this.thenExprs.join(' ')}]`;
  }
}

export class CondExpression extends ASTNode {
  constructor(from, to, clauses, options={}) {
    super(from, to, 'condExpression', options);
    this.clauses = clauses;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let clause of this.clauses) {
      yield clause;
    }
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
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
    super(from, to, 'ifExpression', options);
    this.testExpr = testExpr;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.testExpr;
    yield this.thenExpr;
    yield this.elseExpr;
  }

  toDescription(level){
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `an if expression: if ${this.testExpr.toDescription(level)}, then ${this.thenExpr.toDescription(level)} `+
            `else ${this.elseExpr.toDescription(level)}`;
  }

  toString() {
    return `(if ${this.testExpr} ${this.thenExpr} ${this.elseExpr})`;
  }
}

export class Literal extends ASTNode {
  constructor(from, to, value, dataType='unknown', options={}) {
    super(from, to, 'literal', options);
    this.value = value;
    this.dataType = dataType;
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
    super(from, to, 'comment', options);
    this.comment = comment;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  toString() {
    return `${this.comment}`;
  }
}

export class Blank extends ASTNode {
  constructor(from, to, value, dataType='blank', options={}) {
    super(from, to, 'blank', options);
    this.value = value || "...";
    this.dataType = dataType;
  }

  *[Symbol.iterator]() {
    yield this;
  }

  toString() {
    return `${this.value}`;
  }
}

export class Sequence extends ASTNode {
  constructor(from, to, exprs, name, options={}) {
    super(from, to, 'sequence', options);
    this.exprs = exprs;
    this.name = name;
  }

  *[Symbol.iterator]() {
    yield this;
    for (let expr of this.exprs) {
      yield expr;
    }
  }

  toDescription(level) {
    if((this['aria-level'] - level) >= descDepth) return this.options['aria-label'];
    return `a sequence containing ${enumerateList(this.exprs, level)}`;
  }

  toString() {
    return `(${this.name} ${this.exprs.join(" ")})`;
  }
}
