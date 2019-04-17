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
  Assign,
  Bind,
  Block,
  Bracket,
  Check,
  CheckTest,
  Construct,
  Func,
  FunctionApp,
  IfPipe,
  IfPipeBranch,
  Lambda,
  Let,
  LoadTable,
  Paren,
  Tuple,
  TupleGet,
  Var,
} from "./ast";

interface Position {
  line: number;
  ch: number;
}

class Loc {
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
  "+":   "+",
  "-":   "-",
  "*":   "*",
  "/":   "/",
  "$":   "$",
  "^":   "^",
  "<":   "<",
  "<=":  "<=",
  ">":   ">",
  ">=":  ">=",
  "==":  "==",
  "=~":  "=~",
  "<=>": "<=>",
  "<>":  "<>",
  "and": "and",
  "or":  "or",
  // TODO: check ops
  "is": (loc, _node) => new Literal(loc.from, loc.to, 'is', 'check-op'),
};

type AField = any;
type Ann = String;
type CasesBind = any;
type CasesBindType = any;
type CasesBranch = any;
type CheckOp = any;
type ColumnBinds = any;
type ColumnSort = any;
type ColumnSortOrder = any;
type DefinedType = any;
type DefinedValue = any;
type Expr = ASTNode;
type FieldName = any;
type ForBind = any;
type Hint = any;
type IfBranch = any;
type ImportType = Number;
type LetBind = any;
type LetrecBind = any;
type Member = any;
type Name = String;
type ProvidedAlias = any;
type ProvidedDatatype = any;
type ProvidedValue = any;
type TableExtendField = any;
type TableRow = any;
type TypeLetBind = any;
type Variant = any;
type VariantMember = any;
type VariantMemberType = any;


