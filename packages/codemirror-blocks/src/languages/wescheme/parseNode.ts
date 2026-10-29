import * as structures from "wescheme-js/src/structures";
import type { ASTNode } from "../../ast";
import * as Nodes from "../../nodes";
import { LetLikeExpr, WhenUnless, Sequence } from "./ast";
import * as types from "wescheme-js/src/runtime/types";
const { isString, isChar, TRUE, FALSE } = types;

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

const symbolMap = new Map();
symbolMap.set("*", "multiply");
symbolMap.set("-", "subtract");
symbolMap.set("/", "divide");

// symbolAria : String -> String
export function symbolAria(str: string): string {
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

function pluralize(noun: string, set: unknown[]) {
  return set.length + " " + noun + (set.length != 1 ? "s" : "");
}

// expressionAria: String Array -> String
function expressionAria(func: string, args: unknown[]) {
  return symbolAria(func) + " expression, " + pluralize("input", args);
}

// enumerateIdentifierList : [Literals] -> String
// do the right thing with commas, "and", etc
function enumerateIdentifierList(lst: structures.Program[]) {
  if (lst.length === 0) {
    return "";
  }
  lst = [...lst];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const last = lst.pop()!;
  return lst.length == 0
    ? last.toString()
    : lst.join(", ") + " and " + last.toString();
}

// makeComment : WeSchemeComment -> ASTNodeComment
function makeComment(node: structures.Program | structures.comment) {
  const from = {
    line: (node.comment || node).location.startRow - 1,
    ch: (node.comment || node).location.startCol,
  };
  const to = {
    line: (node.comment || node).location.endRow - 1,
    ch: (node.comment || node).location.endCol,
  };
  return Comment(from, to, node.comment?.txt || "");
}

function notNull<T>(item: T | null): item is T {
  return item !== null;
}

/**
 * parseNode : WeSchemeNode Number -> ASTNode
 *
 * Like {@link parseNodeOrNull}, but for positions where a node is required.
 */
export function parseNode(node: structures.Program, i = 0): ASTNode {
  const parsed = parseNodeOrNull(node, i);
  if (parsed === null) {
    throw new Error(`Could not convert ${node} into a block`);
  }
  return parsed;
}

/**
 * parseNodeOrNull : WeSchemeNode Number -> ASTNode | null
 *
 * Some WeScheme nodes (e.g. unsupported expressions that aren't lists) have no
 * block representation, in which case this returns null.
 */
export function parseNodeOrNull(
  node: structures.Program,
  i = 0
): ASTNode | null {
  function locationFromNode(node: structures.Program) {
    const from = {
      line: node.location.startRow - 1,
      ch: node.location.startCol,
    };
    const to = {
      line: node.location.endRow - 1,
      ch: node.location.endCol,
    };
    return { from, to };
  }

  function parseBinding(b: structures.couple) {
    const loc = locationFromNode(b);
    const name = parseNode(b.first);
    const val = parseNode(b.second);
    return VariableDefinition(loc.from, loc.to, name, val, {
      ariaLabel: symbolAria(b.first.val) + " bound to " + val.options.ariaLabel,
      comment: comment,
    });
  }

  const { from, to } = locationFromNode(node);
  const comment = node.comment ? makeComment(node) : undefined;

  if (node instanceof structures.callExpr) {
    let func, label;
    const children = node.args.map(parseNodeOrNull).filter(notNull);
    if (!node.func) {
      func = Blank(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 1 },
        "...",
        "blank",
        { ariaLabel: "*blank*" }
      );
      // special case for Unit Tests
    } else {
      func = parseNode(node.func);
      // NOTE: block nodes keep their value in `fields`, so this lookup has been
      // undefined (and this branch dead) since nodes stopped being classes.
      // The behavior is preserved as-is; use `func.fields.value` to revive it.
      if (
        (func as unknown as { value?: unknown }).value == "check-expect" &&
        node.args[0].func
      ) {
        label = "Unit Test for " + symbolAria(node.args[0].func.val);
      } else {
        label = expressionAria(
          node.func ? symbolAria(node.func.val) : "empty",
          node.args
        );
      }
    }
    return FunctionApp(from, to, func, children, {
      ariaLabel: label,
      comment: comment,
    });
  } else if (node instanceof structures.andExpr) {
    const comment = node.comment ? makeComment(node) : undefined;
    return FunctionApp(
      from,
      to,
      Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 4 },
        "and",
        "symbol",
        { ariaLabel: "and" }
      ),
      node.exprs.map(parseNodeOrNull).filter(notNull),
      { ariaLabel: expressionAria("and", node.exprs), comment: comment }
    );
  } else if (node instanceof structures.orExpr) {
    const comment = node.comment ? makeComment(node) : undefined;
    return FunctionApp(
      from,
      to,
      Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 3 },
        "or",
        "symbol",
        { ariaLabel: "or" }
      ),
      node.exprs.map(parseNodeOrNull).filter(notNull),
      { ariaLabel: expressionAria("or", node.exprs), comment: comment }
    );
  } else if (node instanceof structures.defVar) {
    return VariableDefinition(
      from,
      to,
      parseNode(node.name),
      parseNode(node.expr),
      {
        ariaLabel: symbolAria(node.name.val) + ": value definition",
        comment: comment,
      }
    );
  } else if (node instanceof structures.defStruct) {
    const fieldsLoc = locationFromNode(node.fields);
    const fields = IdentifierList(
      fieldsLoc.from,
      fieldsLoc.to,
      "fields",
      node.fields.map(parseNode),
      {
        ariaLabel:
          pluralize("field", node.fields) +
          ": " +
          enumerateIdentifierList(node.fields),
        comment: node.fields.comment ? makeComment(node.fields) : undefined,
      }
    );
    return StructDefinition(from, to, parseNode(node.name), fields, {
      ariaLabel:
        symbolAria(node.name.val) +
        ": structure definition with " +
        pluralize("field", node.fields) +
        ": " +
        enumerateIdentifierList(node.fields),
      comment: comment,
    });
  } else if (node instanceof structures.defFunc) {
    const argsLoc = locationFromNode(node.args);
    const args = IdentifierList(
      argsLoc.from,
      argsLoc.to,
      "arguments:",
      node.args.map(parseNode),
      {
        ariaLabel:
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: node.args.comment ? makeComment(node.args) : undefined,
      }
    );
    return FunctionDefinition(
      from,
      to,
      parseNode(node.name),
      args,
      parseNode(node.body),
      {
        ariaLabel:
          symbolAria(node.name.val) +
          ": function definition with " +
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: comment,
      }
    );
  } else if (node instanceof structures.lambdaExpr) {
    const argsLoc = locationFromNode(node.args);
    const args = IdentifierList(
      argsLoc.from,
      argsLoc.to,
      "arguments",
      node.args.map(parseNode),
      {
        ariaLabel:
          pluralize("argument", node.args) +
          ": " +
          enumerateIdentifierList(node.args),
        comment: node.args.comment ? makeComment(node.args) : undefined,
      }
    );
    return LambdaExpression(from, to, args, parseNode(node.body), {
      ariaLabel:
        "anonymous function with " +
        pluralize("argument", node.args) +
        ": " +
        enumerateIdentifierList(node.args),
    });
  } else if (node instanceof structures.condExpr) {
    return CondExpression(from, to, node.clauses.map(parseNode), {
      ariaLabel:
        "conditional expression with " + pluralize("clause", node.clauses),
    });
  } else if (node instanceof structures.couple) {
    return CondClause(
      from,
      to,
      parseNode(node.first),
      [parseNode(node.second)],
      { ariaLabel: "condition " + (i + 1) }
    );
  } else if (node instanceof structures.ifExpr) {
    const predicate = parseNode(node.predicate);
    const consequence = parseNode(node.consequence);
    const alternative = parseNode(node.alternative);
    const predLabel = predicate.options.ariaLabel;
    const conLabel = consequence.options.ariaLabel;
    const altLabel = alternative.options.ariaLabel;
    predicate.options.ariaLabel = "if, " + predLabel;
    consequence.options.ariaLabel = "then, " + conLabel;
    alternative.options.ariaLabel = "else, " + altLabel;
    return IfExpression(from, to, predicate, consequence, alternative, {
      ariaLabel: "if-then-else expression",
      comment: comment,
    });
  } else if (node instanceof structures.symbolExpr) {
    if (node.val == "...") {
      return Blank(from, to, node.val, "symbol", { ariaLabel: "blank" });
    } else if (["true", "false"].includes(node.val)) {
      return Literal(from, to, node.val, "boolean", {
        ariaLabel: symbolAria(node.val) + ", a Boolean",
        comment: comment,
      });
    } else {
      return Literal(from, to, node.val, "symbol", {
        ariaLabel: symbolAria(node.val),
        comment: comment,
      });
    }
  } else if (node instanceof structures.literal) {
    let dataType: string = typeof node.val,
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
    return Literal(from, to, value, dataType, {
      ariaLabel: aria,
      comment: comment,
    });
  } else if (node instanceof structures.comment) {
    return Comment(from, to, node.txt);
  } else if (node instanceof structures.beginExpr) {
    return Sequence(
      from,
      to,
      node.exprs.map(parseNode),
      Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 6 },
        "begin",
        "symbol",
        { ariaLabel: "begin" }
      ),
      {
        ariaLabel: `sequence containing ${pluralize("expression", node.exprs)}`,
      }
    );
  } else if (
    node instanceof structures.letExpr ||
    node instanceof structures.letStarExpr ||
    node instanceof structures.letrecExpr
  ) {
    const loc = locationFromNode(node.bindings),
      form = node.stx[0].val;
    const bindings = node.bindings.map((b) =>
      parseBinding(b as structures.couple)
    );
    const sequence = Sequence(
      loc.from,
      loc.to,
      bindings,
      Literal(
        { line: from.line, ch: from.ch + 1 },
        { line: from.line, ch: from.ch + 9 },
        "bindings",
        "symbol",
        { ariaLabel: "bindings" }
      ),
      {
        ariaLabel: `${pluralize("binding", node.bindings)}`,
      }
    );
    return LetLikeExpr(from, to, form, sequence, parseNode(node.body), {
      ariaLabel: `${symbolAria(form)} expression with ${pluralize(
        "binding",
        node.bindings
      )}`,
    });
  } else if (node instanceof structures.whenUnlessExpr) {
    const loc = locationFromNode(node.exprs),
      form = node.stx.val;
    return WhenUnless(
      from,
      to,
      form,
      parseNode(node.predicate),
      Sequence(
        loc.from,
        loc.to,
        node.exprs.map(parseNode),
        Literal(
          { line: from.line, ch: from.ch + 1 },
          { line: from.line, ch: from.ch + 6 },
          "begin",
          "symbol",
          { ariaLabel: "begin" }
        ),
        {
          ariaLabel: `${pluralize("expression", node.exprs)}`,
        }
      ),
      { ariaLabel: `${symbolAria(form)} expression` }
    );
  } else if (node instanceof structures.unsupportedExpr) {
    if (node.val.constructor !== Array) {
      return null;
    }
    const unknown = Unknown(
      from,
      to,
      (node.val as structures.Program[]).map(parseNodeOrNull).filter(notNull),
      {
        ariaLabel: "invalid expression",
        comment: comment,
      }
    );
    return unknown;
  } else if (node instanceof structures.requireExpr) {
    return FunctionApp(from, to, parseNode(node.stx), [parseNode(node.spec)], {
      ariaLabel: "require " + node.spec.val,
      comment: comment,
    });
  }
  return null;
}
