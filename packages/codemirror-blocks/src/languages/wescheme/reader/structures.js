/* eslint-disable */
// Vendored from wescheme-js 0.0.4 (github.com/bootstrapworld/wescheme-js),
// which is LGPL 2.1 (see ./LICENSE), and maintained here: the editor's reader.
/*global */

var types = require('./types');

// (the compiler's modules and analyzer are not part of the editor's reader: what
// calls for them is the compiler's, and is never called here)
function notHere(name) {
  throw new Error('wescheme: ' + name + ' is not part of the reader');
}

var Vector = types.Vector;

//////////////////////////////////////////////////////////////////////////////
/////////////////// COMMON FUNCTIONS AND STRUCTURES //////////////////////////
//////////////// used by multiple phases of the compiler/////////////////////

/**************************************************************************
 *
 *    CONVERT LOCAL COMPILER ERRORS INTO WESCHEME ERRORS
 *
 **************************************************************************/
// encode the msg and location as a JSON error
export function throwError(msg, loc, errorClass) {
  loc.source = loc.source || "<unknown>"; // FIXME -- we should have the source populated
  // rewrite a ColoredPart to match the format expected by the runtime
  function rewritePart(part){
    if(typeof(part) === 'string'){
      return part;
    } else if(part instanceof symbolExpr){
      return '["span", [["class", "SchemeValue-Symbol"]], '+part.val+']';
    } else if(part.location !== undefined){
      return {text: part.text, type: 'ColoredPart', loc: part.location.toString()
        , toString: function(){return part.text;}};
    } else if(part.locations !== undefined){
      return {text: part.text, type: 'MultiPart', solid: part.solid
        , locs: part.locations.map(function(l){return l.toString()})
        , toString: function(){return part.text;}};
    }
  }

  msg.args = msg.args.map(rewritePart);

  var json = {type: "moby-failure"
    , "dom-message": ["span"
      ,[["class", "Error"]]
      ,["span"
        , [["class", (errorClass || "Message")]]].concat(
          (errorClass? [["span"
            , [["class", "Error.reason"]]
            , msg.toString()]
            , ["span", [["class", ((errorClass || "message")
              +((errorClass === "Error-GenericReadError")?
                ".locations"
                :".otherLocations"))]]]]
            : msg.args.map(function(x){return x.toString();})))
      ,["br", [], ""]
      ,["span"
        , [["class", "Error.location"]]
        , ["span"
          , [["class", "location-reference"]
            , ["style", "display:none"]]
          , ["span", [["class", "location-offset"]], (loc.startChar+1).toString()]
          , ["span", [["class", "location-line"]]  , loc.startRow.toString()]
          , ["span", [["class", "location-column"]], loc.startCol.toString()]
          , ["span", [["class", "location-span"]]  , loc.span.toString()]
          , ["span", [["class", "location-id"]]    , loc.source.toString()]
        ]
      ]
    ]
    , "structured-error": JSON.stringify({message: (errorClass? false : msg.args), location: loc.toString() })
  };
  throw JSON.stringify(json);
}

// couple = pair
export function couple(first, second) {
  this.first = first;
  this.second = second;
  this.toString = function(){
    return "("+this.first.toString() +" "+this.second.toString()+")";
  };
}

/**************************************************************************
 *
 *    AST Nodes
 *
 **************************************************************************/

// all Programs, by default, print out their values
// anything that behaves differently must provide their own toString() function
export class Program {
  // every Program has a location, but it's initialized to null
  constructor(){
    this.location = null;
  }
  // -> String
  toString() { return this.val.toString(); }
}

// Comment
export class comment extends Program {
  constructor(txt) { super(); this.txt = txt; }
  toString() { return ";"+this.txt; }
}

// Function definition
export class defFunc extends Program {
  constructor(name, args, body, stx) {
    super();
    this.name = name;
    this.args = args;
    this.body = body;
    this.stx  = stx;
  }
  toString() {
    return "(define ("+this.name.toString()+" "+this.args.join(" ")+")\n    "+this.body.toString()+")";
  }
}

// Variable definition
export class defVar extends Program {
  constructor(name, expr, stx) {
    super();
    this.name = name;
    this.expr = expr;
    this.stx  = stx;
  }
  toString() {
    return "(define "+this.name.toString()+" "+this.expr.toString()+")";
  }
}

