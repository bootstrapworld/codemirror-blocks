import * as TOK from "./pyret-lang/pyret-tokenizer.js";
import * as P from "./pyret-lang/pyret-parser.js";
import * as TR from "./pyret-lang/translate-parse-tree.js";
import {
  AST,
  ASTNode
} from '../../ast';
import {
  Literal, 
} from '../../nodes';
import {Binop,
  ABlank,
  Bind,
  Func,
  Sekwence as Sequence,
  Var,
  Assign,
  Let
} from "./ast";

interface Position {
  line: number;
  ch: number;
}

class Range {
  from: Position;
  to: Position;
  constructor(from: Position, to: Position) {
    this.from = from;
    this.to = to;
  }
}

function startOf(srcloc: { startRow: number; startCol: number; }) {
  return {
    "line": srcloc.startRow - 1,
    "ch":   srcloc.startCol
  };
}

function endOf(srcloc: { endRow: number; endCol: number; }) {
  return {
    "line": srcloc.endRow - 1,
    "ch":   srcloc.endCol
  };
}

const opLookup = {
  "+":   "op+",
  "-":   "op-",
  "*":   "op*",
  "/":   "op/",
  "$":   "op$",
  "^":   "op^",
  "<":   "op<",
  "<=":  "op<=",
  ">":   "op>",
  ">=":  "op>=",
  "==":  "op==",
  "=~":  "op=~",
  "<=>": "op<=>",
  "<>":  "op<>",
  "and": "opand",
  "or":  "opor"
  // TODO: check ops
};

// TODO: all of these are preliminary for testing
const nodeTypes = {
  "s-program": function(_pos: Range, _prov: any, _provTy: any, _impt: any, body: { exprs: any; }) {
    let rootNodes = body.exprs;
    return new AST(rootNodes);
  },
  "s-name": function(pos: Range, str: string) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  },
  "s-id": function(pos: Range, str: string) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  },
  "s-num": function(pos: Range, x: string) {
    return new Literal(
      pos.from,
      pos.to,
      x,
      'number');
  },
  "s-block": function(pos: Range, stmts: [any]) {
    return new Sequence(
      pos.from,
      pos.to,
      stmts,
      'block');
  },
  "s-op": function(pos: Range, _opPos: any, op: { substr: (arg0: number) => void; }, left: any, right: any) {
    return new Binop(
      pos.from,
      pos.to,
      op.substr(2),
      left,
      right);
  },
  "s-bind": function(pos: Range, _shadows: any, id: any, ann: any) {
    // TODO: ignoring shadowing for now.
    return new Bind(
      pos.from,
      pos.to,
      id,
      ann);
  },
  "s-fun": function(pos: Range, name: any, _params: any, args: any, ann: any, doc: any, body: any, _checkLoc: any, _check: any, _blodky: any) {
    // TODO: ignoring params, check, blocky
    return new Func(
      pos.from,
      pos.to,
      name,
      args,
      ann,
      doc,
      body);
  },
  // Annotations
  "a-blank": function() {
    return new ABlank(undefined, undefined);
  },
  "a-name": function(pos: Range, str: any) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  }
}

function makeNode(nodeType: string | number) {
  const args = Array.prototype.slice.call(arguments, 1);
  const constructor = nodeTypes[nodeType];
  if (constructor === undefined) {
    console.log("Warning: node type", nodeType, "NYI");
    return;
  } else {
    return constructor.apply(this, args);
  }
}

function makeSrcloc(_fileName: any, srcloc: any) {
  return new Range(startOf(srcloc), endOf(srcloc));
}

function combineSrcloc(_fileName: any, startPos: any, endPos: any) {
  return new Range(startOf(startPos), endOf(endPos));
}

function translateParseTree(parseTree: any, fileName: string) {
  function NYI(msg: string) {
    return function() {
      console.log(msg, "not yet implemented");
    }
  }
  const constructors = {
    "makeNode": makeNode,
    "opLookup": opLookup,
    "makeLink": function(a: any, b: any[]) {
      b.push(a); // Probably safe?
      return b;
    },
    "makeEmpty": function() {
      return new Array();
    },
    "makeString": function(str: any) {
      return str;
    },
    "makeNumberFromString": function(str: string) {
      // TODO: error handling
      return parseFloat(str);
    },
    "makeBoolean": function(bool: any) {
      return bool;
    },
    "makeNone": function() {
      return null;
    },
    "makeSome": function(value: any) {
      return value;
    },
    "getRecordFields": NYI("getRecordFields"),
    "makeSrcloc": makeSrcloc,
    "combineSrcloc": combineSrcloc,
    "detectAndComplainAboutOperatorWhitespace": function(_kids: any, _fileName: any) {
      return;
    }
  };
  return TR.translate(parseTree, fileName, constructors);
}

export default class PyretParser {
  // TODO: Proper error handling.
  //       See `pyret-lang/src/js/trove/parse-pyret.js`.
  parse(text: string) {
    // Tokenize
    const tokenizer = TOK.Tokenizer;
    tokenizer.tokenizeFrom(text);
    // Parse
    console.log("@going to parse");
    const parsed = P.PyretGrammar.parse(tokenizer);
    if (parsed) {
      console.log("@valid parse");
      // Count parse trees
      const countParses = P.PyretGrammar.countAllParses(parsed);
      if (countParses === 1) {
        console.log("@exactly one valid parse", parsed);
        // Construct parse tree
        const parseTree = P.PyretGrammar.constructUniqueParse(parsed);
        console.log("@reconstructed unique parse");
        // Translate parse tree to AST
        const ast = translateParseTree(parseTree, "<editor>.arr");
        return ast;
      } else {
        throw "Multiple parses";
      }
    } else {
      console.log("Invalid parse");
      // really, curTok does exist, but ts isn't smart enough to detect
      console.log("Next token is " + (tokenizer as any).curTok.toRepr(true)
                  + " at " + (tokenizer as any).curTok.pos.toString(true));
    }
  }

  getExceptionMessage(error: any) {
    return error;
  }
}

function testRun() {
  const data = `
  fun foo(x :: Number):
  x + 3
  end
  `
  const parser = new PyretParser();
  const ast = parser.parse(data);
  console.log("\nBlocky AST:\n");
  console.log(ast.toString());
  console.log("\nBlocky AST (JS view):\n");
  console.log(ast);
}
