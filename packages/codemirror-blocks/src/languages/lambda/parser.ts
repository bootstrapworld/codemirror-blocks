/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pos } from "../../ast";
import { poscmp } from "../../utils";

//adapted from http://lisperator.net/pltut/

/**
 * The intermediate AST produced by the parser. Its shape depends on `type`
 * (see the parser below), so beyond `type` the fields are loosely typed.
 * Nodes synthesized by the parser (e.g. for `let name(...)` sugar) may lack
 * `from`/`to`.
 */
export type LambdaNode = {
  type: string;
  from?: Pos;
  to?: Pos;
  /** the comments just before the node */
  comment?: LambdaComment;
  [field: string]: any;
};

/**
 * A comment: `# to the end of the line`, or `#| ... |#`. One that starts on the
 * line where the code before it ends is trailing, and refers to that (the node
 * before it); any other refers to the node that comes after it.
 */
export type LambdaComment = {
  text: string;
  from: Pos;
  to: Pos;
  trailing: boolean;
};

type Token = {
  from: Pos;
  to: Pos;
  type: "num" | "str" | "kw" | "var" | "punc" | "op";
  value: any;
  /** the comments between the token before this one and it */
  comments?: LambdaComment[];
};

type InputStream = {
  inputPos(): Pos;
  next(): string;
  peek(): string;
  eof(): boolean;
  croak(msg: string): never;
};

type TokenStream = {
  pos(): { from: Pos; to: Pos };
  /** the comments after the last token, which no token carries */
  leftover(): LambdaComment[];
  next(): Token | null;
  peek(): Token | null;
  eof(): boolean;
  croak(msg: string): never;
};

/* -----[ the parser ]----- */

export function parseToIntermediateAST(code: string): LambdaNode {
  return parse(tokenStream(inputStream(code)));
}

