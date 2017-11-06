var jsonpatch = require('fast-json-patch');

function comparePos(a, b) {
  return a.line - b.line || a.ch - b.ch;
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

const descDepth = 2;


// This is the root of the *Abstract Syntax Tree*.  Parser implementations are
// required to spit out an `AST` instance.
export class AST {
  constructor(rootNodes) {
    // the `rootNodes` attribute simply contains a list of the top level nodes
    // that were parsed.
    this.rootNodes = rootNodes;
    // the `reverseRootNodes` attribute is a shallow, reversed copy of the rootNodes
    this.reverseRootNodes = rootNodes.slice().reverse();

    // the `nodeMap` attribute can be used to look up nodes by their id.
    // the other nodeMaps make it easy to determine node order
    this.nodeMap = new Map();
    this.nextNodeMap = new WeakMap();
    this.prevNodeMap = new WeakMap();

    this.lastNode = null;
    this.annotateNodes();
  }

  // annotateNodes : ASTNodes ASTNode -> Void
  // walk through the siblings, assigning aria-* attributes
  // and populating various maps for tree navigation
  annotateNodes(nodes=this.rootNodes, parent=false) {
    nodes.forEach((node, i) => {
      node.id = parent? parent.id + (","+i) : i.toString();
      node["aria-setsize"]  = nodes.length;
      node["aria-posinset"] = i+1;
      node["aria-level"]    = 1+(parent? parent.id.split(",").length : 0);
      if (this.lastNode) {
        this.nextNodeMap.set(this.lastNode, node);
        this.prevNodeMap.set(node, this.lastNode);
      }
      this.nodeMap.set(node.id, node);
      this.lastNode = node;
      var children = [...node].slice(1); // the first elt is always the parent
      this.annotateNodes(children, node);
    });
  } 

  // patch : AST -> AST
  // given a new AST, return a new one patched from the current one
  // taking care to preserve all rendered DOM elements, though!
  patch(newAST) {
    var patches = jsonpatch.compare(this.rootNodes, newAST.rootNodes);
    // preserve existing DOM elts, and collapsed state
    patches = patches.filter(p => !['el', 'collapsed'].includes(p.path.split('/').pop()));
    jsonpatch.applyPatch(this.rootNodes, patches);
    this.rootNodes.forEach(castToASTNode);
    return new AST(this.rootNodes);
  }

  getNodeById(id) {
    return this.nodeMap.get(id);
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
    let n = nodes.find(node => comparePos(node.from, cursor) <= 0 
                            && comparePos(node.to, cursor) >= 0);
    return n && ([...n].length == 1? n : this.getNodeContaining(cursor, [...n].slice(1)));
  }

  // return the parent or false
  getNodeParent(node) {
    let path = node.id.split(",");
    path.pop();
    return this.nodeMap.get(path.join(",")); 
  }
  // return the first child, if it exists
  getNodeFirstChild(node) {
    return this.nodeMap.get(node.id+",0");
  }

  getClosestNodeFromPath(keyArray) {
    // return the node, if the key is valid
    if(this.nodeMap.get(keyArray.join(","))) {
      return this.nodeMap.get(keyArray.join(","));
    }
    // if we have no valid key, give up
    if(keyArray.length == 0) return false;
    // if we're at the root level, count backwards till we find something
    if(keyArray.length == 1 && keyArray[0] >= 0) {
      return this.nodeMap.get(keyArray[0].toString())
          || this.getClosestNodeFromPath([keyArray[0] - 1]);
    // if we're at a child go to the previous sibling
    } else if(keyArray[keyArray.length-1] > 0) {
      keyArray[keyArray.length-1]--;
      return this.nodeMap.get(keyArray.join(','));
    // if we're at the first child, go up a generation
    } else {
      let parentArray = keyArray.slice(0, keyArray.length-1);
      return this.nodeMap.get(keyArray.join(','))
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
    // it's corresponding DOM element, or to look it up in `AST.nodeMap`
    this.id = null; // the id is set by setChildAttributes()
  }

  toDescription(level){
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

  // only read one level down
  toDescription(level){
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `applying the function ${this.func.toDescription()} to ${pluralize("argument", this.args)} `+
      this.args.map((a, i, args)  => (args.length>1? (i+1) + ": " : "")+ a.toDescription(level)).join(", ");
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name.toDescription(level)} to be a structure with ${pluralize("field", this.fields.ids)}: 
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be the result of: ${this.body.toDescription(level)}`;
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `an anonymous function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(lambda (${this.args.toString()}) ${this.body})`;
  }
}

export class FunctionDefinition extends ASTNode {
  constructor(from, to, name, args, body, options={}) {
    super(from, to, 'functionDefinition', options);
    this.name = name;
    this.args = args;
    this.body = body;
  }

  *[Symbol.iterator]() {
    yield this;
    yield this.name;
    yield this.args;
    yield this.body;
  }

  toDescription(level){
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `define ${this.name} to be a function of ${pluralize("argument", this.args.ids)}: 
            ${this.args.toDescription(level)}, with body:
            ${this.body.toDescription(level)}`;
  }

  toString() {
    return `(define (${this.name} ${this.args.toString()}) ${this.body})`;
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `condition: if ${this.testExpr.toDescription(level)} then ${this.thenExprs.map(te => te.toDescription(level))}.`;
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
    return `a conditional expression with ${pluralize("condition", this.clauses)}: 
            ${this.clauses.map(c => c.toDescription(level))}.`;
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
    if((this['aria-level']- level) >= descDepth) return this.options['aria-label'];
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
