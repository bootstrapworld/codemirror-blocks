//adapted from http://lisperator.net/pltut/

/* -----[ the parser ]----- */

export default function parseString(code) {
  var ast = parse(tokenStream(inputStream(code)));
  return ast;
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
  function skipOp(op) {
    if (isOp(op)) input.next();
    else input.croak("Expecting operator: \"" + op + "\"");
  }
  function unexpected() {
    input.croak("Unexpected token: " + JSON.stringify(input.peek()));
  }
  function maybeBinary(left, myPrec) {
    var tok = isOp();
    if (tok) {
      var hisPrec = PRECEDENCE[tok.value];
      if (hisPrec > myPrec) {
        input.next();
        toLocation = input.pos().to;
        return maybeBinary({
          from: fromLocation,
          to: toLocation,
          type     : tok.value == "=" ? "assign" : "binary",
          operator : tok.value,
          left     : left,
          right    : maybeBinary(parseAtom(), hisPrec)
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
    toLocation = input.pos().to;
    return {
      from: fromLocation,
      to: toLocation,
      type: "call",
      func: func,
      args: delimited("(", ")", ",", parseExpression),
    };
  }
  function parseVarname() {
    var name = input.next();
    if (name.type != "var") input.croak("Expecting variable name");
    return name.value;
  }
  function parseVardef() {
    var name = parseVarname(), def;
    if (isOp("=")) {
      input.next();
      def = parseExpression();
    }
    toLocation = input.pos().to;
    return { from: fromLocation, to: toLocation, name: name, def: def };
  }
  function parseLet() {
    skipKw("let");
    if (input.peek().type == "var") {
      var name = input.next().value;
      var defs = delimited("(", ")", ",", parseVardef);
      toLocation = input.pos().to;
      return {
        from: fromLocation,
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
    toLocation = input.pos().to;
    return {
      from: fromLocation,
      to  : toLocation,
      type: "let",
      vars: delimited("(", ")", ",", parseVardef),
      body: parseExpression(),
    };
  }
  function parseIf() {
    skipKw("if");
    var cond = parseExpression();
    if (!isPunc("{")) skipKw("then");
    var then = parseExpression();
    toLocation = input.pos().to;
    var ret = {
      from: fromLocation,
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
    toLocation = input.pos().to;
    return {
      from: fromLocation,
      to: toLocation,
      type: "lambda",
      name: input.peek().type == "var" ? input.next().value : null,
      vars: delimited("(", ")", ",", parseVarname),
      body: parseExpression()
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
      if (tok.type == "var" || tok.type == "num" || tok.type == "str")
        tok.to = toLocation;
        tok.from = fromLocation;
        return tok;
      unexpected();
    });
  }
  function parseToplevel() {
    var prog = [];
    while (!input.eof()) {
      prog.push(parseExpression());
      if (!input.eof()) skipPunc(";");
    }
    return prog[0]; //parseProg()
    //return { type: "prog", prog: prog }; // incorrectly makes the correct object a subobject of prog
  }
  function parseProg() {
    var prog = delimited("{", "}", ";", parseExpression);
    if (prog.length == 0) return FALSE;
    if (prog.length == 1) return prog[0];
    toLocation = input.pos().to;
    return { from: fromLocation, to: toLocation, type: "prog", prog: prog }; //return { type: "prog", prog: prog };
  }
  function parseExpression() {
    return maybeCall(function(){
      return maybeBinary(parseAtom(), 0);
    });
  }
}
  
  function pos() {
    return {from: fromLocation, to: toLocation }
  }
/* -----[ parser utils ]----- */

function inputStream(input) {
  var pos = 0, ln = 1, col = 0;
  return {
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
  function pos() {
    return { line: ln, ch: column }
  }
}

function tokenStream(input) {
  var current = null;
  var fromLocation, toLocation;
  var keywords = " let if then else lambda λ true false js:raw ";
  return {
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
    return { type: "num", value: parseFloat(number) };
  }
  function readIdent() {
    var id = readWhite(isId);
    return {
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
    return { type: "str", value: readEscaped('"') };
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
    fromLocation = input.pos();
    if (ch == '"') return readString();
    if (isDigit(ch)) return readNumber();
    if (isIdStart(ch)) return readIdent();
    if (isPunc(ch)) return {
      type  : "punc",
      value : input.next()
    };
    if (isOpChar(ch)) return {
      type  : "op",
      value : readWhite(isOpChar)
    };
    toLocation = input.pos()
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
    return { from: fromLocation, to: toLocation }
  }
}