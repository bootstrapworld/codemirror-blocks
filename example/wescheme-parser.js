import {AST, Expression, Literal} from '../src/ast'
import {lex} from 'wescheme-js/lib/lex'
import {parse} from 'wescheme-js/lib/parser'
import * as structures from 'wescheme-js/lib/structures'

function parseNode(node) {
  var from = {
    line: node.location.startRow - 1,
    ch: node.location.startCol
  };
  var to = {
    line: node.location.endRow - 1,
    ch: node.location.endCol
  };

  if (node instanceof structures.callExpr) {
    return new Expression(from, to, node.func.stx, node.args.map(parseNode));
  } else if (node instanceof structures.literal) {
    return new Literal(from, to, node.stx);
  }
}

export default class Parser {

  parse(code) {
    var ast = parse(lex(code, 'foo', true));
    var rootNodes = ast.map(parseNode);
    console.log(rootNodes);
    return new AST(rootNodes);
  }

}
