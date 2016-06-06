import {AST, Literal, FunctionDefinition} from '../../ast';
export default function convertAST(ast){

  //Type Conversion
  var typeMap = {
    "num": "number",
    "str": "string",
    "bool": "bool",
    "boolean": "bool",
    "var": "symbol",
    "lambda": "functionDef"
  };

  //Const-Var/Literal Conversion
  if (ast.type === "num" || ast.type === "str" || ast.type === "bool" || ast.type === "var") {
    ast.type = typeMap[ast.type];
  }

  //Lambda/Function Definition Conversion
  if (ast.type === "lambda") {
    ast.type = typeMap[ast.type];
    ast.body.type = typeMap[ast.body.type];
    var args = [];
    for (var object in ast.vars) {
      args.push({ type: typeMap[typeof(ast.vars[object])], value: ast.vars[object] });
    }
    ast.vars = args;
  }

  //Assignment/Expression Conversion

  var rootNodes = [
    new FunctionDefinition({line:0, ch:4}, {line:0, ch:10}, ast.name, ast.vars, ast.body)
  ];
  return new AST(rootNodes);

}