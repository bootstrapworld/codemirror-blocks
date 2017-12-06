const uuidv4 = require('uuid/v4');
var jsonpatch = require('fast-json-patch');

function comparePos(a, b) {
  return a.line - b.line || a.ch - b.ch;
}
function posWithinNode(pos, node){
  return (comparePos(node.from, pos) <= 0) && (comparePos(node.to, pos) >= 0);
}

// Cast an object to the appropriate ASTNode, and traverse its children
// REVISIT: should we be using Object.setPrototypeOf() here? And good god, eval()?!?
function castToASTNode(o) {
  if(o.type !== o.constructor.name.toLowerCase()) {
    let desiredType = o.type.charAt(0).toUpperCase() + o.type.slice(1);
    o.__proto__ = eval(desiredType).prototype;              // cast the node itself
    if(o.options.comment) castToASTNode(o.options.comment); // cast the comment, if it exists
  }
  [...o].slice(1).forEach(castToASTNode);                   // traverse children
}

function enumerateList(lst) {
  lst = lst.slice(0);
  var last = lst.pop();
  return (lst.length == 0)? last.toString() : lst.join(', ') + " and "+last.toString();
}

function pluralize(noun, set) {
  return set.length+' '+noun+(set.length != 1? 's' : '');
}

function commonSubstring(s1, s2) {
  if(!s1 || !s2) return false;
  let i = 0, len = Math.min(s1.length, s2.length);
  while(i<len && s1.charAt(i) == s2.charAt(i)){ i++; } 
  return s1.substring(0, i) || false; 
}

const descDepth = 1;
const fields = ['aria-level','aria-setsize','aria-label','aria-posinset','line','ch'];