// Multi-Variable definition
export class defVars extends Program {
  constructor(names, expr, stx) {
    super();
    this.names  = names;
    this.expr   = expr;
    this.stx    = stx;
  }
  toString() {
    return "(define-values ("+this.names.join(" ")+") "+this.expr.toString()+")";
  }
}

// Structure definition
export class defStruct extends Program {
  constructor(name, fields, stx) {
    super();
    this.name   = name;
    this.fields = fields;
    this.stx    = stx;
  }
  toString() {
    return "(define-struct "+this.name.toString()+" ("+this.fields.join(" ")+"))";
  }
}

// Begin expression
export class beginExpr extends Program {
  constructor(exprs, stx) {
    super();
    this.exprs  = exprs;
    this.stx    = stx;
  }
  toString() {
    return "(begin "+this.exprs.join(" ")+")";
  }
}

// Lambda expression
export class lambdaExpr extends Program {
  constructor(args, body, stx) {
    super();
    this.args = args;
    this.body = body;
    this.stx  = stx;
  }
  toString() {
    return "(lambda ("+this.args.join(" ")+") "+this.body.toString()+")";
  }
}

// Local expression
export class localExpr extends Program {
  constructor(defs, body, stx) {
    super();
    this.defs = defs;
    this.body = body;
    this.stx  = stx;
  }
  toString() {
    return "(local ("+this.defs.join(" ")+") "+this.body.toString()+")";
  }
}

// Letrec expression
export class letrecExpr extends Program {
  constructor(bindings, body, stx) {
    super();
    this.bindings = bindings;
    this.body     = body;
    this.stx      = stx;
  }
  toString() {
    return "(letrec ("+this.bindings.join(" ")+") ("+this.body.toString()+"))";
  }
}

// Let expression
export class letExpr extends Program {
  constructor(bindings, body, stx) {
    super();
    this.bindings = bindings;
    this.body     = body;
    this.stx      = stx;
  }
  toString() {
    return "(let ("+this.bindings.join(" ")+") ("+this.body.toString()+"))";
  }
}

// Let* expressions
export class letStarExpr extends Program {
  constructor(bindings, body, stx) {
    super();
    this.bindings = bindings;
    this.body     = body;
    this.stx      = stx;
  }
  toString() {
    return "(let* ("+this.bindings.join(" ")+") ("+this.body.toString()+"))";
  }
}

// cond expression
export class condExpr extends Program {
  constructor(clauses, stx){
    super();
    this.clauses  = clauses;
    this.stx      = stx;
  }
  toString() {
    return "(cond\n    "+this.clauses.join("\n    ")+")";
  }
}

// Case expression
export class caseExpr extends Program {
  constructor(expr, clauses, stx) {
    super();
    this.expr     = expr;
    this.clauses  = clauses;
    this.stx      = stx;
  }
  toString() {
    return "(case "+this.expr.toString()+"\n    "+this.clauses.join("\n    ")+")";
  }
}

// and expression
export class andExpr extends Program {
  constructor(exprs, stx) {
    super();
    this.exprs  = exprs;
    this.stx    = stx;
  }
  toString() { return "(and "+this.exprs.join(" ")+")"; }
}

// or expression
export class orExpr extends Program {
  constructor(exprs, stx) {
    super();
    this.exprs  = exprs;
    this.stx    = stx;
  }
  toString() { return "(or "+this.exprs.join(" ")+")"; }
}

// application expression
export class callExpr extends Program {
  constructor(func, args, stx) {
    super();
    this.func   = func;
    this.args   = args;
    this.stx    = stx;
  }
  toString() {
    return "("+[this.func].concat(this.args).join(" ")+")";
  }
}

// if expression
export class ifExpr extends Program {
  constructor(predicate, consequence, alternative, stx) {
    super();
    this.predicate = predicate;
    this.consequence = consequence;
    this.alternative = alternative;
    this.stx = stx;
  }
  toString() {
    return "(if "+this.predicate.toString()+" "+this.consequence.toString()+" "+this.alternative.toString()+")";
  }
}

// when/unless expression
export class whenUnlessExpr extends Program {
  constructor(predicate, exprs, stx){
    super();
    this.predicate = predicate;
    this.exprs = exprs;
    this.stx = stx;
  }
  toString() {
    return "("+this.stx[0]+" "+this.predicate.toString()+" "+this.exprs.join(" ")+")";
  }
}

