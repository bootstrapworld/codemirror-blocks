import {AST, Literal, FunctionDefinition} from '../../ast';
export default function convertAST(ast){
  var lambdaTypeToCMBType = {
    "num": "number",
    "str": "string",
    "bool": "bool",
    "var": "symbol",
  };
  var rootNodes = [
    new Literal({line: 0, ch:0}, {line:0, ch: 3}, ast.value, lambdaTypeToCMBType[ast.type]),
    new FunctionDefinition({line:0, ch:4}, {line:0, ch:10}, "name", ast.vars)
  ];
  return new AST(rootNodes);
}