// This is the root of the *Abstract Syntax Tree*.  Parser implementations are
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

    this.lastNode = null;
    this.annotateNodes();
  }

  toString() {
    return this.rootNodes.map(r => r.toString()).join('\n');
  }

  // annotateNodes : ASTNodes ASTNode -> Void
  // walk through the siblings, assigning aria-* attributes
  // and populating various maps for tree navigation
  annotateNodes(nodes=this.rootNodes, parent=false) {
    nodes.forEach((node, i) => {
      node.path = parent? parent.path + (","+i) : i.toString();
      node["aria-setsize"]  = nodes.length;
      node["aria-posinset"] = i+1;
      node["aria-level"]    = 1+(parent? parent.path.split(",").length : 0);
      if (this.lastNode) {
        this.nextNodeMap.set(this.lastNode, node);
        this.prevNodeMap.set(node, this.lastNode);
      }
      this.nodeIdMap.set(node.id, node);
      this.nodePathMap.set(node.path, node);
      this.lastNode = node;
      var children = [...node].slice(1); // the first elt is always the parent
      this.annotateNodes(children, node);
    });
  } 

  // patch : AST [ChangeObj] -> AST
  // Given a new AST and some CM change objects, return a new AST patched from the current one.
  // Take care to preserve all rendered DOM elements, though!
  patch(newAST, changes) {
    var ast, patches, pathArray, that = this, dirtyPaths = new Set();
    // annotate a changeObject with adjFrom, insertedToPos, and common ancestor path information
    function annotateChanges({from, to, text, removed}) {
      let lastText = text[text.length-1], lastRemoved = removed[removed.length-1];
      var insertedToPos = {
        line: from.line + (text.length - removed.length), 
        ch: lastText.length + (text.length==removed.length==1)? from.ch+lastText.length-lastRemoved.length : 0
      };
      // before selecting nodes, adjust ranges for removed text based on whitespace padding
      let startWS = removed[0].match(/^\s+/), endWS = removed[removed.length-1].match(/\s+$/);
      if(startWS) { from.ch = from.ch + startWS[0].length; }
      if(endWS)   { to.ch   = to.ch   - endWS[0].length;   }
      let fromNode = that.getRootNodesTouching(from, from)[0];                 // is there a containing rootNode?
      let adjFrom  = fromNode? fromNode.from : from;                           // if so, use that node's .from
      return {
        from: from, to: to, text: text, removed: removed, adjFrom: adjFrom, insertedToPos: insertedToPos,
        path: that.getCommonAncestorPath(that.getNodeContaining(from), newAST.getNodeContaining(to))
      };
    }
    // given a path-ordered list of changes and new change, either add the change or combine it with an existing one
    function coalescePaths(changes, c) {
      if(changes.length == 0) return [c];                                       // if this is our only change, add it
      let common = changes[0].path && c.path && commonSubstring(changes[0].path,c.path); // is there a common path?
      if(common) { c.path = common; changes.shift(); }                          // if yes, drop the most-recent change
      return [c].concat(changes);                                               // add the new change to the list
    }
    // apply an annotated change, by either patching a subtree or splicing roots
    function applyChange({from, to, text, removed, adjFrom, insertedToPos, path}) {
      if(path && (pathArray = path.split(',')).length > 1) {                    // PATCH A SUBTREE
        // if it's an insertion or deletion, set the path to the *parent*
        if((comparePos(from,to)==0) || (text.join("")=="")) { path = pathArray.slice(0,-1).join(','); }
        patches = jsonpatch.compare(that.getNodeByPath(path), newAST.getNodeByPath(path));
        patches = patches.filter(p => p.path.split('/').pop() !== 'el');        // Save the DOM element for rendering
        jsonpatch.applyPatch(that.getNodeByPath(path), patches, false);         // Perf: false = don't validate patches
        castToASTNode(that.getNodeByPath(path));                                // Ensure the correct nodeTypes
        dirtyPaths.add(path);
      } else {                                                                  // SPLICE ROOTS
        let removedRoots  = that.getRootNodesTouching(from, to);
        let insertedRoots = newAST.getRootNodesTouching(adjFrom, insertedToPos);
        for(var i=0; i<that.rootNodes.length; i++){ if(comparePos(adjFrom, that.rootNodes[i].from)<=0) break;  }
        that.rootNodes.splice(i, removedRoots.length, ...insertedRoots);
        insertedRoots.forEach(n => dirtyPaths.add(n.path));
      }
    }
    changes = changes.map(annotateChanges);
    changes.sort((a, b) => a.path < b.path? -1 : a.path > b.path? 1 : 0);       // sort by path
    changes = changes.reduce(coalescePaths, []);                                // coalesce changes by ancestor
    changes.forEach(applyChange);                                               // apply the changes
    patches = jsonpatch.compare(this.rootNodes, newAST.rootNodes);              // generate patches for this v. newAST 
    patches = patches.filter(p => fields.includes(p.path.split('/').pop()));    // only patch fields we care about
    jsonpatch.applyPatch(this.rootNodes, patches, false);                       // Perf: false = don't validate patches
    ast = new AST(this.rootNodes);                                              // build new AST from patched rootNodes
    ast.dirtyPaths = Array.from(dirtyPaths);                                    // track paths that need (re-)rendering
    return ast;
  }

  getNodeById(id) {
    return this.nodeIdMap.get(id);
  }
  getNodeByPath(path) {
    return this.nodePathMap.get(path);
  }

  // return the next node or false
  getNodeAfter(selection) {
    return this.nextNodeMap.get(selection)
        || this.rootNodes.find(node => comparePos(node.from, selection) >= 0)
        || false;
  }
  // return the previous node or false
  getNodeBefore(selection) {
    return this.prevNodeMap.get(selection)
        || this.reverseRootNodes.find(node => comparePos(node.to, selection) <= 0)
        || false;
  }
  // return the node containing the cursor, or false
  getNodeContaining(cursor, nodes = this.rootNodes) {
    let n = nodes.find(node => posWithinNode(cursor, node));
    return n && ([...n].length == 1? n : this.getNodeContaining(cursor, [...n].slice(1)) || n);
  }
  // return all the root nodes that contain the given positions, or fall between them
  getRootNodesTouching(start, end, rootNodes=this.rootNodes){
    return rootNodes.filter(node =>
      posWithinNode(start, node) || posWithinNode(end, node) ||
      ( (comparePos(start, node.from) < 0) && (comparePos(end, node.to) > 0) ));
  }
  // return the common ancestor containing two nodes, or false
  // if two nodes are given, walk their paths to find the nearest common ancestor
  getCommonAncestorPath(n1, n2) {
    if(!n1 || !n2) return false;
    return commonSubstring(n1.path, n2.path);
  }
  // return the parent or false
  getNodeParent(node) {
    let path = node.path.split(",");
    path.pop();
    return this.nodePathMap.get(path.join(",")); 
  }
  // return the first child, if it exists
  getNodeFirstChild(node) {
    return this.nodePathMap.get(node.path+",0");
  }

  getClosestNodeFromPath(keyArray) {
    // return the node, if the key is valid
    if(this.nodePathMap.get(keyArray.join(","))) {
      return this.nodePathMap.get(keyArray.join(","));
    }
    // if we have no valid key, give up
    if(keyArray.length == 0) return false;
    // if we're at the root level, count backwards till we find something
    if(keyArray.length == 1 && keyArray[0] >= 0) {
      return this.nodePathMap.get(keyArray[0].toString())
          || this.getClosestNodeFromPath([keyArray[0] - 1]);
    // if we're at a child go to the previous sibling
    } else if(keyArray[keyArray.length-1] > 0) {
      keyArray[keyArray.length-1]--;
      return this.nodePathMap.get(keyArray.join(','));
    // if we're at the first child, go up a generation
    } else {
      let parentArray = keyArray.slice(0, keyArray.length-1);
      return this.nodePathMap.get(keyArray.join(','))
          || this.getClosestNodeFromPath(parentArray);
    }
  }

  // getNextMatchingNode : (ASTNode->ASTNode) (ASTNode->Bool) ASTNode -> ASTNode
  // Consumes a search function, a test function, and a starting ASTNode. 
  // Calls searchFn(Start) over and over until testFn(Node)==true 
  getNextMatchingNode(searchFn, testFn, start) {
    let nextNode = searchFn(start);
    while (nextNode && testFn(nextNode)) {
      nextNode = searchFn(nextNode);
    }
    return nextNode || start;
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
    // like to persist information from your parser about a particular node, all
    // the way through to the renderer. For example, when parsing wescheme code,
    // human readable aria labels are generated by the parser, stored in the
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
    return enumerateList(this.ids);
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
    return `a sequence containing ${enumerateList(this.exprs)}`;
  }

  toString() {
    return `(${this.name} ${this.exprs.join(" ")})`;
  }
}
