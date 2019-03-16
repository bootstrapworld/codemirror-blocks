"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TOK = require("./pyret-lang/pyret-tokenizer.js");
const P = require("./pyret-lang/pyret-parser.js");
const TR = require("./pyret-lang/translate-parse-tree.js");
const ast_1 = require("../../ast");
const nodes_1 = require("../../nodes");
const ast_js_1 = require("./ast.js");
class Range {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }
}
function startOf(srcloc) {
    return {
        "line": srcloc.startRow - 1,
        "ch": srcloc.startCol
    };
}
function endOf(srcloc) {
    return {
        "line": srcloc.endRow - 1,
        "ch": srcloc.endCol
    };
}
const opLookup = {
    "+": "op+",
    "-": "op-",
    "*": "op*",
    "/": "op/",
    "$": "op$",
    "^": "op^",
    "<": "op<",
    "<=": "op<=",
    ">": "op>",
    ">=": "op>=",
    "==": "op==",
    "=~": "op=~",
    "<=>": "op<=>",
    "<>": "op<>",
    "and": "opand",
    "or": "opor"
};
const nodeTypes = {
    "s-program": function (_pos, _prov, _provTy, _impt, body) {
        let rootNodes = body.exprs;
        return new ast_1.AST(rootNodes);
    },
    "s-name": function (pos, str) {
        return new nodes_1.Literal(pos.from, pos.to, str, 'symbol');
    },
    "s-id": function (pos, str) {
        return new nodes_1.Literal(pos.from, pos.to, str, 'symbol');
    },
    "s-num": function (pos, x) {
        return new nodes_1.Literal(pos.from, pos.to, x, 'number');
    },
    "s-block": function (pos, stmts) {
        return new ast_js_1.Sekwence(pos.from, pos.to, stmts, 'block');
    },
    "s-op": function (pos, _opPos, op, left, right) {
        return new ast_js_1.Binop(pos.from, pos.to, op.substr(2), left, right);
    },
    "s-bind": function (pos, _shadows, id, ann) {
        return new ast_js_1.Bind(pos.from, pos.to, id, ann);
    },
    "s-fun": function (pos, name, _params, args, ann, doc, body, _checkLoc, _check, _blodky) {
        return new ast_js_1.Func(pos.from, pos.to, name, args, ann, doc, body);
    },
    "a-blank": function () {
        return new ast_js_1.ABlank();
    },
    "a-name": function (pos, str) {
        return new nodes_1.Literal(pos.from, pos.to, str, 'symbol');
    }
};
function makeNode(nodeType) {
    const args = Array.prototype.slice.call(arguments, 1);
    const constructor = nodeTypes[nodeType];
    if (constructor === undefined) {
        console.log("Warning: node type", nodeType, "NYI");
        return;
    }
    else {
        return constructor.apply(this, args);
    }
}
function makeSrcloc(_fileName, srcloc) {
    return new Range(startOf(srcloc), endOf(srcloc));
}
function combineSrcloc(_fileName, startPos, endPos) {
    return new Range(startOf(startPos), endOf(endPos));
}
function translateParseTree(parseTree, fileName) {
    function NYI(msg) {
        return function () {
            console.log(msg, "not yet implemented");
        };
    }
    const constructors = {
        "makeNode": makeNode,
        "opLookup": opLookup,
        "makeLink": function (a, b) {
            b.push(a);
            return b;
        },
        "makeEmpty": function () {
            return new Array();
        },
        "makeString": function (str) {
            return str;
        },
        "makeNumberFromString": function (str) {
            return parseFloat(str);
        },
        "makeBoolean": function (bool) {
            return bool;
        },
        "makeNone": function () {
            return null;
        },
        "makeSome": function (value) {
            return value;
        },
        "getRecordFields": NYI("getRecordFields"),
        "makeSrcloc": makeSrcloc,
        "combineSrcloc": combineSrcloc,
        "detectAndComplainAboutOperatorWhitespace": function (_kids, _fileName) {
            return;
        }
    };
    return TR.translate(parseTree, fileName, constructors);
}
class PyretParser {
    parse(text) {
        const tokenizer = TOK.Tokenizer;
        tokenizer.tokenizeFrom(text);
        console.log("@going to parse");
        const parsed = P.PyretGrammar.parse(tokenizer);
        if (parsed) {
            console.log("@valid parse");
            const countParses = P.PyretGrammar.countAllParses(parsed);
            if (countParses === 1) {
                console.log("@exactly one valid parse", parsed);
                const parseTree = P.PyretGrammar.constructUniqueParse(parsed);
                console.log("@reconstructed unique parse");
                const ast = translateParseTree(parseTree, "<editor>.arr");
                return ast;
            }
            else {
                throw "Multiple parses";
            }
        }
        else {
            console.log("Invalid parse");
            console.log("Next token is " + tokenizer.curTok.toRepr(true)
                + " at " + tokenizer.curTok.pos.toString(true));
        }
    }
    getExceptionMessage(error) {
        return error;
    }
}
exports.PyretParser = PyretParser;
module.exports = PyretParser;
function testRun() {
    const data = `
  fun foo(x :: Number):
  x + 3
  end
  `;
    const parser = new PyretParser();
    const ast = parser.parse(data);
    console.log("\nBlocky AST:\n");
    console.log(ast.toString());
    console.log("\nBlocky AST (JS view):\n");
    console.log(ast);
}
//# sourceMappingURL=PyretParser.js.map