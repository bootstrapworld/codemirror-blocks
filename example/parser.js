import {Literal, Expression} from '../src/ast'

const TOKENS = {
  OPEN_PAREN: 'open-paren',
  CLOSE_PAREN: 'close-paren',
  IDENTIFIER: 'identifier',
  NUMBER: 'number',
  EOF: 'eof'
}

class Token {
  constructor(from, to, token, text) {
    this.from = from
    this.to = to
    this.token = token
    this.text = text
  }
  toString() {
    return `${this.token}: ${this.from.line},${this.from.ch} ${this.to.line},${this.to.ch} "${this.text}"`
  }
}

export default class Parser {
  getToken() {
    const IDENTIFIER_RE = /[\w-+\/*]/
    if (this.charIndex >= this.code.length) {
      return new Token(
        {line: this.lineIndex, ch: this.charIndex},
        {line: this.lineIndex, ch: this.charIndex},
        TOKENS.EOF,
        ''
      )
    }
    if (this.code[this.charIndex] == '(') {
      let token = new Token(
        {line: this.lineIndex, ch: this.charIndex},
        {line: this.lineIndex, ch: this.charIndex+1},
        TOKENS.OPEN_PAREN,
        '('
      )
      this.charIndex++
      return token
    } else if (this.code[this.charIndex] == ')') {
      let token = new Token(
        {line: this.lineIndex, ch: this.charIndex},
        {line: this.lineIndex, ch: this.charIndex+1},
        TOKENS.CLOSE_PAREN,
        ')'
      )
      this.charIndex++
      return token
    } else if (this.code[this.charIndex] == ' ') {
      while (this.code[this.charIndex] == ' ') {
        this.charIndex++
      }
      return this.getToken()
    } else if (this.code[this.charIndex] >= '0' && this.code[this.charIndex] <= '9') {
      let startIndex = this.charIndex
      let number = ''
      while (this.code[this.charIndex] >= '0' && this.code[this.charIndex] <= '9') {
        number += this.code[this.charIndex++]
      }
      return new Token(
        {line: this.lineIndex, ch: startIndex},
        {line: this.lineIndex, ch: startIndex + number.length},
        TOKENS.NUMBER,
        number
      )
    } else if (this.code[this.charIndex].match(IDENTIFIER_RE)) {
      let identifier = ''
      let startIndex = this.charIndex
      while (this.code[this.charIndex].match(IDENTIFIER_RE)) {
        identifier += this.code[this.charIndex++]
      }
      return new Token(
        {line: this.lineIndex, ch: startIndex},
        {line: this.lineIndex, ch: startIndex + identifier.length},
        TOKENS.IDENTIFIER,
        identifier
      )
    } else if (this.code[this.charIndex] == '\n') {
      this.charIndex++
      this.lineIndex++
      return this.getToken()
    } else {
      throw new Error("parse error")
    }
  }

  parse(code) {
    this.code = code
    this.charIndex = 0
    this.lineIndex = 0

    return this.parseExpression()
  }

  parseExpression() {
    var token = this.getToken()
    if (token.token != TOKENS.OPEN_PAREN) {
      throw new Error("Expected an open paren")
    }
    var identifierToken = this.getToken()
    if (identifierToken.token != TOKENS.IDENTIFIER) {
      throw new Error("Expected an identifier")
    }
    var args = []
    var currentToken = this.getToken()
    while (currentToken.token != TOKENS.CLOSE_PAREN) {
      switch (currentToken.token) {
      case TOKENS.OPEN_PAREN:
        this.charIndex--
        args.push(this.parseExpression())
        break
      case TOKENS.NUMBER:
        args.push(
          new Literal(
            currentToken.from,
            currentToken.to,
            parseInt(currentToken.text)
          )
        )
        break
      default:
        throw new Error("Expected either a number or another expression")
      }
      currentToken = this.getToken()
    }
    return new Expression(token.from, currentToken.to, identifierToken.text, args)
  }
}
