import {AST, Literal, FunctionDefinition, Expression, Blank} from '../../ast';
export default function convertAST(ast){

  //Type Conversion
  var typeMap = {
    "num": "number",
    "str": "string",
    "bool": "bool",
    "boolean": "bool",
    "var": "symbol",
    "lambda": "functionDef",
    "call": "expression"
  };

  //Const-Var/Literal Conversion
  if (ast.type === "num" || ast.type === "str" || ast.type === "bool" || ast.type === "var") {
    ast.type = typeMap[ast.type];
    //from to stuff
    //var literal = new Literal(ast.from, ast.to, ast.value, ast.type);
  }

  //Function Definition Conversion
  //TODO: Add recursive conversion for body and arguments
  if (ast.type === "lambda") {
    ast.type = typeMap[ast.type];
    ast.body.type = typeMap[ast.body.type];
    var args = [];
    for (var object in ast.vars) {
      args.push({ type: typeMap[typeof(ast.vars[object])], value: ast.vars[object] });
    }
    ast.vars = args;
  }

  //Function Call Conversion
  //TODO: Add recursive conversion for arguments
  if (ast.type === "call") {
    ast.type = typeMap[ast.type];
    ast.func.type = typeMap[ast.type];
    ast.func.dataType = typeMap[ast.type];
    if (ast.vars) {
      for (var object in ast.vars) {
        args.push({ type: typeMap[typeof(ast.vars[object])], value: ast.vars[object] });
      }
      ast.vars = args;
    }
    else {
      ast.vars = { type: "expression", data: "...", dataType: "blank"}
    }

  //Assignment/Expression Conversion


  var rootNodes = [
    new FunctionDefinition({line:0, ch:4}, {line:0, ch:10}, ast.name, ast.vars, ast.body)
    //literal
  ];
  return new AST(rootNodes);

}