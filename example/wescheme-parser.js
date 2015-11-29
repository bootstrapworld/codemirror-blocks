import {AST, Expression, Literal, Struct, FunctionDefinition} from '../src/ast';
import {lex} from 'wescheme-js/src/lex';
import {parse} from 'wescheme-js/src/parser';
var types = require('wescheme-js/src/runtime/types');
import * as structures from 'wescheme-js/src/structures';

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
    return new Expression(
      from,
      to,
      node.func.stx,
      node.args.map(parseNode).filter(item => item !== null)
    );
  } else if (node instanceof structures.andExpr) {
    return new Expression(
      from,
      to,
      "and",
      node.exprs.map(parseNode).filter(item => item !== null)
    );
  } else if (node instanceof structures.orExpr) {
    return new Expression(
      from,
      to,
      "or",
      node.exprs.map(parseNode).filter(item => item !== null)
    );
  } else if (node instanceof structures.defVar) {
    return new Expression(
      from,
      to,
      "define",
      [parseNode(node.name), parseNode(node.expr)]
    );
  } else if (node instanceof structures.defStruct) {
    return new Struct(
      from,
      to,
      node.name.stx,
      node.fields.map(parseNode).filter(item => item != null)
    );
  } else if (node instanceof structures.defFunc) {
    return new FunctionDefinition(
      from,
      to,
      node.name.stx,
      node.args.map(symbolNode => symbolNode.stx),
      parseNode(node.body)
    );
  } else if (node instanceof structures.symbolExpr) {
    return new Literal(from, to, node.stx, "symbol");
  } else if (node instanceof structures.literal) {
    var dataType = typeof node.val;
    if (types.isString(node.val)) {
      dataType = "string";
    } else if (types.isChar(node.val)) {
      dataType = "char";
    } else if (node.val === types.FALSE || node.val === types.TRUE) {
      dataType = "boolean";
    }
    return new Literal(from, to, node, dataType);
  }
  console.log("!! No translator for", node);
  return null;
}

export default class Parser {

  parse(code) {
    var ast = parse(lex(code, 'foo', true));
    var rootNodes = ast.map(parseNode).filter(item => item !== null);
    return new AST(rootNodes);
  }

}
