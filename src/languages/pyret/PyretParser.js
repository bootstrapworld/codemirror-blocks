"use strict";
exports.__esModule = true;
var TOK = require("./pyret-lang/pyret-tokenizer.js");
var P = require("./pyret-lang/pyret-parser.js");
var TR = require("./pyret-lang/translate-parse-tree.js");
var ast_1 = require("../../ast");
var nodes_1 = require("../../nodes");
var ast_js_1 = require("./ast.js");
var Range = /** @class */ (function () {
    function Range(from, to) {
        this.from = from;
        this.to = to;
    }
    return Range;
}());
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
var opLookup = {
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
    // TODO: check ops
};
// TODO: all of these are preliminary for testing
var nodeTypes = {
    "s-program": function (_pos, _prov, _provTy, _impt, body) {
        var rootNodes = body.exprs;
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
        // TODO: ignoring shadowing for now.
        return new ast_js_1.Bind(pos.from, pos.to, id, ann);
    },
    "s-fun": function (pos, name, _params, args, ann, doc, body, _checkLoc, _check, _blodky) {
        // TODO: ignoring params, check, blocky
        return new ast_js_1.Func(pos.from, pos.to, name, args, ann, doc, body);
    },
    // Annotations
    "a-blank": function () {
        return new ast_js_1.ABlank();
    },
    "a-name": function (pos, str) {
        return new nodes_1.Literal(pos.from, pos.to, str, 'symbol');
    }
};
function makeNode(nodeType) {
    var args = Array.prototype.slice.call(arguments, 1);
    var constructor = nodeTypes[nodeType];
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
    var constructors = {
        "makeNode": makeNode,
        "opLookup": opLookup,
        "makeLink": function (a, b) {
            b.push(a); // Probably safe?
            return b;
        },
        "makeEmpty": function () {
            return new Array();
        },
        "makeString": function (str) {
            return str;
        },
        "makeNumberFromString": function (str) {
            // TODO: error handling
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
var PyretParser = /** @class */ (function () {
    function PyretParser() {
    }
    // TODO: Proper error handling.
    //       See `pyret-lang/src/js/trove/parse-pyret.js`.
    PyretParser.prototype.parse = function (text) {
        // Tokenize
        var tokenizer = TOK.Tokenizer;
        tokenizer.tokenizeFrom(text);
        // Parse
        console.log("@going to parse");
        var parsed = P.PyretGrammar.parse(tokenizer);
        if (parsed) {
            console.log("@valid parse");
            // Count parse trees
            var countParses = P.PyretGrammar.countAllParses(parsed);
            if (countParses === 1) {
                console.log("@exactly one valid parse", parsed);
                // Construct parse tree
                var parseTree = P.PyretGrammar.constructUniqueParse(parsed);
                console.log("@reconstructed unique parse");
                // Translate parse tree to AST
                var ast = translateParseTree(parseTree, "<editor>.arr");
                return ast;
            }
            else {
                throw "Multiple parses";
            }
        }
        else {
            console.log("Invalid parse");
            // really, curTok does exist, but ts isn't smart enough to detect
            console.log("Next token is " + tokenizer.curTok.toRepr(true)
                + " at " + tokenizer.curTok.pos.toString(true));
        }
    };
    PyretParser.prototype.getExceptionMessage = function (error) {
        return error;
    };
    return PyretParser;
}());
exports.PyretParser = PyretParser;
module.exports = PyretParser;
function testRun() {
    var data = "\n  fun foo(x :: Number):\n  x + 3\n  end\n  ";
    var parser = new PyretParser();
    var ast = parser.parse(data);
    console.log("\nBlocky AST:\n");
    console.log(ast.toString());
    console.log("\nBlocky AST (JS view):\n");
    console.log(ast);
}