// symbol expression (ID)
export class symbolExpr extends Program {
  constructor(val, stx) {
    super();
    this.val = val;
    this.stx = stx;
  }
}

// Literal values (String, Char, Number, Vector)
export class literal extends Program {
  constructor(val) {
    super();
    this.val = val;
  }
  toString() {
    // racket prints booleans using #t and #f
    if(this.val===true) return "#t";
    if(this.val===false) return "#f";
    // racket prints special chars using their names
    if(this.val instanceof types.Char){
      var c = this.val.val;
      return c === '\b' ? '#\\backspace' :
      c === '\t' ? '#\\tab' :
      c === '\n' ? '#\\newline' :
      c === ' '  ? '#\\space' :
      c === '\v' ? '#\\vtab' :
      /* else */  this.val.toWrittenString();
    }
    return types.toWrittenString(this.val);
  }
}

Vector.prototype.toString = Vector.prototype.toWrittenString = function(){
  var filtered = this.elts.filter(function(e){return e!==undefined;}),
    last = filtered[filtered.length-1];
  return "#("+this.elts.map(function(elt){return elt===undefined? last : elt;}).join(" ")+")";
}

// quoted expression
export class quotedExpr extends Program {
  constructor(val){
    super();
    this.val = val;
  }
  toString() {
    function quoteLikePairP(v) {
      return v instanceof Array
      && v.length === 2
      && v[0] instanceof symbolExpr
      && ( v[0].val === 'quasiquote'
        || v[0].val === 'quote'
        || v[0].val === 'unquote'
        || v[0].val === 'unquote-splicing'
      ) }
    function shortName(lexeme) {
      var s = lexeme.val
      return s === 'quasiquote' ? "`" :
      s === 'quote' ? "'" :
      s === 'unquote' ? "," :
      s === 'unquote-splicing' ? ",@" :
      (function () { throw "impossible quote-like string" })()
    }
    function elementToString(v) {
      if (quoteLikePairP(v)) {
        return shortName(v[0]).concat(elementToString(v[1]))
      } else if (v instanceof Array) {
        return v.reduce(function (acc, x) { return acc.concat(elementToString(x)) }, "(").concat(")")
      } else {
        return v.toString()
      }
    }
    return "'"+elementToString(this.val)
  }
}

// unquoted expression
export class unquotedExpr extends Program {
  constructor(val) {
    super();
    this.val = val;
  }
  toString() { return ","+this.val.toString(); }
}

// quasiquoted expression
export class quasiquotedExpr extends Program {
  constructor(val) {
    super();
    this.val = val;
  }
  toString() {
    if(this.val instanceof Array) return "`("+this.val.toString()+")";
    else return "`"+this.val.toString();
  }
}

// unquote-splicing
export class unquoteSplice extends Program {
  constructor(val) {
    super();
    this.val = val;
  }
  toString() { return ",@"+this.val.toString();}
}

// require expression
export class requireExpr extends Program {
  constructor(spec, stx) {
    super();
    this.spec = spec;
    this.stx  = stx;
  }
  toString() { return "(require "+this.spec.toString()+")"; }
}

// provide expression
export class provideStatement extends Program {
  constructor(clauses, stx) {
    super();
    this.clauses  = clauses;
    this.stx      = stx;
  }
  toString() { return "(provide "+this.clauses.join(" ")+")" }
}

// Unsupported structure (allows us to generate parser errors ahead of "unsupported" errors)
export class unsupportedExpr extends Program {
  constructor(val, errorMsg, errorSpan) {
    super();
    this.val = val;
    this.errorMsg = errorMsg;
    this.errorSpan = errorSpan; // when throwing an error, we use a different span from the actual sexp span
  }
  toString() { return this.val.toString() }
}


export function isExpression(node){
  return !(   (node instanceof defVar)
    || (node instanceof defVars)
    || (node instanceof defStruct)
    || (node instanceof defFunc)
    || (node instanceof provideStatement)
    || (node instanceof unsupportedExpr)
    || (node instanceof requireExpr));
}

export function isDefinition(node){
  return (node instanceof defVar)
  || (node instanceof defVars)
  || (node instanceof defStruct)
  || (node instanceof defFunc);
}

/**************************************************************************
 *
 *    STRUCTURES NEEDED BY THE COMPILER
 *
 **************************************************************************/

// moduleBinding: records an id and its associated JS implementation.
export function moduleBinding(name, source, bindings){
  this.name     = name;
  this.source   = source;
  this.bindings = bindings;
}

