/*eslint indent: "off"*/

import { AST, Nodes, PrimitiveGroup } from "codemirror-blocks";
const {
  Blank,
  Literal,
  StructDefinition,
  IdentifierList,
  FunctionDefinition,
  IfExpression,
  CondExpression,
  LambdaExpression,
  CondClause,
  Comment,
  VariableDefinition,
  FunctionApp,
  Unknown,
} = Nodes;
import { LetLikeExpr, WhenUnless, Sequence } from "./ast";
import PRIMITIVES_CONFIG from "./primitives-config";
import { lex } from "lex";
import {
  isString,
  isChar,
  isVector as isNativeVector,
  TRUE,
  FALSE,
} from "types";
import * as structures from "structs";

let symbolMap = new Map();
symbolMap.set("*", "multiply");
symbolMap.set("-", "subtract");
symbolMap.set("/", "divide");

// symbolAria : String -> String
function symbolAria(str) {
  // if there's no str available, it's an anonymous function
  if (!str) {
    return "anonymous function";
    // make sure it's a string (in the event of a number in the fn position
  } else {
    str = str.toString();
  }

  if (symbolMap.get(str)) {
    // translate simple symbols
    return symbolMap.get(str);
  } else {
    // pronounce special chars, scheme-style
    str = str.replace("?", "-huh").replace("!", "-bang").replace("*", "-star");
    // pronounce quotes
    str = str.replace('"', " quote");
    // pronounce braces
    str = str.replace("(", " open paren").replace(")", " close paren");
    str = str.replace("[", " open bracket").replace("]", " close bracket");
    return str;
  }
}

// expressionAria: String Array -> String
function expressionAria(func, args) {
  return symbolAria(func) + " expression, " + pluralize("input", args);
}

function pluralize(noun, set) {
  return set.length + " " + noun + (set.length != 1 ? "s" : "");
}

// makeComment : WeSchemeComment -> ASTNodeComment
function makeComment(node) {
  var from = {
    line: (node.comment || node).location.startRow - 1,
    ch: (node.comment || node).location.startCol,
  };
  var to = {
    line: (node.comment || node).location.endRow - 1,
    ch: (node.comment || node).location.endCol,
  };
  return new Comment(from, to, node.comment.txt);
}

// enumerateIdentifierList : [Literals] -> String
// do the right thing with commas, "and", etc
function enumerateIdentifierList(lst) {
  if (lst.length == 0) return "";
  lst = lst.slice(0);
  var last = lst.pop();
  return lst.length == 0
    ? last.toString()
    : lst.join(", ") + " and " + last.toString();
}

