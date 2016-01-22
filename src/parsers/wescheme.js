import {
  AST,
  Expression,
  Literal,
  Struct,
  FunctionDefinition,
  Comment,
  VariableDefinition,
  Unknown,
  Blank
} from '../ast';

try {
  var lex = require('wescheme-js/src/lex').lex;
  var types = require('wescheme-js/src/runtime/types');
  var structures = require('wescheme-js/src/structures');
}  catch (e) {
  console.error('wescheme-js, which is required to use the wescheme blocks parser, does not appear to be installed.', e);
}

function expressionAria(func, argCount) {
  let aria = `${func} expression, ${argCount} argument`;
  if (argCount != 1) {
    aria += 's';
  }
  return aria;
}

function parseNode(node) {
  var from = {
    line: node.location.startRow - 1,
    ch: node.location.startCol
  };
  var to = {
    line: node.location.endRow - 1,
    ch: node.location.endCol
  };

  if (node instanceof structures.callExpr) {

    let func;
    if (node.func) {
      func = parseNode(node.func);
    } else {
      func = new Blank(
        {line: from.line, ch: from.ch+1},
        {line: from.line, ch: from.ch+1},
        '...',
        'blank',
        {'aria-label': 'blank'}
      );
    }
    return new Expression(
      from,
      to,
      func,
      node.args.map(parseNode).filter(item => item !== null),
      {'aria-label': expressionAria(node.func ? node.func.stx : 'empty', node.args.length)}
    );
  } else if (node instanceof structures.andExpr) {
    return new Expression(
      from,
      to,
      new Literal(
        //TODO: don't guess where the and symbol is, need to parse it here.
        {line:from.line, ch:from.ch+1},
        {line:from.line, ch:from.ch+4},
        "and",
        "symbol",
         {'aria-label': 'and'}
      ),
      node.exprs.map(parseNode).filter(item => item !== null),
      {'aria-label': expressionAria('and', node.exprs.length)}
    );
  } else if (node instanceof structures.orExpr) {
    return new Expression(
      from,
      to,
      new Literal(
        //TODO: don't guess where the or symbol is, need to parse it here.
        {line:from.line, ch:from.ch+1},
        {line:from.line, ch:from.ch+3},
        "or",
        "symbol",
         {'aria-label': 'or'}
      ),
      node.exprs.map(parseNode).filter(item => item !== null),
      {'aria-label': expressionAria('or', node.exprs.length)}
    );
  } else if (node instanceof structures.defVar) {
    return new VariableDefinition(
      from,
      to,
      node.name.stx,
      parseNode(node.expr)
    );
  } else if (node instanceof structures.defStruct) {
    return new Struct(
      from,
      to,
      node.name.stx,
      node.fields.map(parseNode).filter(item => item != null)
    );
  } else if (node instanceof structures.defFunc) {
    return new FunctionDefinition(
      from,
      to,
      node.name.stx,
      node.args.map(symbolNode => symbolNode.stx),
      parseNode(node.body)
    );
  } else if (node instanceof structures.symbolExpr) {
    return new Literal(from, to, node.stx, "symbol", {'aria-label':node.stx});
  } else if (node instanceof structures.literal) {
    var dataType = typeof node.val;
    let aria = node.toString();
    if (types.isString(node.val)) {
      dataType = "string";
      aria = `string ${node.val}`;
    } else if (types.isChar(node.val)) {
      dataType = "char";
      aria = `char ${node.val}`;
    } else if (node.val === types.FALSE || node.val === types.TRUE) {
      dataType = "boolean";
      aria = `${node.val}`;
    }
    return new Literal(from, to, node, dataType, {'aria-label':aria});
  } else if (node instanceof structures.comment) {
    return new Comment(from, to, node.txt);
  } else if (node instanceof structures.unsupportedExpr) {
    return new Unknown(from, to, node.val.map(parseNode).filter(item => item !== null), {msg: node.errorMsg});
  }
  console.log("!! No translator for", node);
  return null;
}

class WeschemeParser {

  get primitives() {
    return [
      '+',
      '-',
      '/',
      '*',
      'and',
      'or',
      'print-ln'
    ];
  }

  lex(code) {
    return lex(code);
  }