// constantBinding: records an id and its associated JS implementation.
export function constantBinding(name, moduleSource, permissions, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.permissions = permissions;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

// functionBinding: try to record more information about the toplevel-bound function
export function functionBinding(name, moduleSource, minArity, isVarArity, permissions, isCps, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.minArity = minArity;
  this.isVarArity = isVarArity;
  this.permissions = permissions;
  this.isCps = isCps;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

// structBinding: A binding to a structure.
// structBinding : symbol, ?, (listof symbol), symbol, symbol, (listof symbol) (listof symbol) (listof permission), location -> Binding
export function structBinding(name, moduleSource, fields, constructor,
                       predicate, accessors, mutators, permissions, loc){
  this.name = name;
  this.moduleSource = moduleSource;
  this.fields = fields;
  this.constructor = constructor;
  this.predicate = predicate;
  this.accessors = accessors;
  this.mutators = mutators;
  this.permissions = permissions;
  this.loc = loc;
  this.toString = function(){return this.name;};
  return this;
}

export var keywords = ["cond", "else", "let", "case", "let*", "letrec", "quote",
  "quasiquote", "unquote","unquote-splicing","local","begin",
  "if","or","and","when","unless","lambda","λ","define",
  "define-struct", "define-values"];

// STACKREF STRUCTS ////////////////////////////////////////////////////////////////
export class baseStackReference {
  constructor() {
    this.type = 'base';
  }
}
export class localStackReference extends baseStackReference {
  constructor(name, isBoxed, depth) {
    super();
    this.name = name;
    this.isBoxed = isBoxed;
    this.depth = depth;
  }
}
export class globalStackReference extends baseStackReference {
  constructor(name, depth, pos) {
    super();
    this.name = name;
    this.pos = pos;
    this.depth = depth;
  }
}
export class unboundStackReference extends baseStackReference {
  constructor(name) {
    super();
    this.name = name;
  }
}

// ENVIRONMENT STRUCTS ////////////////////////////////////////////////////////////////
// Representation of the stack environment of the mzscheme vm, so we know where
// things live.
export class env{
  constructor(bindings){
    this.bindings = bindings || new Map();
    this.keys = this.bindings.keys;
  }
  // lookup : Symbol -> (or/c binding false)
  lookup(id){
    return (this.bindings.has(id))? this.bindings.get(id) : false;
  }

  // peek: Number -> env
  peek(depth){
    return (depth==0)?                  this
    :  (this instanceof emptyEnv)?  "IMPOSSIBLE - peeked at an emptyEnv!"
    /* else */                   : this.parent.peek(depth-1);
  }

  // contains?: symbol -> boolean
  contains(name){
    return this.lookup(name) !== false;
  }

  // extend: binding -> env
  extend(binding){
    this.bindings.set(binding.name, binding);
    return new env(this.bindings);
  }

  // extendFunction : symbol (or/c string false) number boolean? Loc -> env
  // Extends the environment with a new function binding
  extendFunction(id, moduleSource, minArity, isVarArity, loc){
    return this.extend(new functionBinding(id, moduleSource, minArity, isVarArity, [], false, loc));
  }

  // extendConstant : string (modulePath || false) Loc -> env
  extendConstant(id, moduleSource, loc){
    return this.extend(new constantBinding(id, moduleSource, [], loc));
  }

  // lookup_context: identifier -> (binding | false)
  // Lookup an identifier, taking into account the context of the identifier.  If it has no existing
  // context, look at the given env. In either case, either return a binding, or false.
  lookup_context(id){
    if(id.context instanceof env){
      return id.context.contains(id)? id.context.lookup(id) : false;
    } else {
      return this.contains(id)? this.lookup(id) : false;
    }
  }

  // traverse rthe bindings of the module
  extendEnv_moduleBinding(module){
    return module.bindings.reduceRight(function(env, binding){ return env.extend(binding);}, this);
  }

  toString(){
    return this.bindings.values().reduce(function(s, b){
      return s+"\n  |---"+b.name;}, "");
  }
}

// sub-classes of env
export class emptyEnv extends env {
  constructor(){
    super();
  }
  lookup(name){ return new unboundStackReference(name); }
}

export class unnamedEnv extends env {
  constructor(parent) {
    super();
    this.parent = parent;
  }
  lookup(name, depth){ return this.parent.lookup(name, depth+1); }
}

export class localEnv extends env{
  constructor(name, boxed, parent) {
    super();
    this.name   = name;
    this.boxed  = boxed;
    this.parent = parent;
  }
  lookup(name, depth){
    return (name===this.name)? new localStackReference(name, this.boxed, depth)
    : this.parent.lookup(name, depth+1);
  }
}

export class globalEnv extends env {
  constructor(names, boxed, parent) {
    super();
    this.names  = names;
    this.boxed  = boxed;
    this.parent = parent;
  }
  lookup(name, depth){
    var pos = this.names.indexOf(name);
    return (pos > -1)? new globalStackReference(name, depth, pos)
                    : this.parent.lookup(name, depth+1);
  }
}

// PINFO STRUCTS ////////////////////////////////////////////////////////////////
var defaultCurrentModulePath = "";

// default-module-resolver: symbol -> (module-binding | false)
// loop through known modules and see if we know this name
export var defaultModuleResolver = function(name){
  // TODO: fix this circular dependency
  var modules = notHere('modules')
  for(var i=0; i<modules.knownModules.length; i++){
    if(modules.knownModules[i].name === name) return modules.knownModules[i];
  }
  return false;
}

// Compute the edit distance between the two given strings
// from http://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance
function levenshteinDistance(a, b) {
  if(a.length === 0) return b.length;
  if(b.length === 0) return a.length;

  var matrix = [];

  // increment along the first column of each row
  for(var i = 0; i <= b.length; i++){ matrix[i] = [i]; }

  // increment each column in the first row
  for(var j = 0; j <= a.length; j++){ matrix[0][j] = j; }

  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
          Math.min(matrix[i][j-1] + 1, // insertion
            matrix[i-1][j] + 1)); // deletion
      }
    }
  }
  return matrix[b.length][a.length];
}