// parseNode : WeSchemeNode Number -> ASTNode
function parseNode(node, i) {
  function locationFromNode(node) {
    var from = {
      line: node.location.startRow - 1,
      ch: node.location.startCol,
    };
    var to = {
      line: node.location.endRow - 1,
      ch: node.location.endCol,
    };
    return { from, to };
  }

  function parseBinding(b) {
    let loc = locationFromNode(b);
    let name = parseNode(b.first);
    let val = parseNode(b.second);
    return new VariableDefinition(loc.from, loc.to, name, val, {
      "aria-label":
        symbolAria(b.first.val) + " bound to " + val.options["aria-label"],
      comment: comment,
    });
  }

  let { from, to } = locationFromNode(node);
  let comment = node.comment ? makeComment(node) : false;

  if (node instanceof structures.callExpr) {
    let func,
      label,
      children = node.args.map(parseNode).filter((item) => item !== null);
    if (!node.func) {
      func = new Blank(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 1 },
        "...",
        "blank",
        { "aria-label": "*blank*" }
      );
      // special case for Unit Tests
    } else {
      func = parseNode(node.func);
      if (func.value == "check-expect" && node.args[0].func) {
        label = "Unit Test for " + symbolAria(node.args[0].func.val);
      } else {
        label = expressionAria(
          node.func ? symbolAria(node.func.val) : "empty",
          node.args
        );
      }
    }
    return new FunctionApp(from, to, func, children, {
      "aria-label": label,
      comment: comment,
    });
  } else if (node instanceof structures.andExpr) {
    let comment = node.comment ? makeComment(node) : false;
    return new FunctionApp(
      from,
      to,
      new Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 4 },
        "and",
        "symbol",
        { "aria-label": "and" }
      ),
      node.exprs.map(parseNode).filter((item) => item !== null),
      { "aria-label": expressionAria("and", node.exprs), comment: comment }
    );
  } else if (node instanceof structures.orExpr) {
    let comment = node.comment ? makeComment(node) : false;
    return new FunctionApp(
      from,
      to,
      new Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 3 },
        "or",
        "symbol",
        { "aria-label": "or" }
      ),
      node.exprs.map(parseNode).filter((item) => item !== null),
      { "aria-label": expressionAria("or", node.exprs), comment: comment }
    );
  } else if (node instanceof structures.defVar) {
    return new VariableDefinition(
      from,
      to,
      parseNode(node.name),
      parseNode(node.expr),
      {
        "aria-label": symbolAria(node.name.val) + ": value definition",
        comment: comment,
      }
    );
  } else if (node instanceof structures.defStruct) {
    let fieldsLoc = locationFromNode(node.fields);
    let fields = new IdentifierList(
      fieldsLoc.from,
      fieldsLoc.to,
      "fields",
      node.fields.map(parseNode),
      {
        "aria-label":
          pluralize("field", node.fields) +
          ": " +
          enumerateIdentifierList(node.fields),
        comment: node.fields.comment ? makeComment(node.fields) : false,
      }
    );
    return new StructDefinition(from, to, parseNode(node.name), fields, {
      "aria-label":
        symbolAria(node.name.val) +
        ": structure definition with " +
        pluralize("field", node.fields) +
        ": " +
        enumerateIdentifierList(node.fields),
      comment: comment,
    });
  } else if (node instanceof structures.defFunc) {
    let argsLoc = locationFromNode(node.args);
    let args = new IdentifierList(
      argsLoc.from,
      argsLoc.to,
      "arguments:",
      node.args.map(parseNode),
      {
        "aria-label":
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: node.args.comment ? makeComment(node.args) : false,
      }
    );
    return new FunctionDefinition(
      from,
      to,
      parseNode(node.name),
      args,
      parseNode(node.body),
      {
        "aria-label":
          symbolAria(node.name.val) +
          ": function definition with " +
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: comment,
      }
    );
  } else if (node instanceof structures.lambdaExpr) {
    let argsLoc = locationFromNode(node.args);
    let args = new IdentifierList(
      argsLoc.from,
      argsLoc.to,
      "arguments",
      node.args.map(parseNode),
      {
        "aria-label":
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: node.args.comment ? makeComment(node.args) : false,
      }
    );
    return new LambdaExpression(from, to, args, parseNode(node.body), {
      "aria-label":
        "anonymous function with " +
        pluralize("argument", node.args) +
        ": " +
        enumerateIdentifierList(node.args),
    });
  } else if (node instanceof structures.condExpr) {
    return new CondExpression(from, to, node.clauses.map(parseNode), {
      "aria-label":
        "conditional expression with " + pluralize("clause", node.clauses),
    });
  } else if (node instanceof structures.couple) {
    return new CondClause(
      from,
      to,
      parseNode(node.first),
      [parseNode(node.second)],
      { "aria-label": "condition " + (i + 1) }
    );
  } else if (node instanceof structures.ifExpr) {
    let predicate = parseNode(node.predicate);
    let consequence = parseNode(node.consequence);
    let alternative = parseNode(node.alternative);
    let predLabel = predicate.options["aria-label"];
    let conLabel = consequence.options["aria-label"];
    let altLabel = alternative.options["aria-label"];
    predicate.options["aria-label"] = "if, " + predLabel;
    consequence.options["aria-label"] = "then, " + conLabel;
    alternative.options["aria-label"] = "else, " + altLabel;
    return new IfExpression(from, to, predicate, consequence, alternative, {
      "aria-label": "if-then-else expression",
      comment: comment,
    });
  } else if (node instanceof structures.symbolExpr) {
    if (node.val == "...") {
      return new Blank(from, to, node.val, "symbol", { "aria-label": "blank" });
    } else if (["true", "false"].includes(node.val)) {
      return new Literal(from, to, node.val, "boolean", {
        "aria-label": symbolAria(node.val) + ", a Boolean",
        comment: comment,
      });
    } else {
      return new Literal(from, to, node.val, "symbol", {
        "aria-label": symbolAria(node.val),
        comment: comment,
      });
    }
  } else if (node instanceof structures.literal) {
    let dataType = typeof node.val,
      aria = node.toString(),
      value = node.toString();
    if (isString(node.val)) {
      dataType = "string";
      aria = `${node.val}, a String`;
      value = '"' + node.val + '"'; // use the raw value, plus the quotes (for unicode symbols)
    } else if (isChar(node.val)) {
      dataType = "character";
      aria = `${node.val.val}, a Character`;
    } else if (node.val === FALSE || node.val === TRUE) {
      dataType = "boolean";
      aria = `${node.val}, a Boolean`;
    } else if (node.val.isRational && node.val.isRational()) {
      dataType = "number";
      aria = `${String(node.val.numerator())} over ${String(
        node.val.denominator()
      )}, a Rational`;
    }
    return new Literal(from, to, value, dataType, {
      "aria-label": aria,
      comment: comment,
    });
  } else if (node instanceof structures.comment) {
    return new Comment(from, to, node.txt);
  } else if (node instanceof structures.beginExpr) {
    return new Sequence(
      from,
      to,
      node.exprs.map(parseNode),
      new Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 6 },
        "begin",
        "symbol",
        { "aria-label": "begin" }
      ),
      {
        "aria-label": `sequence containing ${pluralize(
          "expression",
          node.exprs
        )}`,
      }
    );
  } else if (
    node instanceof structures.letExpr ||
    node instanceof structures.letStarExpr ||
    node instanceof structures.letrecExpr
  ) {
    let loc = locationFromNode(node.bindings),
      form = node.stx[0].val;
    return new LetLikeExpr(
      from,
      to,
      form,
      new Sequence(
        loc.from,
        loc.to,
        node.bindings.map(parseBinding),
        "bindings",
        { "aria-label": `${pluralize("binding", node.bindings)}` }
      ),
      parseNode(node.body),
      {
        "aria-label": `${symbolAria(form)} expression with ${pluralize(
          "binding",
          node.bindings
        )}`,
      }
    );
  } else if (node instanceof structures.whenUnlessExpr) {
    let loc = locationFromNode(node.exprs),
      form = node.stx.val;
    return new WhenUnless(
      from,
      to,
      form,
      parseNode(node.predicate),
      new Sequence(loc.from, loc.to, node.exprs.map(parseNode), "begin", {
        "aria-label": `${pluralize("expression", node.exprs)}`,
      }),
      { "aria-label": `${symbolAria(form)} expression` }
    );
  } else if (node instanceof structures.unsupportedExpr) {
    if (node.val.constructor !== Array) return null;
    let unknown = new Unknown(
      from,
      to,
      node.val.map(parseNode).filter((item) => item !== null),
      {
        msg: node.errorMsg,
        "aria-label": "invalid expression",
        comment: comment,
      }
    );
    console.log(unknown);
    return unknown;
  } else if (node instanceof structures.requireExpr) {
    return new FunctionApp(
      from,
      to,
      parseNode(node.stx),
      [parseNode(node.spec)],
      { "aria-label": "require " + node.spec.val, comment: comment }
    );
  }
  console.log("!! No translator for", node);
  return null;
}

