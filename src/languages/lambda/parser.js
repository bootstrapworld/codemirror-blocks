import {
  AST,
  Literal,
  VariableDefinition,
  FunctionDefinition,
  Expression,
} from '../../ast';

import {
  Prog,
  Assignment,
  Binary,
  Conditional
} from './ast';

//adapted from http://lisperator.net/pltut/

/* -----[ the parser ]----- */

export default function parseString(code) {
  return new AST([convertAST(parse(tokenStream(inputStream(code))))]);
}

export function parseToIntermediateAST(code) {
  return parse(tokenStream(inputStream(code)));
}

function convertAST(lambdaNode) {
  switch (lambdaNode.type) {
    case 'prog':
      return new Prog(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.prog.map(convertAST)
      );
    case 'num':
      return new Literal(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.value,
        'number'
      );
    case 'str':
      return new Literal(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.value,
        'string'
      );
    case 'var':
      return new Literal(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.value,
        'symbol'
      );
    case 'bool':
      return new Literal(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.value,
        'bool'
      );
    case 'def':
      return new VariableDefinition(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.name,
        lambdaNode.body.map(convertAST)
      );
    case 'lambda':
      return new FunctionDefinition(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.name,
        lambdaNode.vars.map(convertAST),
        lambdaNode.body.map(convertAST)
      );
    case 'call':
      return new Expression(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.func,
        lambdaNode.args.map(convertAST)
      );
    case 'assign':
      return new Assignment(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.operator,
        lambdaNode.left.map(convertAST),
        lambdaNode.right.map(convertAST)
      );
    case 'binary':
      return new Binary(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.operator,
        lambdaNode.left.map(convertAST),
        lambdaNode.right.map(convertAST)
      );
    case 'let':
      return new Literal(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.vars.map(convertAST),
        lambdaNode.body.map(convertAST)
      );
    case 'if':
      return new Conditional(
        lambdaNode.from,
        lambdaNode.to,
        lambdaNode.cond.map(convertAST),
        lambdaNode.then.map(convertAST),
        lambdaNode.else.map(convertAST)
      );
    default:
      throw new Error("Don't know how to convert node of type "+ lambdaNode.type);
  }
}

