export default class Parser {

  static InputStream(input) {
    var pos = 0, line = 1, col = 0;
    return {
      next  : next,
      peek  : peek,
      eof   : eof,
      croak : croak,
    };
    function next() {
      var ch = input.charAt(pos++);
      if (ch == "\n") line++, col = 0; else col++;
      return ch;
    }
    function peek() {
      return input.charAt(pos);
    }
    function eof() {
      return peek() == "";
    }
    function croak(msg) {
      throw new Error(msg + " (" + line + ":" + col + ")");
    }
  }

  static TokenStream(input) {
    var current = null;
    var keywords = " if then else lambda Î» true false ";
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
      return /[a-zÎ»_]/i.test(ch);
    }
    function isId(ch) {
      return isIdStart(ch) || "?!-<>=0123456789".indexOf(ch) >= 0;
    }
    function isOpChar(ch) {
      return "+-*/%=&|<>!".indexOf(ch) >= 0;
    }
    function isPunc(ch) {
      return ",;(){}[]".indexOf(ch) >= 0;
    }
    function isWhitespace(ch) {
      return " \t\n".indexOf(ch) >= 0;
    }
    function readWhile(predicate) {
      var str = "";
      while (!input.eof() && predicate(input.peek()))
        str += input.next();
      return str;
    }
    function readNumber() {
      var has_dot = false;
      var number = readWhile(function(ch){
        if (ch == ".") {
          if (has_dot) return false;
          has_dot = true;
          return true;
        }
        return isDigit(ch);
      });
      return { type: "num", value: parseFloat(number) };
    }
    function readIdent() {
      var id = readWhile(isId);
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
      readWhile(function(ch){ return ch != "\n";});
      input.next();
    }
    function readNext() {
      readWhile(isWhitespace);
      if (input.eof()) return null;
      var ch = input.peek();
      if (ch == "#") {
        skipComment();
        return readNext();
      }
      if (ch == '"') return readString();
      if (isDigit(ch)) return readNumber();
      if (isIdStart(ch)) return readIdent();
      if (isPunc(ch)) return {
        type  : "punc",
        value : input.next()
      };
      if (isOpChar(ch)) return {
        type  : "op",
        value : readWhile(isOpChar)
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
  }

  static parse(input) {
    var PRECEDENCE = {
      "=": 1,
      "||": 2,
      "&&": 3,
      "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
      "+": 10, "-": 10,
      "*": 20, "/": 20, "%": 20,
    };
    var FALSE = { type: "bool", value: false };
    return parseTopLevel();
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
    function maybeBinary(left, my_prec) {
      var tok = isOp();
      if (tok) {
        var his_prec = PRECEDENCE[tok.value];
        if (his_prec > my_prec) {
          input.next();
          return maybeBinary({
            type     : tok.value == "=" ? "assign" : "binary",
            operator : tok.value,
            left     : left,
            right    : maybeBinary(parseAtom(), his_prec)
          }, my_prec);
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
      return {
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
    function parseIf() {
      skipKw("if");
      var cond = parseExpression();
      if (!isPunc("{")) skipKw("then");
      var then = parseExpression();
      var ret = {
        type: "if",
        cond: cond,
        then: then,
      };
      if (isKw("else")) {
        input.next();
        ret.else = parseExpression();
      }
      return ret;
    }
    function parseLambda() {
      return {
        type: "lambda",
        vars: delimited("(", ")", ",", parseVarname),
        body: parseExpression()
      };
    }
    function parseBool() {
      return {
        type  : "bool",
        value : input.next().value == "true"
      };
    }
    function maybeCall(expr) {
      expr = expr();
      return isPunc("(") ? parseCall(expr) : expr;
    }
    function parseAtom() {
      return maybeCall(function(){
        if (isPunc("(")) {
          input.next();
          var exp = parseExpression();
          skipPunc(")");
          return exp;
        }
        if (isPunc("{")) return parseProg();
        if (isKw("if")) return parseIf();
        if (isKw("true") || isKw("false")) return parseBool();
        if (isKw("lambda") || isKw("Î»")) {
          input.next();
          return parseLambda();
        }
        var tok = input.next();
        if (tok.type == "var" || tok.type == "num" || tok.type == "str")
          return tok;
        unexpected();
      });
    }
    function parseTopLevel() {
      var prog = [];
      while (!input.eof()) {
        prog.push(parseExpression());
        if (!input.eof()) skipPunc(";");
      }
      return prog[0];
      //return { type: "prog", prog: prog };
    }
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
  }
}

/*

function Environment(parent) {
  this.vars = Object.create(parent ? parent.vars : null);
  this.parent = parent;
}
Environment.prototype = {
  extend: function() {
    return new Environment(this);
  },
  lookup: function(name) {
    var scope = this;
    while (scope) {
      if (Object.prototype.hasOwnProperty.call(scope.vars, name))
        return scope;
      scope = scope.parent;
    }
  },
  get: function(name) {
    if (name in this.vars)
      return this.vars[name];
    throw new Error("Undefined variable " + name);
  },
  set: function(name, value) {
    var scope = this.lookup(name);
    if (!scope && this.parent)
      throw new Error("Undefined variable " + name);
    return (scope || this).vars[name] = value;
  },
  def: function(name, value) {
    return this.vars[name] = value;
  }
};

function evaluate(exp, env) {
  switch (exp.type) {
  case "num":
  case "str":
  case "bool":
    return exp.value;

  case "var":
    return env.get(exp.value);

  case "assign":
    if (exp.left.type != "var")
      throw new Error("Cannot assign to " + JSON.stringify(exp.left));
    return env.set(exp.left.value, evaluate(exp.right, env));

  case "binary":
    return apply_op(exp.operator,
                    evaluate(exp.left, env),
                    evaluate(exp.right, env));

  case "lambda":
    return make_lambda(env, exp);

  case "if":
    var cond = evaluate(exp.cond, env);
    if (cond !== false) return evaluate(exp.then, env);
    return exp.else ? evaluate(exp.else, env) : false;

  case "prog":
    var val = false;
    exp.prog.forEach(function(exp){ val = evaluate(exp, env);});
    return val;

  case "call":
    var func = evaluate(exp.func, env);
    return func.apply(null, exp.args.map(function(arg){
      return evaluate(arg, env);
    }));

  default:
    throw new Error("I don't know how to evaluate " + exp.type);
  }
}

function apply_op(op, a, b) {
  function num(x) {
    if (typeof x != "number")
      throw new Error("Expected number but got " + x);
    return x;
  }
  function div(x) {
    if (num(x) == 0)
      throw new Error("Divide by zero");
    return x;
  }
  switch (op) {
  case "+": return num(a) + num(b);
  case "-": return num(a) - num(b);
  case "*": return num(a) * num(b);
  case "/": return num(a) / div(b);
  case "%": return num(a) % div(b);
  case "&&": return a !== false && b;
  case "||": return a !== false ? a : b;
  case "<": return num(a) < num(b);
  case ">": return num(a) > num(b);
  case "<=": return num(a) <= num(b);
  case ">=": return num(a) >= num(b);
  case "==": return a === b;
  case "!=": return a !== b;
  }
  throw new Error("Can't apply operator " + op);
}

function make_lambda(env, exp) {
  function lambda() {
    var names = exp.vars;
    var scope = env.extend();
    for (var i = 0; i < names.length; ++i)
      scope.def(names[i], i < arguments.length ? arguments[i] : false);
    return evaluate(exp.body, scope);
  }
  return lambda;
}

/* -----[ entry point for NodeJS ]----- 

var globalEnv = new Environment();

globalEnv.def("time", function(func){
  try {
    console.time("time");
    return func();
  } finally {
    console.timeEnd("time");
  }
});

if (typeof process != "undefined") (function(){
  var util = require("util");
  globalEnv.def("println", function(val){
    util.puts(val);
  });
  globalEnv.def("print", function(val){
    util.print(val);
  });
  var code = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("readable", function(){
    var chunk = process.stdin.read();
    if (chunk) code += chunk;
  });
  process.stdin.on("end", function(){
    var ast = parse(TokenStream(InputStream(code)));
    evaluate(ast, globalEnv);
  });
})();

*/