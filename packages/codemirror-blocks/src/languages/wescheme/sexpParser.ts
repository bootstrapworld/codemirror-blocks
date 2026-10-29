import type { ASTNode } from "../../ast";
import { parseNodeOrNull } from "./parseNode";

import { lex } from "wescheme-js/src/lex";
import * as types from "wescheme-js/src/runtime/types";
import * as structuresModule from "wescheme-js/src/structures";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The wescheme-js lexer produces loosely-structured s-expressions: nested
// arrays and `structures.*` instances that get extra properties (`location`,
// `comment`) attached as parsing proceeds. This module is a direct port of
// that dynamic style, so s-expressions are deliberately typed as `any` here.
type Sexp = any;
// structures are also constructed dynamically with varying argument shapes
const structures: Sexp = structuresModule;

export function parse(code: string) {
  function fallback(sexp: Sexp): Sexp {
    const elts =
      sexp instanceof Array ? parseStar(sexp) : [parseExprSingleton(sexp)];
    const guess = new structures.unsupportedExpr(elts, "Parse error");
    guess.location = sexp.location;
    return guess;
  }

  //////////////////////////////////// UTILITY FUNCTIONS //////////////////////////////
  function isVector(x: Sexp): Sexp {
    return types.isVector(x.val);
  }
  function isString(x: Sexp): Sexp {
    return types.isString(x.val);
  }
  function isSymbol(x: Sexp): Sexp {
    return x instanceof structures.symbolExpr;
  }
  function isLiteral(x: Sexp): Sexp {
    return x instanceof structures.literal;
  }
  function isUnsupported(x: Sexp): Sexp {
    return x instanceof structures.unsupportedExpr;
  }
  function isComment(x: Sexp): Sexp {
    return x instanceof structures.comment;
  }

  function isCons(x: Sexp): Sexp {
    return x instanceof Array && x.length >= 1;
  }
  function rest(ls: Sexp): Sexp {
    return ls.slice(1);
  }

  // isSymbolEqualTo : symbolExpr symbolExpr -> Boolean
  // are these all symbols of the same value?
  function isSymbolEqualTo(x: Sexp, y: Sexp): Sexp {
    x = isSymbol(x) ? x.val : x;
    y = isSymbol(y) ? y.val : y;
    return x === y;
  }

  function throwError(msg: Sexp): Sexp {
    throw msg;
  }

  // PARSING ///////////////////////////////////////////

  // parse* : sexp list -> Program list
  function parseStar(sexps: Sexp): Sexp {
    function parseSExp(sexp: Sexp): Sexp {
      const p = isComment(sexp)
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
  function parse(sexp: Sexp): Sexp {
    return sexp.length === 0
      ? []
      : !isCons(sexp)
      ? fallback(sexp)
      : parseStar(sexp);
  }

  //////////////////////////////////////// DEFINITION PARSING ////////////////////////////////
  // (define-struct ...)
  function isStructDefinition(sexp: Sexp): Sexp {
    return (
      isCons(sexp) &&
      isSymbol(sexp[0]) &&
      isSymbolEqualTo("define-struct", sexp[0])
    );
  }
  // (define ...)
  function isValueDefinition(sexp: Sexp): Sexp {
    return (
      isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define", sexp[0])
    );
  }
  // (define-values ...)
  function isMultiValueDefinition(sexp: Sexp): Sexp {
    return (
      isCons(sexp) &&
      isSymbol(sexp[0]) &&
      isSymbolEqualTo("define-values", sexp[0])
    );
  }
  // is it any kind of definition?
  function isDefinition(sexp: Sexp): Sexp {
    return (
      isStructDefinition(sexp) ||
      isValueDefinition(sexp) ||
      isMultiValueDefinition(sexp)
    );
  }

  // : parseDefinition : SExp -> AST (definition)
  function parseDefinition(sexp: Sexp): Sexp {
    function parseDefStruct(sexp: Sexp): Sexp {
      if (
        sexp.length !== 3 || // is it the wrong # of parts?
        !isSymbol(sexp[1]) || // is the structure name there?
        !(sexp[2] instanceof Array) || // is the structure name followed by a list?
        !sexp[2].every(isSymbol)
      ) {
        // too many expressions?
        return fallback(sexp);
      }
      const fields: Sexp = sexp[2].map(parseIdExpr);
      fields.location = (sexp[2] as Sexp).location;
      return new structures.defStruct(parseIdExpr(sexp[1]), fields, sexp);
    }

    function parseMultiDef(sexp: Sexp): Sexp {
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

    function parseDef(sexp: Sexp): Sexp {
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
        const args = rest(sexp[1]).map(parseIdExpr);
        const func = parseIdExpr(sexp[1][0]);
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
    const def = isStructDefinition(sexp)
      ? parseDefStruct(sexp)
      : isValueDefinition(sexp)
      ? parseDef(sexp)
      : isMultiValueDefinition(sexp)
      ? parseMultiDef(sexp)
      : fallback(sexp);
    def.location = sexp.location;
    return def;
  }

  //////////////////////////////////////// EXPRESSION PARSING ////////////////////////////////
  function isExpr(sexp: Sexp): Sexp {
    return !isDefinition(sexp) && !isRequire(sexp) && !isProvide(sexp);
  }

  function parseExpr(sexp: Sexp): Sexp {
    const p = isCons(sexp) ? parseExprList(sexp) : parseExprSingleton(sexp);
    if (!isComment(p)) p.comment = sexp.comment;
    return p;
  }

  // parseExprList : SExp -> AST
  // predicates and parsers for call, lambda, local, letrec, let, let*, if, and, or, quote and quasiquote exprs
  function parseExprList(sexp: Sexp): Sexp {
    function parseFuncCall(sexp: Sexp): Sexp {
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

    function parseLambdaExpr(sexp: Sexp): Sexp {
      if (
        sexp.length !== 3 || // is it the wrong # of parts?
        !(sexp[1] instanceof Array) || // is it just (lambda <not-list>)?
        !sexp[1].every(isSymbol)
      ) {
        // is it a list of not-all-symbols?
        return fallback(sexp);
      }
      const args: Sexp = sexp[1].map(parseIdExpr);
      args.location = (sexp[1] as Sexp).location;
      return new structures.lambdaExpr(args, parseExpr(sexp[2]), sexp[0]);
    }

    function parseLocalExpr(sexp: Sexp): Sexp {
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

    function parseLetrecExpr(sexp: Sexp): Sexp {
      if (
        sexp.length !== 3 || // is it the wrong # of parts?
        !(sexp[1] instanceof Array) || // is it just (letrec <not-list>)?
        !sexp[1].every(sexpIsCouple)
      ) {
        // is it a list of not-all-bindings?
        return fallback(sexp);
      }
      const bindings: Sexp = sexp[1].map(parseBinding);
      bindings.location = (sexp[1] as Sexp).location;
      return new structures.letrecExpr(bindings, parseExpr(sexp[2]), sexp);
    }

    function parseLetExpr(sexp: Sexp): Sexp {
      if (
        sexp.length !== 3 || // is it the wrong # of parts?
        !(sexp[1] instanceof Array) || // is it just (let <not-list>)?
        !sexp[1].every(sexpIsCouple)
      ) {
        // is it a list of not-all-bindings?
        return fallback(sexp);
      }
      const bindings: Sexp = sexp[1].map(parseBinding);
      bindings.location = (sexp[1] as Sexp).location;
      return new structures.letExpr(bindings, parseExpr(sexp[2]), sexp);
    }

    function parseLetStarExpr(sexp: Sexp): Sexp {
      if (
        sexp.length !== 3 || // is it the wrong # of parts?
        !(sexp[1] instanceof Array) || // is it just (let* <not-list>)?
        !sexp[1].every(sexpIsCouple)
      ) {
        // is it a list of not-all-bindings?
        return fallback(sexp);
      }
      const bindings: Sexp = sexp[1].map(parseBinding);
      bindings.location = (sexp[1] as Sexp).location;
      return new structures.letStarExpr(bindings, parseExpr(sexp[2]), sexp);
    }

    function parseIfExpr(sexp: Sexp): Sexp {
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

    function parseBeginExpr(sexp: Sexp): Sexp {
      if (sexp.length < 2) {
        return fallback(sexp);
      } // is it just (begin)?
      return new structures.beginExpr(rest(sexp).map(parseExpr), sexp[0]);
    }

    function parseAndExpr(sexp: Sexp): Sexp {
      if (sexp.length < 3) {
        return fallback(sexp);
      } // and must have 2+ arguments
      return new structures.andExpr(rest(sexp).map(parseExpr), sexp[0]);
    }

    function parseOrExpr(sexp: Sexp): Sexp {
      if (sexp.length < 3) {
        return fallback(sexp);
      } // or must have 2+ arguments
      return new structures.orExpr(rest(sexp).map(parseExpr), sexp[0]);
    }

    function parseQuotedExpr(sexp: Sexp): Sexp {
      function parseQuotedItem(sexp: Sexp): Sexp {
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
      const peek = sexp[0];
      const expr = !isSymbol(peek)
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

  function parseWhenUnlessExpr(sexp: Sexp): Sexp {
    if (sexp.length < 3) {
      return fallback(sexp);
    } // is it just (when)?
    const exprs = sexp.slice(2),
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

  function parseCondExpr(sexp: Sexp): Sexp {
    if (sexp.length === 1) {
      return fallback(sexp);
    } // is it just (cond)?

    function isElseClause(couple: Sexp): Sexp {
      return isSymbol(couple[0]) && isSymbolEqualTo(couple[0], "else");
    }

    function checkCondCouple(clause: Sexp): Sexp {
      if (
        !(clause instanceof Array) || // is it (cond ...<not-a-clause>..)?
        clause.length !== 2
      ) {
        throw "ParseError";
      }
    }

    function parseCondCouple(clause: Sexp): Sexp {
      const test = parseExpr(clause[0]),
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

    let parsedClauses: Sexp;
    try {
      // first check the couples, then parse if there's no problem
      rest(sexp).forEach(checkCondCouple);
      const numClauses = rest(sexp).length;
      parsedClauses = rest(sexp).map(parseCondCouple);
      // if we see an else and we haven't seen all other clauses first
      // throw an error that points to the next clause (rst + the one we're looking at + "cond")
      rest(sexp).forEach(function (couple: Sexp, idx: Sexp) {
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

  function parseCaseExpr(sexp: Sexp): Sexp {
    // is it the wrong # of parts?
    if (sexp.length !== 3) {
      return fallback(sexp);
    }

    function checkCaseCouple(clause: Sexp): Sexp {
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
    function isElseClause(sexp: Sexp): Sexp {
      return isSymbol(sexp[0]) && sexp[0].val === "else";
    }

    // read the first item in the clause as a quotedExpr, and parse the second
    // if it's an else clause, however, leave it alone
    function parseCaseCouple(sexp: Sexp): Sexp {
      const test = isElseClause(sexp)
          ? sexp[0]
          : new structures.quotedExpr(sexp[0]),
        result = parseExpr(sexp[1]),
        cpl = new structures.couple(test, result);
      test.isClause = true; // used to determine appropriate "else" use during desugaring
      cpl.location = sexp.location;
      return cpl;
    }

    let parsedClauses: Sexp;
    try {
      const clauses = sexp.slice(2);
      // first check the couples, then parse if there's no problem
      clauses.forEach(checkCaseCouple);
      const numClauses = clauses.length;
      parsedClauses = clauses.map(parseCaseCouple);

      // if we see an else and we haven't seen all other clauses first
      // throw an error that points to the next clause (rst + the one we're looking at + "cond")
      clauses.forEach(function (couple: Sexp, idx: Sexp) {
        if (isElseClause(couple) && idx < numClauses - 1) {
          throw "ParseError";
        }
      });
    } catch (e) {
      return fallback(sexp);
    }
    // it's good! return caseExpr
    return new structures.caseExpr(parseExpr(sexp[1]), parsedClauses, sexp[0]);
  }

  function parseBinding(sexp: Sexp): Sexp {
    if (sexpIsCouple(sexp)) {
      const binding = new structures.couple(
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

  function parseUnquoteExpr(sexp: Sexp, depth?: Sexp): Sexp {
    let result;
    if (typeof depth === "undefined" || sexp.length !== 2) {
      return fallback(sexp);
    } else if (depth === 1) {
      result = new structures.unquotedExpr(parseExpr(sexp[1]));
      result.location = (sexp[1] as Sexp).location;
      return result;
    } else if (depth > 1) {
      result = new structures.unquotedExpr(
        parseQuasiQuotedItem(sexp[1], depth - 1)
      );
      result.location = (sexp[1] as Sexp).location;
      return result;
    } else {
      throw "ASSERTION FAILURE: depth should have been undefined, or a natural number";
    }
  }

  function parseUnquoteSplicingExpr(sexp: Sexp, depth?: Sexp): Sexp {
    let result;
    if (typeof depth === "undefined" || sexp.length !== 2) {
      return fallback(sexp);
    } else if (depth === 1) {
      result = new structures.unquoteSplice(parseExpr(sexp[1]));
      result.location = (sexp[1] as Sexp).location;
      return result;
    } else if (depth > 1) {
      result = new structures.unquoteSplice(
        parseQuasiQuotedItem(sexp[1], depth - 1)
      );
      result.location = (sexp[1] as Sexp).location;
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
  function parseQuasiQuotedItem(sexp: Sexp, depth?: Sexp): Sexp {
    if (isCons(sexp) && sexp[0].val === "unquote") {
      return parseUnquoteExpr(sexp, depth);
    } else if (isCons(sexp) && sexp[0].val === "unquote-splicing") {
      return parseUnquoteSplicingExpr(sexp, depth);
    } else if (isCons(sexp) && sexp[0].val === "quasiquote") {
      return parseQuasiQuotedExpr(sexp, depth);
    } else if (isCons(sexp)) {
      const res = sexp.map(function (x: Sexp) {
        return parseQuasiQuotedItem(x, depth);
      });
      res.location = sexp.location;
      return res;
    } else if (depth === 0) {
      return parseExpr(sexp);
    } else {
      return (function () {
        const res = new structures.quotedExpr(sexp);
        res.location = sexp.location;
        return res;
      })();
    }
  }

  function parseQuasiQuotedExpr(sexp: Sexp, depth?: Sexp): Sexp {
    depth = typeof depth === "undefined" ? 0 : depth;
    if (
      sexp.length !== 2 || // quasiquote must have exactly one argument
      // if the argument is (unquote-splicing....), throw an error
      (isCons(sexp[1]) && isSymbolEqualTo(sexp[1][0], "unquote-splicing"))
    ) {
      return fallback(sexp);
    }

    const quoted = parseQuasiQuotedItem(sexp[1], depth + 1);
    quoted.location = (sexp[1] as Sexp).location;
    const result = new structures.quasiquotedExpr(quoted);
    result.location = sexp.location;
    return result;
  }

  // replace all undefineds with the last sexp, and convert to a function call
  function parseVector(sexp: Sexp): Sexp {
    function buildZero(): Sexp {
      const lit = new structures.literal(0);
      lit.location = sexp.location;
      return lit;
    }
    const unParsedVector = sexp.val,
      vals = parseStar(
        unParsedVector.elts.filter(function (e: Sexp) {
          return e !== undefined;
        })
      ),
      last = vals.length === 0 ? buildZero() : vals[vals.length - 1], // if they're all undefined, use 0
      elts = unParsedVector.elts.map(function (v: Sexp) {
        return v === undefined ? last : parseExpr(v);
      });
    const vectorFunc = new structures.symbolExpr("vector"),
      buildVector = new structures.callExpr(vectorFunc, elts);
    vectorFunc.location = buildVector.location = sexp.location;
    return buildVector;
  }

  function parseExprSingleton(sexp: Sexp): Sexp {
    const singleton = isComment(sexp)
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

  function parseIdExpr(sexp: Sexp): Sexp {
    return isSymbol(sexp) ? sexp : fallback(sexp);
  }

  function sexpIsCouple(sexp: Sexp): Sexp {
    return isCons(sexp) && sexp.length === 2;
  }

  //////////////////////////////////////// REQUIRE PARSING ////////////////////////////////
  function isRequire(sexp: Sexp): Sexp {
    return (
      isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "require")
    );
  }

  function parseRequire(sexp: Sexp): Sexp {
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
    const req = new structures.requireExpr(sexp[1], sexp[0]);
    req.location = sexp.location;
    return req;
  }

  //////////////////////////////////////// PROVIDE PARSING ////////////////////////////////
  function isProvide(sexp: Sexp): Sexp {
    return (
      isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "provide")
    );
  }

  function parseProvide(sexp: Sexp): Sexp {
    const clauses = rest(sexp).map(function (p: Sexp) {
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
    const provide = new structures.provideStatement(clauses, sexp[0]);
    provide.location = sexp.location;
    return provide;
  }

  const ast = parseStar(lex(code));
  const rootNodes = ast
    .map(parseNodeOrNull)
    .filter((item: ASTNode | null) => item !== null);
  return rootNodes;
}