const nodeTypes = {
  // data Name
  // 's-underscore': function(l: Loc) {},
  "s-name": function (pos: Loc, str: string) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol',
      {'aria-label': `${str}, a name`});
  },
  // 's-global': function(s: string) {},
  // 's-type-global': function(s: string) {},
  // 's-atom': function(base: string, serial: number) {},

  // data Program
  "s-program": function(_pos: Loc, _prov: any, _provTy: any, _impt: any, body: Block) {
    let rootNodes = body.stmts;
    return new AST(rootNodes);
  },

  // data Import
  // "s-include": function(pos: Loc, mod: ImportType) {},
  // "s-import": function(pos: Loc, file: ImportType, name: Name) {},
  // "s-import-types": function(pos: Loc, file: ImportType, name: Name, types: Name) {},
  // "s-import-fields": function(pos: Loc, fields: Name[], file: ImportType) {},
  // "s-import-complete": function(pos: Loc, values: Name[], types: Name[], import_type: ImportType, vals_name: Name, types_name: Name) {},

  // data ProvidedValue
  // "p-value": function(pos: Loc, v: Name, ann: Ann) {},

  // data Provided Alias
  // "p-alias": function(pos: Loc, in_name: Name, out_name: Name, mod: ImportType | null) {},

  // data ProvidedDatatype
  // "p-data": function(pos: Loc, d: Name, mod: ImportType | null) {},

  // data Provide
  // "s-provide": function(pos: Loc, block: ASTNode) {},
  // "s-provide-complete": function(pos: Loc, values: ProvidedValue[], ailases: ProvidedAlias[], data_definition: ProvidedDatatype[]) {},
  // "s-provide-all": function(pos: Loc) {},
  "s-provide-none": function(_pos: Loc) { return null; },

  // data ProvideTypes
  // "s-provide-types": function(pos: Loc, ann: AField[]) {},
  // "s-provide-types-all": function(l: Loc) {},
  "s-provide-types-none": function(_l: Loc) { return null; },

  // data ImportType
  // "s-const-import": function(l: Loc, mod: string) {},
  // "s-special-import": function(l: Loc, kind: string, args: string[]) {},

  // data Hint
  // "h-use-loc": function(l: Loc) {},

  // data LetBind
  // "s-let-bind": function(l: Loc, b: Bind, value: Expr) {},
  // "s-var-bind": function(l: Loc, b: Bind, value: Expr) {},

  // data LetrecBind
  // "s-letrec-bind": function(l: Loc, b: Bind, value: Expr) {},

  // data TypeLetBind
  // "s-type-bind": function(l: Loc, name: Name, params: Name[], ann: Ann) {},
  // "s-newtype-bind": function(l: Loc, name: Name, namet: Name) {},

  // data DefinedValue
  // "s-defined-value": function(name: string, value: Expr) {},

  // data DefinedType
  // "s-defined-type": function(name: string, typ: Ann) {},

  // data Expr
  // "s-module": function(l: Loc, answer: XPathExpression, defined_values: DefinedValue[], defined_types: DefinedType[], provided_values: Expr, provided_types: AField[], checks: Expr) {},
  // "s-template": function(l: Loc) {},
  // "s-type-let-expr": function(l: Loc, binds: TypeLetBind[], body: Expr, block: boolean) {},
  // "s-let-expr": function(l: LoadTable, binds: LetBind[], body: Expr, block: boolean) {},
  // "s-letrec": function(l: Loc, binds: LetrecBind[], body: Expr, block: boolean) {},
  // "s-hint-exp": function(l: Loc, hints: Hint[], exp: Expr) {},
  // "s-instantiate": function(l: Loc, expr: Expr, params: Ann[]) {},
  "s-block": function (pos: Loc, stmts: Expr[]) {
    return new Block(
      pos.from,
      pos.to,
      stmts,
      'block');
  },
  // "s-user-block": function(l: Loc, body: Expr) {},
  "s-fun": function (pos: Loc, name: string, _params: Name[], args: Bind[], ann: Ann, doc: string, body: Expr, _check_loc: Loc | null, _check: Expr | null, block: boolean) {
    // TODO: ignoring params, check, blocky
    let fun_from = {line: pos.from.line, ch: pos.from.ch + 4};
    let fun_to = {line: pos.from.line, ch: fun_from.ch + name.length};
    console.log(arguments);
    return new Func(
      pos.from,
      pos.to,
      new Literal(fun_from, fun_to, name, 'function'),
      args.map(a => idToLiteral(a)),
      ann,
      doc,
      body,
      block,
      {'aria-label': `${name}, a function with ${args} with ${body}`});
  },
  // "s-type": function(l: Loc, name: Name, params: Name[], ann: Ann) {},
  // "s-newtype": function(l: Loc, name: Name, namet: Name) {},
  // "s-var": function(l: Loc, name: Bind, value: Expr) {},
  // "s-rec": function(l: Loc, name: Bind, value: Expr) {},
  "s-let": function (pos: Loc, id: Bind, rhs: Expr, _keyword_val: boolean) {
    console.log(arguments);
    let options = {};
    options['aria-label'] = `${id} set to ${rhs}`;
    return new Let(
      pos.from,
      pos.to,
      idToLiteral(id),
      rhs,
      options
    );
  },
  // "s-ref": function(l: Loc, ann: Ann | null) {},
  // "s-contract": function(l: Loc, name: Name, ann: Ann) {},
  // "s-when": function(l: Loc, test: Expr, block: Expr, blocky: boolean) {},
  // "s-assign": function(l: Loc, id: Name, value: Expr) {},
  's-if-pipe': function(pos: Loc, branches: IfPipeBranch[], blocky: boolean) {
    return new IfPipe(pos.from, pos.to, branches, blocky, {'aria-label': 'if pipe'});
  },
  // "s-if-pipe-else": function(l: Loc, branches: IfPipeBranch[], _else: Expr, blocky: boolean) {},
  // "s-if": function(l: Loc, branches: IfBranch[], blocky: boolean) {},
  // "s-if-else": function(l: Loc, branches: IfBranch[], _else: Expr, blocky: boolean) {},
  // "s-cases": function(l: Loc, typ: Ann, val: Expr, branches: CasesBranch[], blocky: boolean) {},
  // "s-cases-else": function(l: Loc, typ: Ann, val: Expr, branches: CasesBranch[], _else: Expr, blocky: boolean) {},
  "s-op": function (pos: Loc, opPos: Loc, op: string, left: Expr, right: Expr) {
    console.log(arguments);
    return new Binop(
      pos.from,
      pos.to,
      new Literal(opPos.from, opPos.to, op, 'operator'),
      left,
      right,
      {'aria-label': `${left} ${name} ${right}`});
  },
  "s-check-test": function(pos: Loc, check_op: CheckOp, refinement: Expr | null, lhs: Expr, rhs: Expr | null) {
    console.log(arguments);
    return new CheckTest(
      pos.from, pos.to, check_op, refinement, lhs, rhs, {'aria-label': `${check_op} ${lhs} ${rhs}`}
    );
  },
  // "s-check-expr": function(l: Loc, expr: Expr, ann: Ann) {},
  's-paren': function(pos: Loc, expr: ASTNode) {
    return new Paren(pos.from, pos.to, expr, {'aria-label': 'parentheses'});
  },
  // note this name string is "" if anonymous
  "s-lam": function(l: Loc, name: string, _params: Name[], args: Bind[], ann: Ann, doc: string, body: Expr, _check_loc: Loc | null, _check: Expr | null, blocky: boolean) {
    console.log(arguments);
    let fun_from = { line: l.from.line, ch: l.from.ch + 4 };
    let fun_to = {line: l.from.line, ch: fun_from.ch + name.length};
    let real_name = (name == "")? null : new Literal(fun_from, fun_to, name, 'lambda');
    return new Lambda(
      l.from,
      l.to,
      real_name,
      args.map(a => idToLiteral(a)),
      ann,
      doc,
      body,
      blocky,
      {'aria-label': `${name}, a function with ${args} with ${body}`});
  },
  // "s-method": function(l: Loc, name: string, params: Name[], args: Bind[], ann: Ann, doc: string, body: Expr, check: Expr | null, blocky: boolean) {},
  // "s-extend": function(l: Loc, supe: Expr, fields: Member[]) {},
  // "s-update": function(l: Loc, supe: Expr, fields: Member[]) {},
  "s-tuple": function(pos: Loc, fields: Expr[]) {
    console.log(arguments);
    return new Tuple(
      pos.from, pos.to, fields, {'aria-label': `tuple with ${fields}`}, 
    );
  },
  "s-tuple-get": function(pos: Loc, lhs: ASTNode, index: number, index_pos: Loc) {
    console.log(arguments);
    return new TupleGet(
      pos.from, pos.to, lhs, new Literal(index_pos.from, index_pos.to, index, "number"), {'aria-label': `${index} element of ${lhs} tuple`}
    )
  },
  // "s-obj": function(l: Loc, fields: Member[]) {},
  // "s-array": function(l: Loc, values: Expr[]) {},
  "s-construct": function (pos: Loc, modifier: any, constructor: any, values: any[]) {
    console.log(arguments);
    return new Construct(
      pos.from, pos.to, modifier, constructor, values, { 'aria-label': `${constructor} with values ${values}` }
    );
  },
  "s-app": function(pos: Loc, fun: Expr, args: Expr[]) {
    console.log(arguments);
    return new FunctionApp(
      pos.from, pos.to, fun, args, {'aria-label': `${fun} applied to ${args}`}, 
    );
  },
  // "s-prim-app": function(pos: Loc, fun: string, args: Expr[]) {},
  // "s-prim-val": function(pos: Loc, name: string) {},
  "s-id": function(pos: Loc, str: Name) {
    return new Literal(
      pos.from,
      pos.to,
      str,
      'symbol',
      {'aria-label': `${str}, an identifier`});
  },
  "s-id-var": function(pos: Loc, str: Name) {
    // TODO make sure this is correct
    return new Literal(
      pos.from,
      pos.to,
      "!" + str,
      'symbol',
      {'aria-label': `${str}, an identifier`});
  },
  // "s-id-letrec": function(pos: Loc, id: Name, safe: boolean) {},
  // "s-undefined": function(pos: Loc) {},
  // "s-srcloc": function(pos: Loc, loc: Loc) {},
  "s-num": function(pos: Loc, x: Number) {
    return new Literal(
      pos.from,
      pos.to,
      x,
      'number',
      {'aria-label': `${x}, a number`});
  },
  // "s-frac": function(l: Loc, num: number, den: number) {},
  "s-bool": function(pos: Loc, value: boolean) {
    let ret = new Literal(
      pos.from,
      pos.to,
      value,
      'boolean',
      {'aria-label': `${value}, a boolean`});
    console.log(ret);
    return ret;
  },
  "s-str": function(pos: Loc, value: string) {
    console.log(arguments);
    return new Literal(
      pos.from,
      pos.to,
      "\"" + value + "\"",
      'string',
      {'aria-label': `${value}, a string`}
    );
  },
  's-dot': function(pos: Loc, base: any, method: string) {
    console.log(arguments);
    return new Literal(
      pos.from, pos.to, base.toString() + "." + method, 'method', {'aria-label': `${method} on data ${base}`}
    )
  },
  's-get-bang': function (pos: Loc, obj: Expr, field: string) {
    // TODO make sure correct
    console.log(arguments);
    return new Literal(
      pos.from, pos.to, obj.toString() + "." + field, 'method', {'aria-label': `${field} on data ${obj}`}
    )
  },
  's-bracket': function(pos: Loc, base: any, index: any) {
    console.log(arguments);
    return new Bracket(
      pos.from, pos.to, base, index, {'aria-label': `${index} of ${base}`}
    )
  },
  // "s-data": function(l: Loc, name: string, params: Name[], mixins: Expr[], variants: Variant[], shared_members: Member[], check: Expr | null) {},
  // "s-data-expr": function(l: Loc, name: string, namet: Name, params: Name[], mixins: Expr[], variants: Variant[], shared_members: Member[], check: Expr | null) {},
  // 's-for': function(l: Loc, iterator: Expr, bindings: ForBind[], ann: Ann, body: Expr, blocky: boolean) {},
  "s-check": function(pos: Loc, name: string | undefined, body: any, keyword_check: boolean) {
    return new Check(
      pos.from, pos.to, name, body, keyword_check, { 'aria-label': ((name != undefined)? `${name} `: "") + `checking ${body}`}
    );
  },
  // 's-reactor': function(l: Loc, fields: Member[]) {},
  // 's-table-extend': function(l: LoadTable, column_binds: ColumnBinds, extensions: TableExtendField[]) {},
  // 's-table-update': function(l: Loc, column_binds: ColumnBinds, updates: Member[]) {},
  // 's-table-select': function(l: Loc, columns: Name[], table: Expr) {},
  // 's-table-order': function(l: Loc, table: Expr, ordering: ColumnSort) {},
  // 's-table-filter': function(l: Loc, column_binds: ColumnBinds, predicate: Expr) {},
  // 's-table-extract': function(l: Loc, column: Name, table: Expr) {},
  // 's-table': function(l: Loc, headers: FieldName[], rows: TableRow[]) {},
  's-load-table': function (pos: Loc, rows: any[], sources: any[]) {
    console.log(arguments);
    return new LoadTable(
      pos.from, pos.to, rows, sources, {'aria-label': `${rows} of table from ${sources}`}
    );
  },

  // data TableRow
  // 's-table-row': function(l: Loc, elems: Expr[]) {},
  
  // data ConstructModifer
  's-construct-normal': function() { return null; },
  // 's-construct-lazy': function() { return null; },

  // data Bind
  "s-bind": function (pos: Loc, _shadows: boolean, id: Name, ann: Ann) {
    // TODO: ignoring shadowing for now.
    return new Bind(
      pos.from,
      pos.to,
      id,
      ann);
  },
  // 's-tuple-bind': function(l: LoadTable, fields: Bind[], as_name: Bind | null) {},

  // data Member
  // 's-data-field': function(l: Loc, name: string, value: Expr) {},
  // 's-mutable-field': function(l: Loc, name: string, ann: Ann, value: Expr) {},
  // 's-method-field': function(l: Loc, name: string, params: Name[], args: Bind[], ann: Ann, doc: string, body: Expr, check: Expr | null, blocky: boolean) {},

  // data FieldName
  // examples of this _other have been ABlank...
  's-field-name': function(pos: Loc, name: string, _other: any) {
    console.log(arguments);
    return new Literal(
      pos.from, pos.to, name, 'field-name', {'aria-label': `${name} field`}
    );
  },
  
  // data ForBind
  // 's-for-bind': function(l: Loc, bind: Bind, value: Expr) {},

  // data ColumnBinds
  // 's-column-binds': function(l: Loc, binds: Bind[], table: Expr) {},

  /**
   * Not sure what to do with this for now...
   * data ColumnSortOrder:
  | ASCENDING with:
    method tosource(self):
      PP.str("ascending")
    end
  | DESCENDING with:
    method tosource(self):
      PP.str("descending")
    end
sharing:
  method visit(self, visitor):
    self._match(visitor, lam(): raise("No visitor field for " + torepr(self)) end)
  end
end
   */
  
  // data ColumnSort
  // 's-column-sort': function(l: LoadTable, column: Name, direction: ColumnSortOrder) {},

  // data TableExtendField
  // 's-table-extend-field': function(l: Loc, name: string, value: Expr, ann: Ann) {},
  // 's-table-extend-reducer': function(l: Loc, name: string, reducer: Expr, col: Name, ann: Ann) {},

  // data LoadTableSpec
  // 's-sanitize': function(l: Loc, name: Name, sanitizer: Expr) {},
  's-table-src': function (pos: Loc, source: any) {
    console.log(arguments);
    return new Literal(
      pos.from, pos.to, source, 'table-source', {'aria-label': `${source}, a table source`}
    )
  },

  // not doing data VariantMemberType

  // data VariantMember
  // 's-variant-member': function(l: Loc, member_type: VariantMemberType, bind: Bind) {},

  // data Variant
  // 's-variant': function(l: Loc, constr_loc: Loc, name: string, members: VariantMember[], with_members: Member[]) {},
  // 's-singleton-variant': function(l: Loc, name: string, with_members: Member[]) {},

  //data IfBranch
  // 's-if-branch': function(l: Loc, test: Expr, body: Expr) {},

  //data IfPipeBranch
  's-if-pipe-branch': function(pos: Loc, test: ASTNode, body: ASTNode) {
    return new IfPipeBranch(pos.from, pos.to, test, body, {'aria-label': `${test} testing with result ${body} branch`});
  },
  
  // data CasesBind
  // 's-cases-bind': function(l: Loc, field_type: CasesBindType, bind: Bind) {},

  // data CasesBranch
  // 's-cases-branch': function(l: Loc, pattern_loc: Loc, name: string, args: CasesBind[], body: Expr) {},
  // 's-singleton-cases-branch': function(l: LoadTable, pattern_loc: Loc, name: string, body: Expr) {},

  // data CheckOp --> not doing for now?

  // data Ann
  "a-blank": function() {
    return null;
  },
  // 'a-any': function(l: Loc) {},
  "a-name": function(pos: Loc, id: Name) {
    return new Literal(
      pos.from,
      pos.to,
      id,
      'symbol',
      // make sure that this matches the pedagogy used in classroom:
      // "variable", "identifier", "name", ...; other languages
      {'aria-label': `${id}, an identifier`});
  },
  // 'a-type-var': function(l: Loc, id: Name) {},
  // 'a-arrow': function(l: Loc, args: Ann[], ret: Ann, use_parens: boolean) {},
  // 'a-method': function(l: Let, args: Ann[], ret: Ann) {},
  // 'a-record': function(l: Loc, fields: AField[]) {},
  // 'a-tuple': function(l: Loc, fields: AField[]) {},
  // 'a-app': function(l: Loc, ann: Ann, args: Ann[]) {},
  // 'a-pred': function(l: Loc, ann: Ann, exp: Expr) {},
  // 'a-dot': function(l: Loc, obj: Name, field: string) {},
  // 'a-checked': function(checked: Ann, residual: Ann) {},

  // data AField
  // 'a-field': function(l: Loc, name: string, ann: Ann) {},
}

function idToLiteral(id: Bind): Literal {
  let name = id.ident.value;
  return new Literal(
    (id as ASTNode).from, (id as ASTNode).to, (id.ann != null)? name + " :: " + id.ann : name, {'aria-label': name}
  )
}

function makeNode(nodeType: string) {
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
  return new Loc(startOf(srcloc), endOf(srcloc));
}

function combineSrcloc(_fileName: any, startPos: any, endPos: any) {
  return new Loc(startOf(startPos), endOf(endPos));
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
      b.unshift(a);
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
      console.log(text);
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
