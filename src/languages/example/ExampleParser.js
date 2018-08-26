import {AST} from '../../ast';
import {Literal, Expression} from '../../nodes';

const TOKENS = {
  OPEN_PAREN: 'open-paren',
  CLOSE_PAREN: 'close-paren',
  IDENTIFIER: 'identifier',
  NUMBER: 'number',
  EOF: 'eof'
};

class Token {
  constructor(from, to, token, text) {
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
  getch() {
    let ch = this.code[this.charIndex];
    this.charIndex++;
    this.colIndex++;
    if (ch == '\n') {
      this.lineIndex++;
      this.colIndex = 0;
    }
    return ch;
  }

  getExceptionMessage(e){
    return e || "Parser error";
  }

  getToken() {
    const IDENTIFIER_RE = /[\w-+/*]/;
    if (this.charIndex >= this.code.length) {
      return new Token(
        {line: this.lineIndex, ch: this.colIndex},
        {line: this.lineIndex, ch: this.colIndex},
        TOKENS.EOF,
        ''
      );
    }
    if (this.code[this.charIndex] == '(') {
      let token = new Token(
        {line: this.lineIndex, ch: this.colIndex},
        {line: this.lineIndex, ch: this.colIndex + 1},
        TOKENS.OPEN_PAREN,
        '('
      );
      this.getch();
      return token;
    } else if (this.code[this.charIndex] == ')') {
      let token = new Token(
        {line: this.lineIndex, ch: this.colIndex},
        {line: this.lineIndex, ch: this.colIndex+1},
        TOKENS.CLOSE_PAREN,
        ')'
      );
      this.getch();
      return token;
    } else if (this.code[this.charIndex] == ' ') {
      while (this.code[this.charIndex] == ' ') {
        this.getch();
      }
      return this.getToken();
    } else if (this.code[this.charIndex] >= '0' && this.code[this.charIndex] <= '9') {
      let startIndex = this.colIndex;
      let number = '';
      while (this.code[this.charIndex] >= '0' && this.code[this.charIndex] <= '9') {
        number += this.getch();
      }
      return new Token(
        {line: this.lineIndex, ch: startIndex},
        {line: this.lineIndex, ch: startIndex + number.length},
        TOKENS.NUMBER,
        number
      );
    } else if (this.code[this.charIndex].match(IDENTIFIER_RE)) {
      let identifier = '';
      let startIndex = this.colIndex;
      while (this.code[this.charIndex].match(IDENTIFIER_RE)) {
        identifier += this.getch();
      }
      return new Token(
        {line: this.lineIndex, ch: startIndex},
        {line: this.lineIndex, ch: startIndex + identifier.length},
        TOKENS.IDENTIFIER,
        identifier
      );
    } else if (this.code[this.charIndex] == '\n') {
      this.getch();
      return this.getToken();
    } else {
      throw new Error("parse error");
    }
  }

  peekToken() {
    let oldCharIndex = this.charIndex;
    let oldLineIndex = this.lineIndex;
    let oldColIndex = this.colIndex;
    let token = this.getToken();
    this.charIndex = oldCharIndex;
    this.lineIndex = oldLineIndex;
    this.colIndex = oldColIndex;
    return token;
  }

  lex(code) {
    return this.parse(code);
  }

  parse(code) {
    this.code = code;
    this.charIndex = 0;
    this.lineIndex = 0;
    this.colIndex = 0;

    let rootNodes = [];
    while (this.peekToken().token != TOKENS.EOF) {
      rootNodes.push(this.parseNextToken());
    }
    return new AST(rootNodes);
  }

  parseNextToken() {
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
    var literalToken = this.getToken();
    return new Literal(
      literalToken.from,
      literalToken.to,
      parseInt(literalToken.text),
      'number'
    );
  }

  parseExpression() {
    let token = this.getToken();
    if (token.token != TOKENS.OPEN_PAREN) {
      throw new Error("Expected an open paren");
    }
    if (this.peekToken().token != TOKENS.IDENTIFIER) {
      throw new Error("Expected an identifier");
    }
    let identifierToken = this.getToken();
    var args = [];
    while (this.peekToken().token != TOKENS.CLOSE_PAREN) {
      args.push(this.parseNextToken());
    }
    let closeParenToken = this.getToken();
    return new Expression(
      token.from,
      closeParenToken.to,
      new Literal(identifierToken.from, identifierToken.to, identifierToken.text, 'symbol'),
      args
    );
  }
}
