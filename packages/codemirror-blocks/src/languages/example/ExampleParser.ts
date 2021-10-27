import { ASTNode, Pos } from "../../ast";
import { Literal, FunctionApp } from "../../nodes";

const TOKENS = {
  OPEN_PAREN: "open-paren",
  CLOSE_PAREN: "close-paren",
  IDENTIFIER: "identifier",
  NUMBER: "number",
  EOF: "eof",
};

class Token {
  from: Pos;
  to: Pos;
  token: string;
  text: string;
  constructor(from: Pos, to: Pos, token: string, text: string) {
    this.from = from;
    this.to = to;
    this.token = token;
    this.text = text;
  }
  toString() {
    return `${this.token}: ${this.from.line},${this.from.ch} ${this.to.line},${this.to.ch} "${this.text}"`;
  }
}

export default class ExampleParser {
  code = "";
  charIndex = 0;
  lineIndex = 0;
  colIndex = 0;
  getch() {
    const ch = this.code[this.charIndex];
    this.charIndex++;
    this.colIndex++;
    if (ch == "\n") {
      this.lineIndex++;
      this.colIndex = 0;
    }
    return ch;
  }

  getExceptionMessage(e: unknown) {
    return String(e) || "Parser error";
  }

  getToken(): Token {
    const IDENTIFIER_RE = /[\w-+/*]/;
    if (this.charIndex >= this.code.length) {
      return new Token(
        { line: this.lineIndex, ch: this.colIndex },
        { line: this.lineIndex, ch: this.colIndex },
        TOKENS.EOF,
        ""
      );
    }
    if (this.code[this.charIndex] == "(") {
      const token = new Token(
        { line: this.lineIndex, ch: this.colIndex },
        { line: this.lineIndex, ch: this.colIndex + 1 },
        TOKENS.OPEN_PAREN,
        "("
      );
      this.getch();
      return token;
    } else if (this.code[this.charIndex] == ")") {
      const token = new Token(
        { line: this.lineIndex, ch: this.colIndex },
        { line: this.lineIndex, ch: this.colIndex + 1 },
        TOKENS.CLOSE_PAREN,
        ")"
      );
      this.getch();
      return token;
    } else if (this.code[this.charIndex] == " ") {
      while (this.code[this.charIndex] == " ") {
        this.getch();
      }
      return this.getToken();
    } else if (
      this.code[this.charIndex] >= "0" &&
      this.code[this.charIndex] <= "9"
    ) {
      const startIndex = this.colIndex;
      let number = "";
      while (
        this.code[this.charIndex] >= "0" &&
        this.code[this.charIndex] <= "9"
      ) {
        number += this.getch();
      }
      return new Token(
        { line: this.lineIndex, ch: startIndex },
        { line: this.lineIndex, ch: startIndex + number.length },
        TOKENS.NUMBER,
        number
      );
    } else if (this.code[this.charIndex].match(IDENTIFIER_RE)) {
      let identifier = "";
      const startIndex = this.colIndex;
      while (this.code[this.charIndex].match(IDENTIFIER_RE)) {
        identifier += this.getch();
      }
      return new Token(
        { line: this.lineIndex, ch: startIndex },
        { line: this.lineIndex, ch: startIndex + identifier.length },
        TOKENS.IDENTIFIER,
        identifier
      );
    } else if (this.code[this.charIndex] == "\n") {
      this.getch();
      return this.getToken();
    } else {
      throw new Error("parse error");
    }
  }

  peekToken() {
    const oldCharIndex = this.charIndex;
    const oldLineIndex = this.lineIndex;
    const oldColIndex = this.colIndex;
    const token = this.getToken();
    this.charIndex = oldCharIndex;
    this.lineIndex = oldLineIndex;
    this.colIndex = oldColIndex;
    return token;
  }

  lex(code: string) {
    return this.parse(code);
  }

  parse(code: string) {
    this.code = code;
    this.charIndex = 0;
    this.lineIndex = 0;
    this.colIndex = 0;

    const rootNodes = [];
    while (this.peekToken().token != TOKENS.EOF) {
      rootNodes.push(this.parseNextToken());
    }
    return rootNodes;
  }

  parseNextToken(): ASTNode {
    switch (this.peekToken().token) {
      case TOKENS.OPEN_PAREN:
        return this.parseExpression();
      case TOKENS.NUMBER:
        return this.parseLiteral();
      default:
        throw new Error("Expected either a number or another expression");
    }
  }

  parseLiteral() {
    const literalToken = this.getToken();
    return Literal(
      literalToken.from,
      literalToken.to,
      literalToken.text,
      "number"
    );
  }

  parseExpression() {
    const token = this.getToken();
    if (token.token != TOKENS.OPEN_PAREN) {
      throw new Error("Expected an open paren");
    }
    if (this.peekToken().token != TOKENS.IDENTIFIER) {
      throw new Error("Expected an identifier");
    }
    const identifierToken = this.getToken();
    const args = [];
    while (this.peekToken().token != TOKENS.CLOSE_PAREN) {
      args.push(this.parseNextToken());
    }
    const closeParenToken = this.getToken();
    return FunctionApp(
      token.from,
      closeParenToken.to,
      Literal(
        identifierToken.from,
        identifierToken.to,
        identifierToken.text,
        "symbol"
      ),
      args
    );
  }
}