function parse(input: TokenStream): LambdaNode {
  let fromLocation: Pos, toLocation: Pos;
  const PRECEDENCE: Record<string, number> = {
    "=": 1,
    "||": 2,
    "&&": 3,
    "<": 7,
    ">": 7,
    "<=": 7,
    ">=": 7,
    "==": 7,
    "!=": 7,
    "+": 10,
    "-": 10,
    "*": 20,
    "/": 20,
    "%": 20,
  };
  const FALSE = { type: "bool", value: false };
  // the node most recently parsed in full: what a trailing comment refers to
  let lastCompleted: LambdaNode | undefined;
  function nextToken(): Token {
    return input.next() ?? input.croak("Unexpected end of input");
  }
  function peekToken(): Token {
    return input.peek() ?? input.croak("Unexpected end of input");
  }
  return parseToplevel();
  function isPunc(ch?: string) {
    const tok = input.peek();
    return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
  }
  function isKw(kw?: string) {
    const tok = input.peek();
    return tok && tok.type == "kw" && (!kw || tok.value == kw) && tok;
  }
  function isOp(op?: string) {
    const tok = input.peek();
    return tok && tok.type == "op" && (!op || tok.value == op) && tok;
  }
  function skipPunc(ch: string) {
    if (isPunc(ch)) input.next();
    else input.croak('Expecting punctuation: "' + ch + '"');
  }
  function skipKw(kw: string) {
    if (isKw(kw)) input.next();
    else input.croak('Expecting keyword: "' + kw + '"');
  }
  // function skipOp(op) {
  //   if (isOp(op)) input.next();
  //   else input.croak("Expecting operator: \"" + op + "\"");
  // }
  function unexpected(): never {
    input.croak("Unexpected token: " + JSON.stringify(input.peek()));
  }
  function maybeBinary(left: LambdaNode, myPrec: number): LambdaNode {
    const from = fromLocation;
    const tok = isOp();
    if (tok) {
      const hisPrec = PRECEDENCE[tok.value];
      if (hisPrec > myPrec) {
        input.next();
        const right = maybeBinary(parseAtom(), hisPrec);
        toLocation = input.pos().to;
        return maybeBinary(
          {
            from: from,
            to: toLocation,
            type: tok.value == "=" ? "assign" : "binary",
            operator: tok.value,
            left: left,
            right: right,
          },
          myPrec
        );
      }
    }
    return left;
  }
  function delimited(
    start: string,
    stop: string,
    separator: string,
    parser: () => LambdaNode
  ): LambdaNode[] {
    const a: LambdaNode[] = [];
    let first = true;
    skipPunc(start);
    while (!input.eof()) {
      if (isPunc(stop)) break;
      if (first) first = false;
      else skipPunc(separator);
      if (isPunc(stop)) break;
      a.push(parser());
    }
    skipPunc(stop);
    return a;
  }
  function parseCall(func: LambdaNode): LambdaNode {
    const from = fromLocation;
    const args = delimited("(", ")", ",", parseExpression);
    toLocation = input.pos().to;
    return {
      from: from,
      to: toLocation,
      type: "call",
      func: func,
      args: args,
    };
  }
  function parseVarname(): LambdaNode {
    return withLeadingComments(parseVarnameNode);
  }
  function parseVarnameNode(): LambdaNode {
    const from = input.pos().from;
    const name = nextToken();
    const to = input.pos().to;
    if (name.type != "var") input.croak("Expecting variable name");
    return { from, to, type: "literal", dataType: "var", name };
  }
  function parseVardef(): LambdaNode {
    return withLeadingComments(parseVardefNode);
  }
  function parseVardefNode(): LambdaNode {
    const name = parseVarname();
    let body: LambdaNode | undefined;
    if (isOp("=")) {
      input.next();
      body = parseExpression();
    }
    toLocation = input.pos().to;
    return {
      from: name.from,
      to: toLocation,
      name: name,
      type: "def",
      body: body,
    };
  }
  function parseLet(): LambdaNode {
    const from = fromLocation;
    skipKw("let");
    // (`let name (a = 1) body` is a loop in the language: keep it as written)
    const name = peekToken().type == "var" ? parseVarname() : undefined;
    const vars = delimited("(", ")", ",", parseVardef);
    const body = parseExpression();
    toLocation = input.pos().to;
    return {
      from: from,
      to: toLocation,
      type: "let",
      name: name,
      vars: vars,
      body: body,
    };
  }
  function parseIf(): LambdaNode {
    const from = fromLocation;
    skipKw("if");
    const cond = parseExpression();
    if (!isPunc("{")) skipKw("then");
    const then = parseExpression();
    toLocation = input.pos().to;
    const ret: LambdaNode = {
      from: from,
      to: toLocation,
      type: "if",
      cond: cond,
      then: then,
    };
    if (isKw("else")) {
      input.next();
      ret.else = parseExpression();
      toLocation = input.pos().to;
      ret.to = toLocation;
    }
    return ret;
  }
  function parseLambda(): LambdaNode {
    const from = fromLocation;
    const name = peekToken().type == "var" ? nextToken().value : null;
    const vars = delimited("(", ")", ",", parseVarname);
    const body = parseExpression();
    toLocation = input.pos().to;
    return {
      from: from,
      to: toLocation,
      type: "lambda",
      name: name,
      vars: vars,
      body: body,
    };
  }
  function parseBool(): LambdaNode {
    toLocation = input.pos().to;
    return {
      from: fromLocation,
      to: toLocation,
      type: "bool",
      value: nextToken().value == "true",
    };
  }
  function parseRaw(): LambdaNode {
    skipKw("js:raw");
    if (peekToken().type != "str") input.croak("js:raw must be a plain string");
    return {
      type: "raw",
      code: nextToken().value,
    };
  }
  function maybeCall(exprFn: () => LambdaNode): LambdaNode {
    const expr = exprFn();
    return isPunc("(") ? parseCall(expr) : expr;
  }
  function parseAtom(): LambdaNode {
    return withLeadingComments(parseAtomNode);
  }
  function parseAtomNode(): LambdaNode {
    fromLocation = input.pos().from;
    return maybeCall(function () {
      if (isPunc("(")) {
        input.next();
        const exp = parseExpression();
        skipPunc(")");
        return exp;
      }
      if (isPunc("{")) return parseProg();
      if (isOp("!")) {
        const from = fromLocation;
        input.next();
        const body = parseExpression();
        toLocation = input.pos().to;
        return { from: from, to: toLocation, type: "not", body: body };
      }
      if (isKw("let")) return parseLet();
      if (isKw("if")) return parseIf();
      if (isKw("true") || isKw("false")) return parseBool();
      if (isKw("js:raw")) return parseRaw();
      if (isKw("lambda") || isKw("λ")) {
        input.next();
        return parseLambda();
      }
      if (isOp("-")) {
        // a negative number (the language has no other use of - in front)
        const minus = nextToken();
        const num = nextToken();
        if (num.type != "num") {
          input.croak("A - there has to be followed by a number");
        }
        return { from: minus.from, to: num.to, type: "num", value: -num.value };
      }
      const tok = nextToken();
      if (tok.type == "var" || tok.type == "num" || tok.type == "str") {
        return tok;
      }
      unexpected();
    });
  }
  function parseToplevel(): LambdaNode {
    const prog = [];
    while (!input.eof()) {
      prog.push(parseExpression());
      if (!input.eof()) skipPunc(";");
    }
    // comments at the end go with the last thing before them
    const rest = input.leftover();
    if (rest.length && lastCompleted) attachComments(lastCompleted, rest);
    return {
      from: input.pos().from,
      to: input.pos().to,
      type: "prog",
      prog: prog,
    };
  }
  function parseProg(): LambdaNode {
    const from = fromLocation;
    const prog = delimited("{", "}", ";", parseExpression);
    if (prog.length == 0) return { ...FALSE };
    if (prog.length == 1) return prog[0];
    toLocation = input.pos().to;
    return { from: from, to: toLocation, type: "prog", prog: prog }; //return { type: "prog", prog: prog };
  }
  function parseExpression(): LambdaNode {
    return withLeadingComments(() =>
      maybeCall(function () {
        return maybeBinary(parseAtom(), 0);
      })
    );
  }
  // The comments that come before a node go with it, unless they trail the
  // node before it (they started on the line where it ended), and then they
  // go with that one.
  function withLeadingComments(parseNode: () => LambdaNode): LambdaNode {
    const first = input.peek();
    const comments = first?.comments ?? [];
    if (first) delete first.comments;
    const trailing = lastCompleted ? comments.filter((c) => c.trailing) : [];
    if (lastCompleted && trailing.length) {
      attachComments(lastCompleted, trailing);
    }
    const node = parseNode();
    const leading = comments.filter((c) => !trailing.includes(c));
    if (leading.length) attachComments(node, leading);
    lastCompleted = node;
    return node;
  }
  function attachComments(node: LambdaNode, comments: LambdaComment[]) {
    const all = node.comment ? [node.comment, ...comments] : comments;
    node.comment = {
      text: all.map((c) => c.text).join(" "),
      from: all.reduce(
        (a, c) => (poscmp(c.from, a) < 0 ? c.from : a),
        all[0].from
      ),
      to: all.reduce((a, c) => (poscmp(c.to, a) > 0 ? c.to : a), all[0].to),
      trailing: all.every((c) => c.trailing),
    };
  }
}