const dummyLoc = { line: -1, ch: 0 };

class WeschemeParser {
  getASTNodeForPrimitive(primitive) {
    return new FunctionApp(
      dummyLoc,
      dummyLoc,
      new Literal(dummyLoc, dummyLoc, primitive.name, "symbol"),
      primitive.argumentTypes.map(() => new Blank(dummyLoc, dummyLoc, "")),
      { "aria-label": primitive.name + " expression" }
    );
  }

  getLiteralNodeForPrimitive(primitive) {
    return new Literal(dummyLoc, dummyLoc, primitive.name, "symbol", {
      "aria-label": primitive.name,
    });
  }

  primitivesFn() {
    return PrimitiveGroup.fromConfig("wescheme", PRIMITIVES_CONFIG);
  }

  lex(code) {
    return lex(code);
  }

  parse(code) {
    function fallback(sexp) {
      var elts =
        sexp instanceof Array ? parseStar(sexp) : [parseExprSingleton(sexp)];
      var guess = new structures.unsupportedExpr(elts, "Parse error");
      guess.location = sexp.location;
      return guess;
    }

    //////////////////////////////////// UTILITY FUNCTIONS //////////////////////////////
    function isVector(x) {
      return isNativeVector(x.val);
    }
    function isString(x) {
      return isString(x.val);
    }
    function isSymbol(x) {
      return x instanceof structures.symbolExpr;
    }
    function isLiteral(x) {
      return x instanceof structures.literal;
    }
    function isUnsupported(x) {
      return x instanceof structures.unsupportedExpr;
    }
    function isComment(x) {
      return x instanceof structures.comment;
    }

    function isCons(x) {
      return x instanceof Array && x.length >= 1;
    }
    function rest(ls) {
      return ls.slice(1);
    }

    // isSymbolEqualTo : symbolExpr symbolExpr -> Boolean
    // are these all symbols of the same value?
    function isSymbolEqualTo(x, y) {
      x = isSymbol(x) ? x.val : x;
      y = isSymbol(y) ? y.val : y;
      return x === y;
    }

    function throwError(msg) {
      throw msg;
    }

    // PARSING ///////////////////////////////////////////

    // parse* : sexp list -> Program list
    function parseStar(sexps) {
      function parseSExp(sexp) {
        var p = isComment(sexp)
          ? sexp
          : isDefinition(sexp)
          ? parseDefinition(sexp)
          : isExpr(sexp)
          ? parseExpr(sexp)
          : isRequire(sexp)
          ? parseRequire(sexp)
          : isProvide(sexp)
          ? parseProvide(sexp)
          : throwError(
              `ASSERTION: Something was lexed that is not in the language:\n ${sexp}`
            );
        p.comment = sexp.comment;
        return p;
      }
      return sexps.map(parseSExp);
    }

    // parse : sexp list -> Program list
    function parse(sexp) {
      return sexp.length === 0
        ? []
        : !isCons(sexp)
        ? fallback(sexp)
        : parseStar(sexp);
    }

    //////////////////////////////////////// DEFINITION PARSING ////////////////////////////////
    // (define-struct ...)
    function isStructDefinition(sexp) {
      return (
        isCons(sexp) &&
        isSymbol(sexp[0]) &&
        isSymbolEqualTo("define-struct", sexp[0])
      );
    }
    // (define ...)
    function isValueDefinition(sexp) {
      return (
        isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define", sexp[0])
      );
    }
    // (define-values ...)
    function isMultiValueDefinition(sexp) {
      return (
        isCons(sexp) &&
        isSymbol(sexp[0]) &&
        isSymbolEqualTo("define-values", sexp[0])
      );
    }
    // is it any kind of definition?
    function isDefinition(sexp) {
      return (
        isStructDefinition(sexp) ||
        isValueDefinition(sexp) ||
        isMultiValueDefinition(sexp)
      );
    }

    // : parseDefinition : SExp -> AST (definition)
    function parseDefinition(sexp) {
      function parseDefStruct(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !isSymbol(sexp[1]) || // is the structure name there?
          !(sexp[2] instanceof Array) || // is the structure name followed by a list?
          !sexp[2].every(isSymbol)
        ) {
          // too many expressions?
          return fallback(sexp);
        }
        let fields = sexp[2].map(parseIdExpr);
        fields.location = sexp[2].location;
        return new structures.defStruct(parseIdExpr(sexp[1]), fields, sexp);
      }

      function parseMultiDef(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array)
        ) {
          // is it (define-values <not a list> )?
          return fallback(sexp);
        }
        return new structures.defVars(
          sexp[1].map(parseIdExpr),
          parseExpr(sexp[2]),
          sexp
        );
      }

      function parseDef(sexp) {
        if (sexp.length < 2) {
          return fallback(sexp);
        } // is it just (define)?
        // If it's (define (...)...)
        if (sexp[1] instanceof Array) {
          if (
            sexp[1].length === 0 || // is there at least one element?
            !isSymbol(sexp[1][0]) || // is the first element in the list a symbol?
            !sexp[1].every(isSymbol) || // is the next element a list of not-all-symbols?
            sexp.length !== 3
          ) {
            // is it the wrong # of parts?
            return fallback(sexp);
          }
          let args = rest(sexp[1]).map(parseIdExpr);
          let func = parseIdExpr(sexp[1][0]);
          // construct the location manually, excluding the func name
          if (args.length > 0) {
            args.location = {
              startCol: args[0].location.startCol,
              startRow: args[0].location.startRow,
              startChar: args[0].location.startChar,
              endCol: args[args.length - 1].location.endCol,
              endRow: args[args.length - 1].location.endRow,
              endChar: args[args.length - 1].location.endChar,
            };
          } else {
            args.location = {
              startCol: func.location.endCol,
              startRow: func.location.endRow,
              startChar: func.location.endChar,
              endCol: func.location.endCol,
              endRow: func.location.endRow,
              endChar: func.location.endChar,
            };
          }
          return new structures.defFunc(func, args, parseExpr(sexp[2]), sexp);
        }
        // If it's (define x ...)
        if (isSymbol(sexp[1])) {
          if (sexp.length !== 3) {
            // is it the wrong # of parts?
            return fallback(sexp);
          }
          return new structures.defVar(
            parseIdExpr(sexp[1]),
            parseExpr(sexp[2]),
            sexp
          );
        }
        // if it's neither form of define...
        return fallback(sexp);
      }
      var def = isStructDefinition(sexp)
        ? parseDefStruct(sexp)
        : isValueDefinition(sexp)
        ? parseDef(sexp)
        : isMultiValueDefinition
        ? parseMultiDef(sexp)
        : fallback(sexp);
      def.location = sexp.location;
      return def;
    }

    //////////////////////////////////////// EXPRESSION PARSING ////////////////////////////////
    function isExpr(sexp) {
      return !isDefinition(sexp) && !isRequire(sexp) && !isProvide(sexp);
    }

    function parseExpr(sexp) {
      var p = isCons(sexp) ? parseExprList(sexp) : parseExprSingleton(sexp);
      if (!isComment(p)) p.comment = sexp.comment;
      return p;
    }

    // parseExprList : SExp -> AST
    // predicates and parsers for call, lambda, local, letrec, let, let*, if, and, or, quote and quasiquote exprs
    function parseExprList(sexp) {
      function parseFuncCall(sexp) {
        if (
          isSymbolEqualTo(sexp[0], "unquote") || // improper unquote
          isSymbolEqualTo(sexp[0], "unquote-splicing") || // improper unquote-splicing
          isSymbolEqualTo(sexp[0], "else")
        ) {
          // improper else
          return fallback(sexp);
        }
        return isCons(sexp)
          ? new structures.callExpr(
              parseExpr(sexp[0]),
              rest(sexp).map(parseExpr),
              sexp[0]
            )
          : fallback(sexp);
      }

      function parseLambdaExpr(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array) || // is it just (lambda <not-list>)?
          !sexp[1].every(isSymbol)
        ) {
          // is it a list of not-all-symbols?
          return fallback(sexp);
        }
        var args = sexp[1].map(parseIdExpr);
        args.location = sexp[1].location;
        return new structures.lambdaExpr(args, parseExpr(sexp[2]), sexp[0]);
      }

      function parseLocalExpr(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array) || // is it just (local <not-list>)?
          !sexp[1].every(isDefinition)
        ) {
          // is it a list of not-all-definitions?
          return fallback(sexp);
        }
        return new structures.localExpr(
          sexp[1].map(parseDefinition),
          parseExpr(sexp[2]),
          sexp[0]
        );
      }

      function parseLetrecExpr(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array) || // is it just (letrec <not-list>)?
          !sexp[1].every(sexpIsCouple)
        ) {
          // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        let bindings = sexp[1].map(parseBinding);
        bindings.location = sexp[1].location;
        return new structures.letrecExpr(bindings, parseExpr(sexp[2]), sexp);
      }

      function parseLetExpr(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array) || // is it just (let <not-list>)?
          !sexp[1].every(sexpIsCouple)
        ) {
          // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        let bindings = sexp[1].map(parseBinding);
        bindings.location = sexp[1].location;
        return new structures.letExpr(bindings, parseExpr(sexp[2]), sexp);
      }

      function parseLetStarExpr(sexp) {
        if (
          sexp.length !== 3 || // is it the wrong # of parts?
          !(sexp[1] instanceof Array) || // is it just (let* <not-list>)?
          !sexp[1].every(sexpIsCouple)
        ) {
          // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        var bindings = sexp[1].map(parseBinding);
        bindings.location = sexp[1].location;
        return new structures.letStarExpr(bindings, parseExpr(sexp[2]), sexp);
      }

      function parseIfExpr(sexp) {
        if (sexp.length !== 4) {
          return fallback(sexp);
        } // Does it have the wrong # of parts?
        return new structures.ifExpr(
          parseExpr(sexp[1]),
          parseExpr(sexp[2]),
          parseExpr(sexp[3]),
          sexp[0]
        );
      }

      function parseBeginExpr(sexp) {
        if (sexp.length < 2) {
          return fallback(sexp);
        } // is it just (begin)?
        return new structures.beginExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseAndExpr(sexp) {
        if (sexp.length < 3) {
          return fallback(sexp);
        } // and must have 2+ arguments
        return new structures.andExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseOrExpr(sexp) {
        if (sexp.length < 3) {
          return fallback(sexp);
        } // or must have 2+ arguments
        return new structures.orExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseQuotedExpr(sexp) {
        function parseQuotedItem(sexp) {
          return isCons(sexp)
            ? sexp.map(parseQuotedItem)
            : sexp instanceof Array && sexp.length === 0
            ? sexp // the empty list is allowed inside quotes
            : /* else */ parseExprSingleton(sexp);
        }
        // quote must have exactly one argument
        if (sexp.length !== 2) {
          return fallback(sexp);
        }
        return new structures.quotedExpr(parseQuotedItem(sexp[1]));
      }

      return (function () {
        var peek = sexp[0];
        var expr = !isSymbol(peek)
          ? parseFuncCall(sexp)
          : isSymbolEqualTo("λ", peek)
          ? parseLambdaExpr(sexp)
          : isSymbolEqualTo("lambda", peek)
          ? parseLambdaExpr(sexp)
          : isSymbolEqualTo("local", peek)
          ? parseLocalExpr(sexp)
          : isSymbolEqualTo("letrec", peek)
          ? parseLetrecExpr(sexp)
          : isSymbolEqualTo("let", peek)
          ? parseLetExpr(sexp)
          : isSymbolEqualTo("let*", peek)
          ? parseLetStarExpr(sexp)
          : isSymbolEqualTo("cond", peek)
          ? parseCondExpr(sexp)
          : isSymbolEqualTo("case", peek)
          ? parseCaseExpr(sexp)
          : isSymbolEqualTo("if", peek)
          ? parseIfExpr(sexp)
          : isSymbolEqualTo("begin", peek)
          ? parseBeginExpr(sexp)
          : isSymbolEqualTo("and", peek)
          ? parseAndExpr(sexp)
          : isSymbolEqualTo("or", peek)
          ? parseOrExpr(sexp)
          : isSymbolEqualTo("when", peek)
          ? parseWhenUnlessExpr(sexp)
          : isSymbolEqualTo("unless", peek)
          ? parseWhenUnlessExpr(sexp)
          : isSymbolEqualTo("quote", peek)
          ? parseQuotedExpr(sexp)
          : isSymbolEqualTo("quasiquote", peek)
          ? parseQuasiQuotedExpr(sexp)
          : isSymbolEqualTo("unquote", peek)
          ? parseUnquoteExpr(sexp)
          : isSymbolEqualTo("unquote-splicing", peek)
          ? parseUnquoteSplicingExpr(sexp)
          : parseFuncCall(sexp);
        expr.location = sexp.location;
        return expr;
      })();
    }

    function parseWhenUnlessExpr(sexp) {
      if (sexp.length < 3) {
        return fallback(sexp);
      } // is it just (when)?
      var exprs = sexp.slice(2),
        result = new structures.whenUnlessExpr(
          parseExpr(sexp[1]),
          parse(exprs),
          sexp[0]
        );
      // construct the location manually from first and last expr
      result.exprs.location = {
        startCol: exprs[0].location.startCol,
        startRow: exprs[0].location.startRow,
        startChar: exprs[0].location.startChar,
        endCol: exprs[exprs.length - 1].location.endCol,
        endRow: exprs[exprs.length - 1].location.endRow,
        endChar: exprs[exprs.length - 1].location.endChar,
      };
      result.location = sexp.location;
      return result;
    }

    function parseCondExpr(sexp) {
      if (sexp.length === 1) {
        return fallback(sexp);
      } // is it just (cond)?

      function isElseClause(couple) {
        return isSymbol(couple[0]) && isSymbolEqualTo(couple[0], "else");
      }

      function checkCondCouple(clause) {
        if (
          !(clause instanceof Array) || // is it (cond ...<not-a-clause>..)?
          clause.length !== 2
        ) {
          throw "ParseError";
        }
      }

      function parseCondCouple(clause) {
        var test = parseExpr(clause[0]),
          result = parseExpr(clause[1]),
          cpl = new structures.couple(test, result);
        // the only un-parenthesized keyword allowed in the first slot is 'else'
        if (structures.keywords.includes(test.val) && test.val !== "else") {
          throw "ParseError";
        }
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = clause.location;
        return cpl;
      }

      try {
        // first check the couples, then parse if there's no problem
        rest(sexp).forEach(checkCondCouple);
        var numClauses = rest(sexp).length,
          parsedClauses = rest(sexp).map(parseCondCouple);
        // if we see an else and we haven't seen all other clauses first
        // throw an error that points to the next clause (rst + the one we're looking at + "cond")
        rest(sexp).forEach(function (couple, idx) {
          if (isElseClause(couple) && idx < numClauses - 1) {
            throw "ParseError";
          }
        });
      } catch (e) {
        return fallback(sexp);
      }
      // return condExpr
      return new structures.condExpr(parsedClauses, sexp[0]);
    }

    function parseCaseExpr(sexp) {
      // is it the wrong # of parts?
      if (sexp.length !== 3) {
        return fallback(sexp);
      }

      function checkCaseCouple(clause) {
        if (
          !(clause instanceof Array) ||
          clause.length !== 2 ||
          !(
            clause[0] instanceof Array ||
            (isSymbol(clause[0]) && isSymbolEqualTo(clause[0], "else"))
          )
        ) {
          throw "ParseError";
        }
      }

      // is this sexp actually an else clause?
      function isElseClause(sexp) {
        return isSymbol(sexp[0]) && sexp[0].val === "else";
      }

      // read the first item in the clause as a quotedExpr, and parse the second
      // if it's an else clause, however, leave it alone
      function parseCaseCouple(sexp) {
        var test = isElseClause(sexp)
            ? sexp[0]
            : new structures.quotedExpr(sexp[0]),
          result = parseExpr(sexp[1]),
          cpl = new structures.couple(test, result);
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = sexp.location;
        return cpl;
      }

      try {
        var clauses = sexp.slice(2);
        // first check the couples, then parse if there's no problem
        clauses.forEach(checkCaseCouple);
        var numClauses = clauses.length,
          parsedClauses = clauses.map(parseCaseCouple);

        // if we see an else and we haven't seen all other clauses first
        // throw an error that points to the next clause (rst + the one we're looking at + "cond")
        clauses.forEach(function (couple, idx) {
          if (isElseClause(couple) && idx < numClauses - 1) {
            throw "ParseError";
          }
        });
      } catch (e) {
        return fallback(sexp);
      }
      // it's good! return caseExpr
      return new structures.caseExpr(
        parseExpr(sexp[1]),
        parsedClauses,
        sexp[0]
      );
    }

    function parseBinding(sexp) {
      if (sexpIsCouple(sexp)) {
        var binding = new structures.couple(
          parseIdExpr(sexp[0]),
          parseExpr(sexp[1])
        );
        binding.location = sexp.location;
        binding.stx = sexp;
        return binding;
      } else {
        return fallback(sexp);
      }
    }

    function parseUnquoteExpr(sexp, depth) {
      var result;
      if (typeof depth === "undefined" || sexp.length !== 2) {
        return fallback(sexp);
      } else if (depth === 1) {
        result = new structures.unquotedExpr(parseExpr(sexp[1]));
        result.location = sexp[1].location;
        return result;
      } else if (depth > 1) {
        result = new structures.unquotedExpr(
          parseQuasiQuotedItem(sexp[1], depth - 1)
        );
        result.location = sexp[1].location;
        return result;
      } else {
        throw "ASSERTION FAILURE: depth should have been undefined, or a natural number";
      }
    }

    function parseUnquoteSplicingExpr(sexp, depth) {
      var result;
      if (typeof depth === "undefined" || sexp.length !== 2) {
        return fallback(sexp);
      } else if (depth === 1) {
        result = new structures.unquoteSplice(parseExpr(sexp[1]));
        result.location = sexp[1].location;
        return result;
      } else if (depth > 1) {
        result = new structures.unquoteSplice(
          parseQuasiQuotedItem(sexp[1], depth - 1)
        );
        result.location = sexp[1].location;
        return result;
      } else {
        throw "ASSERTION FAILURE: depth should have been undefined, or a natural number";
      }
    }

    /* This is what we use in place of `parseExpr` when we're in "data-mode",  */
    /* i.e. there's an active quasiquote. Active is a bit awkward to describe, */
    /* but basically it's an unmatch quasiquote, if we think of unquotes as    */
    /* matching quasiquotes, so:                                               */
    /*   ``,(+ 1 2)                                                            */
    /* has an active quasiquote while reading (+ 1 2), whereas:                */
    /*   ``,,(+ 1 2)                                                           */
    /* does not.                                                               */
    function parseQuasiQuotedItem(sexp, depth) {
      if (isCons(sexp) && sexp[0].val === "unquote") {
        return parseUnquoteExpr(sexp, depth);
      } else if (isCons(sexp) && sexp[0].val === "unquote-splicing") {
        return parseUnquoteSplicingExpr(sexp, depth);
      } else if (isCons(sexp) && sexp[0].val === "quasiquote") {
        return parseQuasiQuotedExpr(sexp, depth);
      } else if (isCons(sexp)) {
        var res = sexp.map(function (x) {
          return parseQuasiQuotedItem(x, depth);
        });
        res.location = sexp.location;
        return res;
      } else if (depth === 0) {
        return parseExpr(sexp);
      } else {
        return (function () {
          var res = new structures.quotedExpr(sexp);
          res.location = sexp.location;
          return res;
        })();
      }
    }

    function parseQuasiQuotedExpr(sexp, depth) {
      depth = typeof depth === "undefined" ? 0 : depth;
      if (
        sexp.length !== 2 || // quasiquote must have exactly one argument
        // if the argument is (unquote-splicing....), throw an error
        (isCons(sexp[1]) && isSymbolEqualTo(sexp[1][0], "unquote-splicing"))
      ) {
        return fallback(sexp);
      }

      var quoted = parseQuasiQuotedItem(sexp[1], depth + 1);
      quoted.location = sexp[1].location;
      var result = new structures.quasiquotedExpr(quoted);
      result.location = sexp.location;
      return result;
    }

    // replace all undefineds with the last sexp, and convert to a function call
    function parseVector(sexp) {
      function buildZero() {
        var lit = new structures.literal(0);
        lit.location = sexp.location;
        return lit;
      }
      var unParsedVector = sexp.val,
        vals = parseStar(
          unParsedVector.elts.filter(function (e) {
            return e !== undefined;
          })
        ),
        last = vals.length === 0 ? buildZero() : vals[vals.length - 1], // if they're all undefined, use 0
        elts = unParsedVector.elts.map(function (v) {
          return v === undefined ? last : parseExpr(v);
        });
      var vectorFunc = new structures.symbolExpr("vector"),
        buildVector = new structures.callExpr(vectorFunc, elts);
      vectorFunc.location = buildVector.location = sexp.location;
      return buildVector;
    }

    function parseExprSingleton(sexp) {
      var singleton = isComment(sexp)
        ? sexp
        : isUnsupported(sexp)
        ? sexp
        : isVector(sexp)
        ? parseVector(sexp)
        : isSymbol(sexp)
        ? sexp
        : isLiteral(sexp)
        ? sexp
        : isSymbolEqualTo("quote", sexp)
        ? new structures.quotedExpr(sexp)
        : isSymbolEqualTo("empty", sexp)
        ? new structures.callExpr(new structures.symbolExpr("list"), [])
        : new structures.callExpr(null, []);
      singleton.location = sexp.location;
      if (!isComment(sexp)) singleton.comment = sexp.comment;
      return singleton;
    }

    function parseIdExpr(sexp) {
      return isSymbol(sexp) ? sexp : fallback(sexp);
    }

    function sexpIsCouple(sexp) {
      return isCons(sexp) && sexp.length === 2;
    }

    //////////////////////////////////////// REQUIRE PARSING ////////////////////////////////
    function isRequire(sexp) {
      return (
        isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "require")
      );
    }

    function parseRequire(sexp) {
      if (sexp.length < 2) {
        return fallback(sexp);
      } // is it (require)?
      if (sexp[1] instanceof Array && isSymbolEqualTo(sexp[1][0], "lib")) {
        if (
          sexp[1].length < 3 || // is it (require (lib)) or (require (lib <string>))
          !rest(sexp[1]).every(isString)
        ) {
          // is it (require (lib not-strings))?
          return fallback(sexp);
        }
      } else if (
        (sexp[1] instanceof Array && isSymbolEqualTo(sexp[1][0], "planet")) ||
        !(isSymbol(sexp[1]) || isString(sexp[1]))
      ) {
        return fallback(sexp); // if it's (require (planet...))
      }
      var req = new structures.requireExpr(sexp[1], sexp[0]);
      req.location = sexp.location;
      return req;
    }

    //////////////////////////////////////// PROVIDE PARSING ////////////////////////////////
    function isProvide(sexp) {
      return (
        isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "provide")
      );
    }

    function parseProvide(sexp) {
      var clauses = rest(sexp).map(function (p) {
        // symbols are ok
        if (isSymbol(p)) {
          return p;
        }
        // (struct-out sym) is ok
        if (
          p instanceof Array &&
          p.length == 2 &&
          isSymbol(p[0]) &&
          isSymbolEqualTo(p[0], "struct-out") &&
          isSymbol(p[1])
        ) {
          return p;
        }
        // everything else is NOT okay
        return fallback(sexp);
      });
      var provide = new structures.provideStatement(clauses, sexp[0]);
      provide.location = sexp.location;
      return provide;
    }

    let ast = parseStar(lex(code));
    let rootNodes = ast.map(parseNode).filter((item) => item !== null);
    return new AST.AST(rootNodes);
  }

  getExceptionMessage(e) {
    // TODO: Using JSON.parse is not safe. Sometimes it could result in a parsing error.
    console.error(e);
    let msg = JSON.parse(e)["dom-message"][2].slice(2);
    let txt = msg.every((element) => typeof element === "string")
      ? msg
      : msg[0] instanceof Array
      ? msg[0][2].substring(msg[0][2].indexOf("read: ") + 6)
      : "Check your quotation marks, or any other symbols you've used";
    return symbolAria(txt);
  }
}

export default lex
  ? WeschemeParser
  : () => {
      throw new Error(
        "wescheme-js must be installed to use the wescheme blocks parser"
      );
    };