// moduleGuess: symbol -> symbol
// loop through known modules and make best suggestion for a given name
export function moduleGuess(wrongName){
  // TODO: fix this circular dependency
  var modules = notHere('modules')
  return modules.knownModules.reduce(function(best, module){
    var dist = levenshteinDistance(module.name, wrongName);
    return (dist < best.distance)? {name: module.name, distance: dist} : best;
  }, {name: wrongName, distance: 5});
}

// default-module-path-resolver: module-path module-path -> module-name
// Provides a default module resolver.
export function defaultModulePathResolver(path){
  // anything of the form wescheme/w+, or that has a known collection AND module
  var parts = path.toString().split("/"),
    collectionName = parts[0];
  // TODO: fix this circular dependency
  var modules = notHere('modules')
  return (modules.knownCollections.includes(collectionName)
          && defaultModuleResolver(path.toString()))
        || /^wescheme\/\w+$/.exec(path);
}


// pinfo (program-info) is the "world" structure for the compilers;
// it captures the information we get from analyzing and compiling
// the program, and also maintains some auxillary structures.
export class pinfo{
  constructor(env, modules, usedBindingsHash, freeVariables, gensymCounter,
               providedNames,definedNames, sharedExpressions,
               withLocationEmits, allowRedefinition,
               moduleResolver, modulePathResolver, currentModulePath,
               declaredPermissions){
    this.env = env || new emptyEnv();                       // env
    this.modules = modules || [];                           // (listof module-binding)
    this.usedBindingsHash = usedBindingsHash || new Map();  // (hashof symbol binding)
    this.freeVariables = freeVariables || [];               // (listof symbol)
    this.gensymCounter = gensymCounter || 0;                // number
    this.providedNames = providedNames || new Map();        // (hashof symbol provide-binding)
    this.definedNames  = definedNames  || new Map();        // (hashof symbol binding)

    this.sharedExpressions = sharedExpressions || new Map();// (hashof expression labeled-translation)
    // Maintains a mapping between expressions and a labeled translation.  Acts
    // as a symbol table to avoid duplicate construction of common literal values.

    // If true, the compiler emits calls to plt.Kernel.setLastLoc to maintain
    // source position during evaluation.
    this.withLocationEmits = withLocationEmits || true;     // boolean

    // If true, redefinition of a value that's already defined will not raise an error.
    this.allowRedefinition = allowRedefinition || false;     // boolean

    // For the module system.
    // (module-name -> (module-binding | false))
    this.moduleResolver = moduleResolver || defaultModuleResolver;
    // (string module-path -> module-name)
    this.modulePathResolver = modulePathResolver || defaultModulePathResolver;
    // module-path
    this.currentModulePath = currentModulePath || defaultCurrentModulePath;

    this.declaredPermissions = declaredPermissions || [];   // (listof (listof symbol any/c))
    // usedBindings: -> (listof binding)
    // Returns the list of used bindings computed from the program analysis.
    this.usedBindings =  function(){ return Array.from(this.usedBindingsHash.values()); };
    
  }
  /////////////////////////////////////////////////
  // functions for manipulating pinfo objects
  isRedefinition(name){ return this.env.lookup(name); }

