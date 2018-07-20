"use strict";

const R = require("requirejs");

R.config({
  paths: {
    'jglr': "../../../lib/pyret-lang/lib/jglr/",
    'pyret-base': "../../../lib/pyret-lang/build/phaseA",
    'src-base/js': "../../../lib/pyret-lang/src/js/base"
  }
});

// TODO: Waiting on hearing how I'm supposed to run something other
// than the whole editor. Until them, stubs.
class Literal {
  constructor(from, to, value, dataType) {
    this.from = from;
    this.to = to;
    this.value = value;
    this.dataType = dataType;
  }
  toString() {
    return `${this.value}`;
  }
}

class Binop {
  constructor(from, to, op, left, right) {
    this.from = from;
    this.to = to;
    this.op = op;
    this.left = left;
    this.right = right;
  }
  toString() {
    return `(${this.op} ${this.left} ${this.right})`;
  }
}

class ABlank {
  constructor() {}
  toString() {
    return `Any`;
  }
}

class Sequence {
  constructor(from, to, exprs, name) {
    this.from = from;
    this.to = to;
    this.exprs = exprs;
    this.name = name;
  }
  toString() {
    return `(${this.name} ${this.exprs.join(" ")})`;
  }
}

class Bind {
  constructor(from, to, id, ann) {
    this.from = from;
    this.to = to;
    this.id = id;
    this.ann = ann;
  }
  toString() {
    return `(bind ${this.id} ${this.ann})`;
  }
}

class Function {
  constructor(from, to, name, args, retAnn, doc, body) {
    this.from = from;
    this.to = to;
    this.args = args;
    this.retAnn = retAnn;
    this.doc = doc;
    this.body = body;
  }
  toString() {
    return `(fun (${this.args.join(" ")}) ${this.retAnn} "${this.doc}" ${this.body})`;
  }
}



// TODO: Proper error handling.
//       See `pyret-lang/src/js/trove/parse-pyret.js`.

R(["pyret-base/js/pyret-tokenizer",
   "pyret-base/js/pyret-parser",
   "pyret-base/js/translate-parse-tree",
   "fs"],
  function(TOK, P, TR, FS) {

    // TODO: This should be defined somewhere else; not sure where yet
    class Position {
      constructor(from, to) {
        this.from = from;
        this.to = to;
      }
    }

    function startOf(srcloc) {
      // TODO: temporary sanity check
      if (srcloc.startRow === undefined) {
        throw "Invalid srcloc";
      }
      return {
        "line": srcloc.startRow,
        "ch":   srcloc.startCol
      }
    }

    function endOf(srcloc) {
      // TODO: temporary sanity check
      if (srcloc.endCol === undefined) {
        throw "Invalid srcloc";
      }
      return {
        "line": srcloc.endRow,
        "ch":   srcloc.endCol
      }
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
    }

    // TODO: all of these are preliminary for testing
    const nodeTypes = {
      "s-program": function(pos, prov, provTy, impt, body) {
        return body;
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
          op,
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
        return new Function(
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

    function parsePyret(file) {
      console.log(file);
      // Tokenize
      const tokenizer = TOK.Tokenizer;
      tokenizer.tokenizeFrom(data);
      // Parse
      const parsed = P.PyretGrammar.parse(tokenizer);
      if (parsed) {
        // Count parse trees
        const countParses = P.PyretGrammar.countAllParses(parsed);
        if (countParses === 1) {
          // Construct parse tree
          const parseTree = P.PyretGrammar.constructUniqueParse(parsed);
          // Print parse tree
          console.log("Parse tree:\n");
          console.log(parseTree.toString());
          // Translate parse tree to AST
          const ast = translateParseTree(parseTree, fileName);
          return ast;
        } else {
          throw "Multiple parses";
        }
      } else {
        console.log("Invalid parse");
        console.log("Next token is " + tokens.curTok.toRepr(true)
                    + " at " + tokens.curTok.pos.toString(true));
      }
    }

    const fileName = process.argv[2];
    console.log("Parsing file", fileName, "\n");
    const data = FS.readFileSync(fileName, {encoding: "utf-8"});
    const ast = parsePyret(data);
    console.log("\nBlocky AST:\n");
    console.log(ast.toString());
    console.log("\nBlocky AST (JS view):\n");
    console.log(ast);
  });