/* -----[ parser utils ]----- */

/** What a backslash and one of these letters stand for in a string */
const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

function inputStream(input: string): InputStream {
  let pos = 0,
    ln = 0,
    col = 0;
  return {
    inputPos: inputPos,
    next: next,
    peek: peek,
    eof: eof,
    croak: croak,
  };
  function next() {
    const ch = input.charAt(pos++);
    if (ch == "\n") {
      ln++;
      col = 0;
    } else {
      col++;
    }
    return ch;
  }
  function peek() {
    return input.charAt(pos);
  }
  function eof() {
    return peek() == "";
  }
  function croak(msg: string): never {
    throw new Error(msg + " (" + ln + ":" + col + ")");
  }
  function inputPos() {
    return { line: ln, ch: col };
  }
}

function tokenStream(input: InputStream): TokenStream {
  let current: Token | null = null;
  let fromLocation = input.inputPos(),
    toLocation = input.inputPos();
  const pending: LambdaComment[] = [];
  let lastEnd: Pos | null = null; // (where the last token ended)
  const keywords = " let if then else lambda λ true false js:raw ";
  return {
    pos: pos,
    leftover: () => pending.splice(0),
    next: next,
    peek: peek,
    eof: eof,
    croak: input.croak,
  };
  function isKeyword(x: string) {
    return keywords.indexOf(" " + x + " ") >= 0;
  }
  function isDigit(ch: string) {
    return /[0-9]/i.test(ch);
  }
  function isIdStart(ch: string) {
    return /[a-zλ_]/i.test(ch);
  }
  function isId(ch: string) {
    return isIdStart(ch) || "?!-<:>=0123456789".indexOf(ch) >= 0;
  }
  function isOpChar(ch: string) {
    return "+-*/%=&|<>!".indexOf(ch) >= 0;
  }
  function isPunc(ch: string) {
    return ",;(){}[]:".indexOf(ch) >= 0;
  }
  function isWhitespace(ch: string) {
    return " \t\n".indexOf(ch) >= 0;
  }
  function readWhite(predicate: (ch: string) => boolean) {
    let str = "";
    while (!input.eof() && predicate(input.peek())) str += input.next();
    return str;
  }
  function readNumber(): Token {
    let hasDot = false;
    const number = readWhite(function (ch) {
      if (ch == ".") {
        if (hasDot) return false;
        hasDot = true;
        return true;
      }
      return isDigit(ch);
    });
    toLocation = input.inputPos();
    return {
      from: fromLocation,
      to: toLocation,
      type: "num",
      value: parseFloat(number),
    };
  }
  function readIdent(): Token {
    const id = readWhite(isId);
    toLocation = input.inputPos();
    return {
      from: fromLocation,
      to: toLocation,
      type: isKeyword(id) ? "kw" : "var",
      value: id,
    };
  }
  function readEscaped(end: string) {
    let escaped = false,
      str = "";
    input.next();
    while (!input.eof()) {
      const ch = input.next();
      if (escaped) {
        str += ESCAPES[ch] ?? ch;
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
  function readString(): Token {
    const string = readEscaped('"');
    toLocation = input.inputPos();
    return { from: fromLocation, to: toLocation, type: "str", value: string };
  }
  function readComment() {
    const from = input.inputPos();
    input.next(); // (the #)
    let text = "";
    if (input.peek() == "|") {
      input.next();
      let closed = false;
      while (!input.eof()) {
        const ch = input.next();
        if (ch == "|" && input.peek() == "#") {
          input.next();
          closed = true;
          break;
        }
        text += ch;
      }
      if (!closed) input.croak("Unterminated comment");
    } else {
      text = readWhite((ch) => ch != "\n");
    }
    pending.push({
      text: text.trim().replace(/\s+/g, " "),
      from,
      to: input.inputPos(),
      trailing: lastEnd !== null && from.line === lastEnd.line,
    });
  }
  // a token carries the comments that came before it
  function readNext(): Token | null {
    const token = readToken();
    if (token && pending.length) token.comments = pending.splice(0);
    if (token) lastEnd = input.inputPos();
    return token;
  }
  function readToken(): Token | null {
    readWhite(isWhitespace);
    if (input.eof()) return null; //null use to be nullparseLambda
    const ch = input.peek();
    if (ch == "#") {
      readComment();
      return readToken();
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
    if (isPunc(ch))
      return {
        from: fromLocation,
        to: toLocation,
        type: "punc",
        value: input.next(),
      };
    if (isOpChar(ch))
      return {
        from: fromLocation,
        to: toLocation,
        type: "op",
        value: readWhite(isOpChar),
      };
    input.croak("Can't handle character: " + ch);
  }
  function peek() {
    return current || (current = readNext());
  }
  function next() {
    const tok = current;
    current = null;
    const taken = tok || readNext();
    // comments that nothing claimed (they came before an operator or a
    // closing bracket) go on to the next token, and so to what it starts
    if (taken?.comments?.length) {
      const following = peek();
      if (following) {
        following.comments = [...taken.comments, ...(following.comments ?? [])];
      } else {
        pending.unshift(...taken.comments);
      }
      delete taken.comments;
    }
    return taken;
  }
  function eof() {
    return peek() == null;
  }
  function pos() {
    return { from: fromLocation, to: toLocation };
  }
}