  parse(code) {

    function fallback(sexp){
      var elts  = (sexp instanceof Array)? parseStar(sexp) : [parseExprSingleton(sexp)];
      var guess = new structures.unsupportedExpr(elts, "Parse error");
      guess.location = sexp.location;
      return guess;
    }

    //////////////////////////////////// UTILITY FUNCTIONS //////////////////////////////
    function isVector(x)      { return types.isVector(x.val); }
    function isString(x)      { return types.isString(x.val); }
    function isSymbol(x)      { return x instanceof structures.symbolExpr; }
    function isLiteral(x)     { return x instanceof structures.literal; }
    function isUnsupported(x) { return x instanceof structures.unsupportedExpr; }
    function isComment(x)     { return x instanceof structures.comment; }

    function isCons(x) { return x instanceof Array && x.length >= 1; }
    function rest(ls) { return ls.slice(1); }

    // isSymbolEqualTo : symbolExpr symbolExpr -> Boolean
    // are these all symbols of the same value?
    function isSymbolEqualTo(x, y) {
      x = isSymbol(x) ? x.val : x;
      y = isSymbol(y) ? y.val : y;
      return x === y;
    }

    function throwError(msg){ throw msg; }


    // PARSING ///////////////////////////////////////////

    // parse* : sexp list -> Program list
    function parseStar(sexps) {
      function parseSExp(sexp) {
        return isComment(sexp) ? sexp :
              isDefinition(sexp) ? parseDefinition(sexp) :
              isExpr(sexp) ? parseExpr(sexp) :
              isRequire(sexp) ? parseRequire(sexp) :
              isProvide(sexp) ? parseProvide(sexp) :
              throwError("ASSERTION: Something was lexed that is not in the language:\n " + sexp.toString);
      }
      return sexps.map(parseSExp);
    }

    // parse : sexp list -> Program list
    function parse(sexp) {
      return (sexp.length === 0) ? [] :
        (!isCons(sexp)) ? fallback(sexp) :
        parseStar(sexp);
    }


    //////////////////////////////////////// DEFINITION PARSING ////////////////////////////////
    // (define-struct ...)
    function isStructDefinition(sexp) {
      return ((isCons(sexp)) && (isSymbol(sexp[0])) && (isSymbolEqualTo("define-struct", sexp[0])));
    }
    // (define ...)
    function isValueDefinition(sexp) {
      return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define", sexp[0]));
    }
    // (define-values ...)
    function isMultiValueDefinition(sexp) {
      return (isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo("define-values", sexp[0]));
    }
    // is it any kind of definition?
    function isDefinition(sexp) {
      return isStructDefinition(sexp) || isValueDefinition(sexp) || isMultiValueDefinition(sexp);
    }

    // : parseDefinition : SExp -> AST (definition)
    function parseDefinition(sexp) {
      function parseDefStruct(sexp) {
        if ((sexp.length !== 3)               // is it the wrong # of parts?
          || (!isSymbol(sexp[1]))             // is the structure name there?
          || (!(sexp[2] instanceof Array))    // is the structure name followed by a list?
          || !sexp[2].every(isSymbol)) {      // too many expressions?
          return fallback(sexp);
        }
        return new structures.defStruct(parseIdExpr(sexp[1]), sexp[2].map(parseIdExpr), sexp);
      }

      function parseMultiDef(sexp) {
        if ((sexp.length !== 3)               // is it the wrong # of parts?
          || !(sexp[1] instanceof Array)) {   // is it (define-values <not a list> )?
          return fallback(sexp);
        }
        return new structures.defVars(sexp[1].map(parseIdExpr), parseExpr(sexp[2]), sexp);
      }

      function parseDef(sexp) {
        if (sexp.length < 2) { return fallback(sexp); } // is it just (define)?
        // If it's (define (...)...)
        if (sexp[1] instanceof Array) {
          if ((sexp[1].length === 0)          // is there at least one element?
            || (!isSymbol(sexp[1][0]))        // is the first element in the list a symbol?
            || (!sexp[1].every(isSymbol))     // is the next element a list of not-all-symbols?
            || (sexp.length !== 3)) {         // is it the wrong # of parts?
            return fallback(sexp);
          }
          var args = rest(sexp[1]).map(parseIdExpr);
          args.location = sexp[1].location;
          return new structures.defFunc(parseIdExpr(sexp[1][0]), args, parseExpr(sexp[2]), sexp);
        }
        // If it's (define x ...)
        if (isSymbol(sexp[1])) {
          if ((sexp.length !== 3)) {           // is it the wrong # of parts?
            return fallback(sexp);
          }
          return new structures.defVar(parseIdExpr(sexp[1]), parseExpr(sexp[2]), sexp);
        }
        // if it's neither form of define...
        return fallback(sexp);
      }
      var def = isStructDefinition(sexp) ? parseDefStruct(sexp) :
        isValueDefinition(sexp) ? parseDef(sexp) :
        isMultiValueDefinition ? parseMultiDef(sexp) :
        fallback(sexp);
      def.location = sexp.location;
      return def;
    }


    //////////////////////////////////////// EXPRESSION PARSING ////////////////////////////////
    function isExpr(sexp) {
      return ((!(isDefinition(sexp))) && (!(isRequire(sexp))) && (!(isProvide(sexp))));
    }

    function parseExpr(sexp) {
      return isCons(sexp) ? parseExprList(sexp) :
        parseExprSingleton(sexp);
    }

    // parseExprList : SExp -> AST
    // predicates and parsers for call, lambda, local, letrec, let, let*, if, and, or, quote and quasiquote exprs
    function parseExprList(sexp) {
      function parseFuncCall(sexp) {
        if (isSymbolEqualTo(sexp[0], "unquote")             // improper unquote
          || isSymbolEqualTo(sexp[0], "unquote-splicing")   // improper unquote-splicing
          || isSymbolEqualTo(sexp[0], "else")) {            // improper else
          return fallback(sexp);
        }
        return isCons(sexp) ? new structures.callExpr(parseExpr(sexp[0]), rest(sexp).map(parseExpr), sexp[0]) : fallback(sexp);
      }

      function parseLambdaExpr(sexp) {
        if ((sexp.length !== 3)                   // is it the wrong # of parts?
            || !(sexp[1] instanceof Array)        // is it just (lambda <not-list>)?
            || !sexp[1].every(isSymbol)){         // is it a list of not-all-symbols?
          return fallback(sexp);
        }
        var args = sexp[1].map(parseIdExpr);
        args.location = sexp[1].location;
        return new structures.lambdaExpr(args, parseExpr(sexp[2]), sexp[0]);
      }

      function parseLocalExpr(sexp) {
        if ((sexp.length !== 3)                   // is it the wrong # of parts?
          || !(sexp[1] instanceof Array)          // is it just (local <not-list>)?
          || !sexp[1].every(isDefinition)) {      // is it a list of not-all-definitions?
          return fallback(sexp);
        }
        return new structures.localExpr(sexp[1].map(parseDefinition), parseExpr(sexp[2]), sexp[0]);
      }

      function parseLetrecExpr(sexp) {
        if ((sexp.length !== 3)                   // is it the wrong # of parts?
          || !(sexp[1] instanceof Array)          // is it just (letrec <not-list>)?
          || !sexp[1].every(sexpIsCouple)) {      // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        return new structures.letrecExpr(sexp[1].map(parseBinding), parseExpr(sexp[2]), sexp[0]);
      }

      function parseLetExpr(sexp) {
        if ((sexp.length !== 3)                   // is it the wrong # of parts?
          || !(sexp[1] instanceof Array)          // is it just (let <not-list>)?
          || !sexp[1].every(sexpIsCouple)) {      // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        return new structures.letExpr(sexp[1].map(parseBinding), parseExpr(sexp[2]), sexp);
      }

      function parseLetStarExpr(sexp) {
        if ((sexp.length !== 3)                   // is it the wrong # of parts?
          || !(sexp[1] instanceof Array)          // is it just (let* <not-list>)?
          || !sexp[1].every(sexpIsCouple)) {      // is it a list of not-all-bindings?
          return fallback(sexp);
        }
        var bindings = sexp[1].map(parseBinding);
        bindings.location = sexp[1].location;
        return new structures.letStarExpr(bindings, parseExpr(sexp[2]), sexp[0]);
      }

      function parseIfExpr(sexp) {
        if (sexp.length !== 4) { return fallback(sexp); } // Does it have the wrong # of parts?
        return new structures.ifExpr(parseExpr(sexp[1]), parseExpr(sexp[2]), parseExpr(sexp[3]), sexp[0]);
      }

      function parseBeginExpr(sexp) {
        if (sexp.length < 2) { return fallback(sexp); } // is it just (begin)?
        return new structures.beginExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseAndExpr(sexp) {
        if (sexp.length < 3) { return fallback(sexp); } // and must have 2+ arguments
        return new structures.andExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseOrExpr(sexp) {
        if (sexp.length < 3) { return fallback(sexp); } // or must have 2+ arguments
        return new structures.orExpr(rest(sexp).map(parseExpr), sexp[0]);
      }

      function parseQuotedExpr(sexp) {

        function parseQuotedItem(sexp) {
          return isCons(sexp) ? sexp.map(parseQuotedItem) : (sexp instanceof Array && sexp.length === 0) ? sexp // the empty list is allowed inside quotes
            : /* else */ parseExprSingleton(sexp);
        }
        // quote must have exactly one argument
        if (sexp.length !== 2) { return fallback(sexp); }
        return new structures.quotedExpr(parseQuotedItem(sexp[1]));
      }

      return (function() {
        var peek = sexp[0];
        var expr = !(isSymbol(peek)) ? parseFuncCall(sexp) :
          isSymbolEqualTo("λ", peek) ? parseLambdaExpr(sexp) :
          isSymbolEqualTo("lambda", peek) ? parseLambdaExpr(sexp) :
          isSymbolEqualTo("local", peek) ? parseLocalExpr(sexp) :
          isSymbolEqualTo("letrec", peek) ? parseLetrecExpr(sexp) :
          isSymbolEqualTo("let", peek) ? parseLetExpr(sexp) :
          isSymbolEqualTo("let*", peek) ? parseLetStarExpr(sexp) :
          isSymbolEqualTo("cond", peek) ? parseCondExpr(sexp) :
          isSymbolEqualTo("case", peek) ? parseCaseExpr(sexp) :
          isSymbolEqualTo("if", peek) ? parseIfExpr(sexp) :
          isSymbolEqualTo("begin", peek) ? parseBeginExpr(sexp) :
          isSymbolEqualTo("and", peek) ? parseAndExpr(sexp) :
          isSymbolEqualTo("or", peek) ? parseOrExpr(sexp) :
          isSymbolEqualTo("when", peek) ? parseWhenUnlessExpr(sexp) :
          isSymbolEqualTo("unless", peek) ? parseWhenUnlessExpr(sexp) :
          isSymbolEqualTo("quote", peek) ? parseQuotedExpr(sexp) :
          isSymbolEqualTo("quasiquote", peek) ? parseQuasiQuotedExpr(sexp) :
          isSymbolEqualTo("unquote", peek) ? parseUnquoteExpr(sexp) :
          isSymbolEqualTo("unquote-splicing", peek) ? parseUnquoteSplicingExpr(sexp) :
          parseFuncCall(sexp);
        expr.location = sexp.location;
        return expr;
      })();
    }

    function parseWhenUnlessExpr(sexp) {
      if (sexp.length < 3) { return fallback(sexp); }  // is it just (when)?
      var exprs = sexp.slice(2),
        result = new structures.whenUnlessExpr(parseExpr(sexp[1]), parse(exprs), sexp[0]);
      exprs.location = exprs[0].location; // FIXME: merge the locations
      result.location = sexp.location;
      return result;
    }

    function parseCondExpr(sexp) {
      if (sexp.length === 1) { return fallback(sexp); } // is it just (cond)?

      function isElseClause(couple) {
        return isSymbol(couple[0]) && isSymbolEqualTo(couple[0], "else");
      }

      function checkCondCouple(clause) {
        if (!(clause instanceof Array)  // is it (cond ...<not-a-clause>..)?
            || (clause.length !== 2)) { throw "ParseError"; }
      }


      function parseCondCouple(clause) {
        var test = parseExpr(clause[0]),
          result = parseExpr(clause[1]),
          cpl = new structures.couple(test, result);
        // the only un-parenthesized keyword allowed in the first slot is 'else'
        if ((structures.keywords.indexOf(test.val) > -1) && (test.val !== "else")) { throw "ParseError"; }
        test.isClause = true; // used to determine appropriate "else" use during desugaring
        cpl.location = clause.location;
        return cpl;
      }

      try {
        // first check the couples, then parse if there's no problem
        rest(sexp).forEach(checkCondCouple);
        var numClauses = rest(sexp).length, parsedClauses = rest(sexp).map(parseCondCouple);
        // if we see an else and we haven't seen all other clauses first
        // throw an error that points to the next clause (rst + the one we're looking at + "cond")
        rest(sexp).forEach(function(couple, idx) {
          if (isElseClause(couple) && (idx < (numClauses - 1))) { throw "ParseError"; }
        });
      } catch (e) {
        return fallback(sexp);
      }
      // return condExpr
      return new structures.condExpr(parsedClauses, sexp[0]);
    }

    function parseCaseExpr(sexp) {
      // is it the wrong # of parts?
      if (sexp.length !== 3) { return fallback(sexp); }

      function checkCaseCouple(clause) {
        if (!(clause instanceof Array)
            || (clause.length !== 2)
            || !((clause[0] instanceof Array)
               || (isSymbol(clause[0]) && isSymbolEqualTo(clause[0], "else")))) {
          throw "ParseError";
        }
      }

      // is this sexp actually an else clause?
      function isElseClause(sexp) {
        return isSymbol(sexp[0]) && (sexp[0].val === "else");
      }

      // read the first item in the clause as a quotedExpr, and parse the second
      // if it's an else clause, however, leave it alone
      function parseCaseCouple(sexp) {
        var test = isElseClause(sexp) ? sexp[0] : new structures.quotedExpr(sexp[0]),
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
        clauses.forEach(function(couple, idx) {
          if (isElseClause(couple) && (idx < (numClauses - 1))) { throw "ParseError"; }
        });
      } catch (e) {
        return fallback(sexp);
      }
      // it's good! return caseExpr
      return new structures.caseExpr(parseExpr(sexp[1]), parsedClauses, sexp[0]);
    }

    function parseBinding(sexp) {
      if (sexpIsCouple(sexp)) {
        var binding = new structures.couple(parseIdExpr(sexp[0]), parseExpr(sexp[1]));
        binding.location = sexp.location;
        binding.stx = sexp;
        return binding;
      } else { return fallback(sexp); }
    }

    function parseUnquoteExpr(sexp, depth) {
      var result;
      if ((typeof depth === 'undefined')
        || (sexp.length !== 2)){
        return fallback(sexp);
      } else if (depth === 1) {
        result = new structures.unquotedExpr(parseExpr(sexp[1]));
        result.location = sexp[1].location;
        return result;
      } else if (depth > 1) {
        result = new structures.unquotedExpr(parseQuasiQuotedItem(sexp[1], depth - 1));
        result.location = sexp[1].location;
        return result;
      } else {
        throw "ASSERTION FAILURE: depth should have been undefined, or a natural number";
      }
    }

    function parseUnquoteSplicingExpr(sexp, depth) {
      var result;
      if ((typeof depth === 'undefined')
        || (sexp.length !== 2)) {
        return fallback(sexp);
      } else if (depth === 1) {
        result = new structures.unquoteSplice(parseExpr(sexp[1]));
        result.location = sexp[1].location;
        return result;
      } else if (depth > 1) {
        result = new structures.unquoteSplice(parseQuasiQuotedItem(sexp[1], depth - 1));
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
      if (isCons(sexp) && sexp[0].val === 'unquote') {
        return parseUnquoteExpr(sexp, depth);
      } else if (isCons(sexp) && sexp[0].val === 'unquote-splicing') {
        return parseUnquoteSplicingExpr(sexp, depth);
      } else if (isCons(sexp) && sexp[0].val === 'quasiquote') {
        return parseQuasiQuotedExpr(sexp, depth);
      } else if (isCons(sexp)) {
        var res = sexp.map(function(x) {
          return parseQuasiQuotedItem(x, depth);
        });
        res.location = sexp.location;
        return res;
      } else if (depth === 0) {
        return parseExpr(sexp);
      } else {
        return (function() {
          var res = new structures.quotedExpr(sexp);
          res.location = sexp.location;
          return res;
        })();
      }

    }

    function parseQuasiQuotedExpr(sexp, depth) {
      depth = (typeof depth === 'undefined') ? 0 : depth;
      if ((sexp.length !== 2)  // quasiquote must have exactly one argument
       // if the argument is (unquote-splicing....), throw an error
       || (isCons(sexp[1]) && isSymbolEqualTo(sexp[1][0], "unquote-splicing"))) {
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
        vals = parseStar(unParsedVector.elts.filter(function(e) {
          return e !== undefined;
        })),
        last = (vals.length === 0) ? buildZero() : vals[vals.length - 1], // if they're all undefined, use 0
        elts = unParsedVector.elts.map(function(v) {
          return (v === undefined) ? last : parseExpr(v);
        });
      var vectorFunc = new structures.symbolExpr("vector"),
        buildVector = new structures.callExpr(vectorFunc, elts);
      vectorFunc.location = buildVector.location = sexp.location;
      return buildVector;
    }

    function parseExprSingleton(sexp) {
      var singleton = isComment(sexp) ? sexp :
                      isUnsupported(sexp) ? sexp :
                      isVector(sexp) ? parseVector(sexp) :
                      isSymbol(sexp) ? sexp :
                      isLiteral(sexp) ? sexp :
                      isSymbolEqualTo("quote", sexp) ? new structures.quotedExpr(sexp) :
                      isSymbolEqualTo("empty", sexp) ? new structures.callExpr(new structures.symbolExpr("list"), []) :
                      new structures.callExpr(null, []);
      singleton.location = sexp.location;
      return singleton;
    }

    function parseIdExpr(sexp) {
      return isSymbol(sexp) ? sexp : fallback(sexp);
    }

    function sexpIsCouple(sexp) { return ((isCons(sexp)) && ((sexp.length === 2))); }

    //////////////////////////////////////// REQUIRE PARSING ////////////////////////////////
    function isRequire(sexp) {
      return isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "require");
    }

    function parseRequire(sexp) {
      if (sexp.length < 2) { return fallback(sexp); }  // is it (require)?
      if ((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "lib")) {
        if ((sexp[1].length < 3)                // is it (require (lib)) or (require (lib <string>))
          || !rest(sexp[1]).every(isString)) {  // is it (require (lib not-strings))?
          return fallback(sexp);
        }
      } else if (((sexp[1] instanceof Array) && isSymbolEqualTo(sexp[1][0], "planet"))
               || (!(isSymbol(sexp[1]) || isString(sexp[1])))) {
        return fallback(sexp); // if it's (require (planet...))
      }
      var req = new structures.requireExpr(sexp[1], sexp[0]);
      req.location = sexp.location;
      return req;
    }

    //////////////////////////////////////// PROVIDE PARSING ////////////////////////////////
    function isProvide(sexp) {
      return isCons(sexp) && isSymbol(sexp[0]) && isSymbolEqualTo(sexp[0], "provide");
    }

    function parseProvide(sexp) {
      var clauses = rest(sexp).map(function(p) {
        // symbols are ok
        if (isSymbol(p)) { return p; }
        // (struct-out sym) is ok
        if ((p instanceof Array) && (p.length == 2) && isSymbol(p[0]) && isSymbolEqualTo(p[0], "struct-out") && isSymbol(p[1])) {
          return p;
        }
        // everything else is NOT okay
        return fallback(sexp);
      });
      var provide = new structures.provideStatement(clauses, sexp[0]);
      provide.location = sexp.location;
      return provide;
    }

    var ast = parseStar(lex(code));
    var rootNodes = ast.map(parseNode).filter(item => item !== null);
    return new AST(rootNodes);
  }

  getExceptionMessage(e){
    let msg = JSON.parse(e)['dom-message'][2].slice(2);
    return (msg.every((element) => typeof element==="string"))? msg
            : (msg[0] instanceof Array)? msg[0][2].substring(msg[0][2].indexOf("read: ")+6)
            : "Check your quotation marks, or any other symbols you've used";
  }
}

if (lex) {
  module.exports = WeschemeParser;
} else {
  module.exports = function() {
    throw new Error('wescheme-js must be installed to use the wescheme blocks parser');
  };
}
