function parseLambda() {
  return {
    type: "lambda",
    vars: delimited("(", ")", ",", parseVarname),
    body: parseExpression()
  };
}

function delimited(start, stop, separator, parser) {
  var a = [], first = true;
  skipPunc(start);
  while (!input.eof()) {
    if ( isPunc(stop)) break;
    if (first) first = false; else skipPunc(separator);
    if ( isPunc(stop)) break; // the last separator can be missing
    a.push(parser());
  }
  skipPunc(stop);
  return a;
}

function parseToplevel() {
  var prog = [];
  while (!input.eof()) {
    prog.push(parseExpression());
    if (!input.eof()) skipPunc(";");
  }
  return { type: "prog", prog: prog };
}

function parseIf() {
  skip_kw("if");
  var cond = parseExpression();
  if (! isPunc("{")) skip_kw("then");
  var then = parseExpression();
  var ret = { type: "if", cond: cond, then: then };
  if (isKw("else")) {
    input.next();
    ret.else = parseExpression();
  }
  return ret;
}

// we're going to use the FALSE node in various places,
// so I'm making it a global.
var FALSE = { type: "bool", value: false };

function parseProg() {
  var prog = delimited("{", "}", ";", parseExpression);
  if (prog.length == 0) return FALSE;
  if (prog.length == 1) return prog[0];
  return { type: "prog", prog: prog };
}

function parseExpression() {
  return maybeCall(function(){
    return maybeBinary(parseAtom(), 0);
  });
}

function maybeCall(expr) {
  expr = expr();
  return  isPunc("(") ? parseCall(expr) : expr;
}

function parseCall(func) {
  return {
    type: "call",
    func: func,
    args: delimited("(", ")", ",", parseExpression)
  };
}

var PRECEDENCE = {
  "=": 1,
  "||": 2,
  "&&": 3,
  "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
  "+": 10, "-": 10,
  "*": 20, "/": 20, "%": 20,
};

function maybeBinary(left, my_prec) {
  var tok = isOp();
  if (tok) {
    var his_prec = PRECEDENCE[tok.value];
    if (his_prec > my_prec) {
      input.next();
      var right = maybeBinary(parseAtom(), his_prec) // (*);
      var binary = {
        type   : tok.value == "=" ? "assign" : "binary",
        operator : tok.value,
        left   : left,
        right  : right
      };
      return maybeBinary(binary, my_prec);
    }
  }
  return left;
}

var FALSE = { type: "bool", value: false };
function parse(input) {
  var PRECEDENCE = {
    "=": 1,
    "||": 2,
    "&&": 3,
    "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
    "+": 10, "-": 10,
    "*": 20, "/": 20, "%": 20,
  };
  return parseToplevel();
}
function  isPunc(ch) {
  var tok = input.peek();
  return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
}
function isKw(kw) {
  var tok = input.peek();
  return tok && tok.type == "kw" && (!kw || tok.value == kw) && tok;
}
function isOp(op) {
  var tok = input.peek();
  return tok && tok.type == "op" && (!op || tok.value == op) && tok;
}
function skipPunc(ch) {
  if ( isPunc(ch)) input.next();
  else input.croak("Expecting punctuation: \"" + ch + "\"");
}
function skip_kw(kw) {
  if (isKw(kw)) input.next();
  else input.croak("Expecting keyword: \"" + kw + "\"");
}
function skipOp(op) {
  if (isOp(op)) input.next();
  else input.croak("Expecting operator: \"" + op + "\"");
}
function unexpected() {
  input.croak("Unexpected token: " + JSON.stringify(input.peek()));
}


function parseVarname() {
  var name = input.next();
  if (name.type != "var") input.croak("Expecting variable name");
  return name.value;
}

function parseBool() {
  return {
    type  : "bool",
    value : input.next().value == "true"
  };
}
function parseAtom() {
  return maybeCall(function(){
    if ( isPunc("(")) {
      input.next();
      var exp = parseExpression();
      skipPunc(")");
      return exp;
    }
    if ( isPunc("{")) return parseProg();
    if (isKw("if")) return parseIf();
    if (isKw("true") || isKw("false")) return parseBool();
    if (isKw("lambda") || isKw("λ")) {
      input.next();
      return parseLambda();
    }
    var tok = input.next();
    if (tok.type == "var" || tok.type == "num" || tok.type == "str")
      return tok;
    unexpected();
  });
}