function parse(input) {
  var fromLocation, toLocation;
  var PRECEDENCE = {
    "=": 1,
    "||": 2,
    "&&": 3,
    "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
    "+": 10, "-": 10,
    "*": 20, "/": 20, "%": 20,
  };
  var FALSE = { type: "bool", value: false };
  return parseToplevel();
  function isPunc(ch) {
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
    if (isPunc(ch)) input.next();
    else input.croak("Expecting punctuation: \"" + ch + "\"");
  }
  function skipKw(kw) {
    if (isKw(kw)) input.next();
    else input.croak("Expecting keyword: \"" + kw + "\"");
  }
  // function skipOp(op) {
  //   if (isOp(op)) input.next();
  //   else input.croak("Expecting operator: \"" + op + "\"");
  // }
  function unexpected() {
    input.croak("Unexpected token: " + JSON.stringify(input.peek()));
  }
  function maybeBinary(left, myPrec) {
    var from = fromLocation;
    var tok = isOp();
    if (tok) {
      var hisPrec = PRECEDENCE[tok.value];
      if (hisPrec > myPrec) {
        input.next();
        var right =  maybeBinary(parseAtom(), hisPrec);
        toLocation = input.pos().to;
        return maybeBinary({
          from: from,
          to: toLocation,
          type     : tok.value == "=" ? "assign" : "binary",
          operator : tok.value,
          left     : left,
          right    : right
        }, myPrec);
      }
    }
    return left;
  }
  function delimited(start, stop, separator, parser) {
    var a = [], first = true;
    skipPunc(start);
    while (!input.eof()) {
      if (isPunc(stop)) break;
      if (first) first = false; else skipPunc(separator);
      if (isPunc(stop)) break;
      a.push(parser());
    }
    skipPunc(stop);
    return a;
  }
  function parseCall(func) {
    var from = fromLocation;
    var args =  delimited("(", ")", ",", parseExpression);
    toLocation = input.pos().to;
    return {
      from: from,
      to: toLocation,
      type: "call",
      func: func,
      args: args
    };
  }
  function parseVarname() {
    var from = input.pos().from;
    var name = input.next();
    var to = input.pos().to;
    if (name.type != "var") input.croak("Expecting variable name");
    return { from, to, type: 'literal', dataType: 'var', name };
  }
  function parseVardef() {
    var name = parseVarname(), body;
    if (isOp("=")) {
      input.next();
      body = parseExpression();
    }
    toLocation = input.pos().to;
    return { from: fromLocation, to: toLocation, name: name, type: 'def', body: body };
  }
  function parseLet() {
    var from = fromLocation;
    skipKw("let");
    if (input.peek().type == "var") {
      var name = input.next().value;
      var defs = delimited("(", ")", ",", parseVardef);
      toLocation = input.pos().to;
      return {
        from: from,
        to: toLocation,
        type: "call",
        func: {
          type: "lambda",
          name: name,
          vars: defs.map(function(def){ return def.name;}),
          body: parseExpression(),
        },
        args: defs.map(function(def){ return def.def || FALSE;})
      };
    }
    var vars = delimited("(", ")", ",", parseVardef);
    toLocation = input.pos().to;
    return {
      from: from,
      to  : toLocation,
      type: "let",
      vars: vars,
      body: parseExpression(),
    };
  }
  function parseIf() {
    var from = fromLocation;
    skipKw("if");
    var cond = parseExpression();
    if (!isPunc("{")) skipKw("then");
    var then = parseExpression();
    toLocation = input.pos().to;
    var ret = {
      from: from,
      to  : toLocation,
      type: "if",
      cond: cond,
      then: then,
    };
    if (isKw("else")) {
      input.next();
      toLocation = input.pos().to;
      ret.to = toLocation;
      ret.else = parseExpression();
    }
    return ret;
  }
  function parseLambda() {
    var from = fromLocation;
    var name = input.peek().type == "var" ? input.next().value : null;
    var vars = delimited("(", ")", ",", parseVarname);
    var body = parseExpression();
    toLocation = input.pos().to;
    return {
      from: from,
      to: toLocation,
      type: "lambda",
      name: name,
      vars: vars,
      body: body
    };
  }
  function parseBool() {
    toLocation = input.pos().to;
    return {
      from  : fromLocation,
      to    : toLocation,
      type  : "bool",
      value : input.next().value == "true"
    };
  }
  function parseRaw() {
    skipKw("js:raw");
    if (input.peek().type != "str")
      input.croak("js:raw must be a plain string");
    return {
      type : "raw",
      code : input.next().value
    };
  }
  function maybeCall(expr) {
    expr = expr();
    return isPunc("(") ? parseCall(expr) : expr;
  }
  function parseAtom() {
    fromLocation = input.pos().from;
    return maybeCall(function(){
      if (isPunc("(")) {
        input.next();
        var exp = parseExpression();
        skipPunc(")");
        return exp;
      }
      if (isPunc("{")) return parseProg();
      if (isOp("!")) {
        input.next();
        toLocation = input.pos().to;
        return {
          from: fromLocation,
          to: toLocation,
          type: "not",
          body: parseExpression()
        };
      }
      if (isKw("let")) return parseLet();
      if (isKw("if")) return parseIf();
      if (isKw("true") || isKw("false")) return parseBool();
      if (isKw("js:raw")) return parseRaw();
      if (isKw("lambda") || isKw("λ")) {
        input.next();
        return parseLambda();
      }
      var tok = input.next();
      if (tok.type == "var" || tok.type == "num" || tok.type == "str") {
        return tok;
      }
      unexpected();
    });
  }
  function parseToplevel() {
    var prog = [];
    while (!input.eof()) {
      prog.push(parseExpression());
      if (!input.eof()) skipPunc(";");
    }
    return { from: input.pos().from, to: input.pos().to, type: "prog", prog: prog };
  }
  function parseProg() {
    var from = fromLocation;
    var prog = delimited("{", "}", ";", parseExpression);
    if (prog.length == 0) return FALSE;
    if (prog.length == 1) return prog[0];
    toLocation = input.pos().to;
    return { from: from, to: toLocation, type: "prog", prog: prog }; //return { type: "prog", prog: prog };
  }
  function parseExpression() {
    return maybeCall(function(){
      return maybeBinary(parseAtom(), 0);
    });
  }
}

