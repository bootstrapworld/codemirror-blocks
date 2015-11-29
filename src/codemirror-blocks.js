import CodeMirrorBlocks from './blocks';
// XXX: for some reason, the below line doesn't get transformed correctly by babel.
// I've checked https://github.com/babel/babel/commits/master/packages/babel-plugin-transform-es2015-modules-commonjs/src/index.js
// and it looks correct, but for some reason it ends up with a var instead of a let
// at the end of running the compile step
//export * from './ast'
import * as ast from './ast';
export var AST = ast.AST;
export var Expression = ast.Expression;
export var Literal = ast.Literal;
export default CodeMirrorBlocks;