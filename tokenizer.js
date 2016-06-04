//adapted from http://lisperator.net/pltut/parser/token-stream

function tokenizer(input) {
  var current = null;
  var keywords = " if then else lambda λ true false ";
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
  function is_id(ch) {
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
    var id = readWhile(is_id);
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
    readWhile(function(ch){ return ch != "\n" ;});
    input.next();
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
}