  accumulateDeclaredPermission(name, permission){
    this.declaredPermissions = [[name, permission]].concat(this.declaredPermissions);
    return this;
  }

/*  // stub - AFAICT, this is unused by the compiler
  makeLabeledTranslation() { return false; }
  accumulateSharedExpression(expression, translation){
    var labeledTranslation = makeLabeledTranslation(this.gensymCounter, translation);
    this.sharedExpressions.set(labeledTranslation, expression);
    return this;
  }
*/
  // accumulateDefinedBinding: binding loc -> pinfo
  // Adds a new defined binding to a pinfo's set.
  accumulateDefinedBinding(binding, loc){
    if(keywords.includes(binding.name)){
      throwError(new types.Message([new types.ColoredPart(binding.name, loc),
        ": this is a reserved keyword and cannot be used"+
        " as a variable or function name"])
        ,loc);
    } else if(!this.allowRedefinition && this.isRedefinition(binding.name)){
      var prevBinding = this.env.lookup(binding.name);
      if(prevBinding.loc){
        throwError(new types.Message([new types.ColoredPart(binding.name, loc),
          ": this name has a ",
          new types.ColoredPart("previous definition", prevBinding.loc),
          " and cannot be re-defined"])
          ,loc);

      } else {
        throwError(new types.Message([new types.ColoredPart(binding.name, loc),
          ": this name has a ",
          "previous definition",
          " and cannot be re-defined"])
          ,loc);

      }
    } else {
      this.env.extend(binding);
      this.definedNames.set(binding.name, binding);
      return this;
    }
  }

  // accumulateBindings: (listof binding) Loc -> pinfo
  // Adds a list of defined bindings to the pinfo's set.
  accumulateDefinedBindings(bindings, loc){
    var that = this;
    bindings.forEach(function(b){that.accumulateDefinedBinding(b, loc);});
    return this;
  }


  // accumuldateModuleBindings: (listof binding) -> pinfo
  // Adds a list of module-imported bindings to the pinfo's known set of bindings, without
  // including them within the set of defined names.
  accumulateModuleBindings(bindings){
    var that = this;
    bindings.forEach(function(b){that.env.extend(b);});
    return this;
  }

  // accumulateModule: module-binding -> pinfo
  // Adds a module to the pinfo's set.
  accumulateModule(module){
    this.modules = [module].concat(this.modules);
    return this;
  }

  // accumulateBindingUse: binding -> pinfo
  // Adds a binding's use to a pinfo's set, if it has not already been used as a global
  // This qualifier allows a fn argument to shadow a global, without removing it from the environment
  accumulateBindingUse(binding){
    var alreadyExists = this.usedBindingsHash.get(binding.name);
    // if it's a module binding, don't replace it with a different kind of binding
    if(!(alreadyExists && alreadyExists.moduleSource)){
      this.usedBindingsHash.set(binding.name, binding);
    }
    return this;
  }

  // accumulateFreeVariableUse: symbol -> pinfo
  // Mark a free variable usage.
  accumulateFreeVariableUse(sym){
    this.freeVariables = this.freeVariables.includes(sym)?
        this.freeVariables : [sym].concat(this.freeVariables);
    return this;
  }

  // gensym: symbol -> [pinfo, symbol]
  // Generates a unique symbol
  gensym(label){
    return [this, new symbolExpr(label+this.gensymCounter++)];
  }

  // permissions: -> (listof permission)
  // Given a pinfo, collect the list of permissions.
  permissions(){
    // onlyUnique : v, idx, arr -> arr with unique elts
    // from http://stackoverflow.com/questions/1960473/unique-values-in-an-array
    function onlyUnique(value, index, self) { return self.indexOf(value) === index; }
    // if it's a function or constant binding, add its permissions to the list
    function reducePermissions(permissions, b){
      return (((b instanceof functionBinding) || (b instanceof constantBinding))
        && (b.permissions.length > 0))?
      permissions.concat(b.permissions) : permissions;
    }
    return Array.from(this.usedBindings()).reduce(reducePermissions, []).filter(onlyUnique);
  }

