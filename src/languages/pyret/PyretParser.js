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
} from "./ast.js"

// TODO: This should be defined somewhere else; not sure where yet
class Position {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  };
}

function startOf(srcloc) {
  return {
    "line": srcloc.startRow - 1,
    "ch":   srcloc.startCol
  };
}

function endOf(srcloc) {
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
  "+":   "op+",
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
  "s-program": function(pos, prov, provTy, impt, body) {
    let rootNodes = body.exprs;
    return new AST(rootNodes);
  },
  "s-name": function(pos, str) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  },
  "s-id": function(pos, str) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  },
  "s-num": function(pos, x) {
    return new Literal(
      pos.from,
      pos.to,
      x,
      'number');
  },
  "s-block": function(pos, stmts) {
    return new Sequence(
      pos.from,
      pos.to,
      stmts,
      'block');
  },
  "s-op": function(pos, opPos, op, left, right) {
    return new Binop(
      pos.from,
      pos.to,
      op.substr(2),
      left,
      right);
  },
  "s-bind": function(pos, shadows, id, ann) {
    // TODO: ignoring shadowing for now.
    return new Bind(
      pos.from,
      pos.to,
      id,
      ann);
  },
  "s-fun": function(pos, name, params, args, ann, doc, body, checkLoc, check, blodky) {
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
    return new ABlank();
  },
  "a-name": function(pos, str) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol');
  }
}

function makeNode(nodeType) {
  const args = Array.prototype.slice.call(arguments, 1);
  const constructor = nodeTypes[nodeType];
  if (constructor === undefined) {
    console.log("Warning: node type", nodeType, "NYI");
    return;
  } else {
    return constructor.apply(this, args);
  }
}

function makeSrcloc(fileName, srcloc) {
  return new Position(startOf(srcloc), endOf(srcloc));
}

function combineSrcloc(fileName, startPos, endPos) {
  return new Position(startOf(startPos), endOf(endPos));
}

function translateParseTree(parseTree, fileName) {
  function NYI(msg) {
    return function() {
      console.log(msg, "not yet implemented");
    }
  }
  const constructors = {
    "makeNode": makeNode,
    "opLookup": opLookup,
    "makeLink": function(a, b) {
      b.push(a); // Probably safe?
      return b;
    },
    "makeEmpty": function() {
      return new Array();
    },
    "makeString": function(str) {
      return str;
    },
    "makeNumberFromString": function(str) {
      // TODO: error handling
      return parseFloat(str);
    },
    "makeBoolean": function(bool) {
      return bool;
    },
    "makeNone": function() {
      return null;
    },
    "makeSome": function(value) {
      return value;
    },
    "getRecordFields": NYI("getRecordFields"),
    "makeSrcloc": makeSrcloc,
    "combineSrcloc": combineSrcloc,
    "detectAndComplainAboutOperatorWhitespace": function(kids, fileName) {
      return;
    }
  };
  return TR.translate(parseTree, fileName, constructors);
}

export class PyretParser {
  // TODO: Proper error handling.
  //       See `pyret-lang/src/js/trove/parse-pyret.js`.
  parse(text) {
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
      console.log("Next token is " + tokenizer.curTok.toRepr(true)
                  + " at " + tokenizer.curTok.pos.toString(true));
    }
  }

  getExceptionMessage(error) {
    return error;
  }
}

module.exports = PyretParser;

function testRun() {
  const data = `
  fun foo(x :: Number):
  x + 3
  end
  `
  const ast = parsePyret(data);
  console.log("\nBlocky AST:\n");
  console.log(ast.toString());
  console.log("\nBlocky AST (JS view):\n");
  console.log(ast);
}