/* -----[ parser utils ]----- */

function inputStream(input) {
  var pos = 0, ln = 0, col = 0;
  return {
    inputPos   : inputPos,
    next  : next,
    peek  : peek,
    eof   : eof,
    croak : croak,
  };
  function next() {
    var ch = input.charAt(pos++);
    if (ch == "\n") ln++, col = 0; else col++;
    return ch;
  }
  function peek() {
    return input.charAt(pos);
  }
  function eof() {
    return peek() == "";
  }
  function croak(msg) {
    throw new Error(msg + " (" + ln + ":" + col + ")");
  }
  function inputPos() {
    return { line: ln, ch: col };
  }
}

function tokenStream(input) {
  var current = null;
  var fromLocation = input.inputPos(), toLocation = input.inputPos();
  var keywords = " let if then else lambda λ true false js:raw ";
  return {
    pos   : pos,
    next  : next,
    peek  : peek,
    eof   : eof,
    croak : input.croak
  };
  function isKeyword(x) {
    return keywords.indexOf(" " + x + " ") >= 0;
  }
  function isDigit(ch) {
    return /[0-9]/i.test(ch);
  }
  function isIdStart(ch) {
    return /[a-zλ_]/i.test(ch);
  }
  function isId(ch) {
    return isIdStart(ch) || "?!-<:>=0123456789".indexOf(ch) >= 0;
  }
  function isOpChar(ch) {
    return "+-*/%=&|<>!".indexOf(ch) >= 0;
  }
  function isPunc(ch) {
    return ",;(){}[]:".indexOf(ch) >= 0;
  }
  function isWhitespace(ch) {
    return " \t\n".indexOf(ch) >= 0;
  }
  function readWhite(predicate) {
    var str = "";
    while (!input.eof() && predicate(input.peek()))
      str += input.next();
    return str;
  }
  function readNumber() {
    var hasDot = false;
    var number = readWhite(function(ch){
      if (ch == ".") {
        if (hasDot) return false;
        hasDot = true;
        return true;
      }
      return isDigit(ch);
    });
    toLocation = input.inputPos();
    return { from: fromLocation, to: toLocation, type: "num", value: parseFloat(number) };
  }
  function readIdent() {
    var id = readWhite(isId);
    toLocation = input.inputPos();
    return {
      from  : fromLocation,
      to    : toLocation,
      type  : isKeyword(id) ? "kw" : "var",
      value : id
    };
  }
  function readEscaped(end) {
    var escaped = false, str = "";
    input.next();
    while (!input.eof()) {
      var ch = input.next();
      if (escaped) {
        str += ch;
        escaped = false;
      } else if (ch == "\\") {
        escaped = true;
      } else if (ch == end) {
        break;
      } else {
        str += ch;
      }
    }
    return str;
  }
  function readString() {
    var string = readEscaped('"');
    toLocation = input.inputPos();
    return { from: fromLocation, to: toLocation, type: "str", value: string };
  }
  function skipComment() {
    readWhite(function(ch){ return ch != "\n";});
    input.next();
  }
  function readNext() {
    readWhite(isWhitespace);
    if (input.eof()) return null; //null use to be nullparseLambda
    var ch = input.peek();
    if (ch == "#") {
      skipComment();
      return readNext();
    }
    fromLocation = input.inputPos();
    if (ch == '"') {
      toLocation = input.inputPos();
      return readString();
    }
    if (isDigit(ch)) {
      toLocation = input.inputPos();
      return readNumber();
    }
    if (isIdStart(ch)) return readIdent();
    if (isPunc(ch)) return {
      from  : fromLocation,
      to    : toLocation,
      type  : "punc",
      value : input.next()
    };
    if (isOpChar(ch)) return {
      from  : fromLocation,
      to    : toLocation,
      type  : "op",
      value : readWhite(isOpChar)
    };
    input.croak("Can't handle character: " + ch);
  }
  function peek() {
    return current || (current = readNext());
  }
  function next() {
    var tok = current;
    current = null;
    return tok || readNext();
  }
  function eof() {
    return peek() == null;
  }
  function pos() {
    return { from: fromLocation, to: toLocation };
  }
}