  // getExposedBindings:  -> (listof binding)
  // Extract the list of the defined bindings that are exposed by provide.
  // NOT USED!!
  getExposedBindings(){
    var that = this;
    // lookupProvideBindingInDefinitionBindings: provide-binding compiled-program -> (listof binding)
    // Lookup the provided bindings.
    function lookupProvideBindingInDefinitionBindings(provideBinding){
      // if it's not defined, throw an error
      if(!that.definedNames.has(provideBinding.symbl)){
        throwError(new types.Message(["provided-name-not-defined: ", provideBinding.symbl]));
      }
      // if it IS defined, let's examine it and make sure it is what it claims to be
      var binding = checkBindingCompatibility(binding, that.definedNames.get(provideBinding.symbl));

      // ref: symbol -> binding
      // Lookup the binding, given the symbolic identifier.
      function ref(id){ return that.definedNames.get(id); }

      // if it's a struct provide, return a list containing the constructor and predicate,
      // along with all the accessor and mutator functions
      // TODO: fix this circular dependency
      var analyzer = notHere('analyzer')
      if(provideBinding instanceof analyzer.provideBindingStructId){
        return [ref(binding.constructor), ref(binding.predicate)].concat(
          binding.accessors.map(ref), binding.mutators.map(ref));
      } else {
        return [binding];
      }
    }

    // decorateWithPermissions: binding -> binding
    // THIS IS A HACK according to Danny's original sources...not sure why
    function decorateWithPermissions(binding){
      var bindingEntry = function(entry){return entry[0]===binding.name;},
        filteredPermissions = that.declaredPermissions.filter(bindingEntry);
      binding.permissions = filteredPermissions.map(function(p){return p[1];});
      return binding;
    }

    // Make sure that if the provide says "struct-out ...", that the exported binding
    // is really a structure.
    function checkBindingCompatibility(binding, exportedBinding){
      // TODO: fix this circular dependency
      var analyzer = notHere('analyzer')
      if(  (binding instanceof analyzer.provideBindingStructId)
        && (!(exportedBinding instanceof structBinding))){
        throwError(new types.Message(["provided-structure-not-structure: ", exportedBinding.symbl]));
      } else {
        return exportedBinding;
      }
    }

    // for each provided binding, ensure it's defined and then decorate with permissions
    // concat all the permissions and bindings together, and return
    var bindings = that.providedNames.reduce(function(acc, b){ return acc.concat(lookupProvideBindingInDefinitionBindings(b)); }, []);
    return bindings.map(decorateWithPermissions);
  }

  toString(){
    var s = "pinfo-------------";
    s+= "\n**env****: "+this.env.toString();
    s+= "\n**modules**: "+this.modules.join(",");
    s+= "\n**used bindings**: "+this.usedBindings();
    s+= "\n**free variables**: "+this.freeVariables.join(",");
    s+= "\n**gensym counter**: "+this.gensymCounter;
    s+= "\n**provided names**: "+this.providedNames.values();
    s+= "\n**defined names**: "+this.definedNames.values();
    s+= "\n**permissions**: "+this.permissions();
    return s;
  }
}

// getBasePinfo: symbol -> pinfo
// Returns a pinfo that knows the base definitions. Language can be one of the following:
// 'base
// 'moby
export function getBasePinfo(language){
  // fixme: use the language to limit what symbols get in the toplevel.
  var baseConstantsEnv = ["null", "empty", "true"//effect:do-nothing
    , "false", "eof", "pi", "e","js-undefined"
    , "js-null"].reduce(function(env, id){
      return env.extendConstant(id.toString(), '"moby/toplevel"', false)
    }, new emptyEnv());

  var info = new pinfo()
  // TODO: fix this circular dependency
  var modules = notHere('modules')
  var topLevelEnv = modules = modules.topLevelModules.reduceRight(function(env, mod){
    return env.extendEnv_moduleBinding(mod);
  }, baseConstantsEnv);
  if(language === "moby"){
    info.env = topLevelEnv.extendEnv_moduleBinding(modules.mobyModuleBinding);
  } else if(language === "base"){
    info.env = topLevelEnv;
  }
  return info;
}

