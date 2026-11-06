import React from "react";
import * as P from "pretty-fast-pretty-printer";
import { ASTNode, Pos } from "../../src/ast";
import { DropTarget } from "../../src/components/DropTarget";
import Args, { listItems } from "../../src/components/Args";
import Node from "../../src/components/Node";
import { addLanguage, removeLanguage } from "../../src/languages";
import { Comment, Literal, createASTSpec } from "../../src/nodes";
import { list, nodeSpec, optional, required } from "../../src/nodeSpec";

/**
 * A small language whose nodes lay their lists out in ways that put drop
 * targets nowhere near the elements they are for, to see that a DropTarget's
 * place in the page has nothing to do with where it inserts:
 *
 *   (block a b #| note |# c)   statements in <li> rows with a gutter holding
 *                              the drop target before each (and the line
 *                              number: comments have none); the target for the
 *                              end is in a <header>, *above* the rows
 *   (two a b ; c d)            two lists, side by side, with the same indices
 *   (plain a b)                the lists as Args draws them
 *
 * `(bad)` is a node whose drop target is made wrong on purpose (see `bad`).
 */

type Token = { type: string; text: string; from: Pos; to: Pos };

const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  let line = 0;
  let ch = 0;
  let i = 0;
  const step = () => {
    if (code[i] === "\n") {
      line++;
      ch = 0;
    } else {
      ch++;
    }
    i++;
  };
  while (i < code.length) {
    const c = code[i];
    const from = { line, ch };
    if (/\s/.test(c)) {
      step();
    } else if (c === "(" || c === ")" || c === ";") {
      step();
      tokens.push({ type: c, text: c, from, to: { line, ch } });
    } else if (code.startsWith("#|", i)) {
      const end = code.indexOf("|#", i);
      if (end < 0) throw new Error("a comment is not closed");
      const text = code.slice(i + 2, end).trim();
      while (i < end + 2) step();
      tokens.push({ type: "comment", text, from, to: { line, ch } });
    } else {
      let text = "";
      while (i < code.length && /[^\s();]/.test(code[i])) {
        text += code[i];
        step();
      }
      tokens.push({ type: "word", text, from, to: { line, ch } });
    }
  }
  return tokens;
};

const specs = {
  block: nodeSpec([list("statements", { orphans: true })], { label: "block" }),
  two: nodeSpec([list("args"), list("body")], { label: "two lists" }),
  plain: nodeSpec([list("args", { orphans: true })], { label: "plain list" }),
  bad: nodeSpec([list("items")], { label: "bad drop target" }),
  let: nodeSpec([required("symbol"), optional("init")], { label: "let" }),
  letbody: nodeSpec([required("symbol"), optional("init"), list("body")], {
    label: "let with a body",
  }),
  badopt: nodeSpec([optional("init"), list("items")], {
    label: "bad optional drop target",
  }),
};
const Layout = createASTSpec(specs);

/**
 * What the `(bad)` node draws as its drop target (set by a test before it
 * parses a program with a `(bad)` in it)
 */
export const bad: { field: string; index: number } = {
  field: "items",
  index: 0,
};

/**
 * What the `(badopt)` node draws as its drop target (set by a test before it
 * parses a program with a `(badopt)` in it): the index can be left out
 */
export const badopt: { field: string; index?: number } = {
  field: "init",
};

export const Block = (from: Pos, to: Pos, statements: ASTNode[]) =>
  Layout.makeNode({
    from,
    to,
    type: "block",
    fields: { statements },
    options: {},
    pretty: (node) => P.standardSexpr("block", node.fields.statements),
    render(props) {
      const { statements } = props.node.fields;
      return (
        <Node {...props}>
          {/* the drop target for the end of the list comes *first* in the page */}
          <header className="block-header">
            <DropTarget field="statements" index={statements.length} />
          </header>
          <ul className="block-rows">
            {listItems(statements).map((item) => (
              <li key={item.index} className="block-row">
                <div className="block-gutter">
                  <DropTarget field="statements" index={item.index} />
                  <span className="block-number">{item.number ?? ""}</span>
                </div>
                <div className="block-code">{item.node.reactElement()}</div>
              </li>
            ))}
          </ul>
        </Node>
      );
    },
  });

export const Two = (from: Pos, to: Pos, args: ASTNode[], body: ASTNode[]) =>
  Layout.makeNode({
    from,
    to,
    type: "two",
    fields: { args, body },
    options: {},
    pretty: (node) =>
      `(two ${node.fields.args.map(String).join(" ")} ; ${node.fields.body.map(String).join(" ")})`,
    render(props) {
      const { args, body } = props.node.fields;
      return (
        <Node {...props}>
          <div className="two-args">
            {args.map((arg, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <span key={index}>
                <DropTarget field="args" index={index} />
                {arg.reactElement()}
              </span>
            ))}
            <DropTarget field="args" index={args.length} />
          </div>
          <div className="two-body">
            {body.map((item, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <span key={index}>
                <DropTarget field="body" index={index} />
                {item.reactElement()}
              </span>
            ))}
            <DropTarget field="body" index={body.length} />
          </div>
        </Node>
      );
    },
  });

/** `(let x)` and `(let x 1)`: the initializer is optional, and null when it is not there */
export const Let = (
  from: Pos,
  to: Pos,
  symbol: ASTNode,
  init: ASTNode | null | undefined
) =>
  Layout.makeNode({
    from,
    to,
    type: "let",
    fields: { symbol, init },
    options: {},
    pretty: (node) =>
      P.standardSexpr(
        "let",
        node.fields.init
          ? [node.fields.symbol, node.fields.init]
          : [node.fields.symbol]
      ),
    render(props) {
      const { symbol, init } = props.node.fields;
      return (
        <Node {...props}>
          <span className="let-symbol">{symbol.reactElement()}</span>
          {init ? (
            <span className="let-init">{init.reactElement()}</span>
          ) : (
            <span className="let-slot">
              <DropTarget field="init" />
            </span>
          )}
        </Node>
      );
    },
  });

/**
 * `(letbody x 1 ; a b)`: an optional initializer (undefined, not null, when it
 * is not there) and a list, side by side in the one node
 */
export const LetBody = (
  from: Pos,
  to: Pos,
  symbol: ASTNode,
  init: ASTNode | null | undefined,
  body: ASTNode[]
) =>
  Layout.makeNode({
    from,
    to,
    type: "letbody",
    fields: { symbol, init, body },
    options: {},
    pretty: (node) =>
      `(letbody ${[node.fields.symbol, node.fields.init]
        .filter(Boolean)
        .map(String)
        .join(" ")} ; ${node.fields.body.map(String).join(" ")})`,
    render(props) {
      const { symbol, init, body } = props.node.fields;
      return (
        <Node {...props}>
          <span className="let-symbol">{symbol.reactElement()}</span>
          {init ? (
            <span className="let-init">{init.reactElement()}</span>
          ) : (
            <span className="let-slot">
              <DropTarget field="init" />
            </span>
          )}
          <ul className="let-body">
            {body.map((item, index) => (
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <li key={index}>
                <DropTarget field="body" index={index} />
                {item.reactElement()}
              </li>
            ))}
          </ul>
          <footer className="let-end">
            <DropTarget field="body" index={body.length} />
          </footer>
        </Node>
      );
    },
  });

/** `(badopt)` or `(badopt 1)`: a drop target that a test makes wrong */
export const BadOpt = (from: Pos, to: Pos, init: ASTNode | null) =>
  Layout.makeNode({
    from,
    to,
    type: "badopt",
    fields: { init, items: [] },
    options: {},
    pretty: (node) =>
      node.fields.init ? `(badopt ${node.fields.init})` : "(badopt)",
    render(props) {
      const { init } = props.node.fields;
      return (
        <Node {...props}>
          {init ? init.reactElement() : null}
          <DropTarget field={badopt.field} index={badopt.index} />
        </Node>
      );
    },
  });

export const Bad = (from: Pos, to: Pos) =>
  Layout.makeNode({
    from,
    to,
    type: "bad",
    fields: { items: [] },
    options: {},
    pretty: () => "(bad)",
    render(props) {
      return (
        <Node {...props}>
          <DropTarget field={bad.field} index={bad.index} />
        </Node>
      );
    },
  });

export const Plain = (from: Pos, to: Pos, args: ASTNode[]) =>
  Layout.makeNode({
    from,
    to,
    type: "plain",
    fields: { args },
    options: {},
    pretty: (node) => P.standardSexpr("plain", node.fields.args),
    render(props) {
      return (
        <Node {...props}>
          <ArgsOf node={props.node} />
        </Node>
      );
    },
  });

// (what Args draws, with the library's own component)
const ArgsOf = ({ node }: { node: ASTNode }) => (
  <Args field="args">{node.fields.args as ASTNode[]}</Args>
);

const parse = (code: string): ASTNode[] => {
  const tokens = tokenize(code);
  let at = 0;

  const expression = (): ASTNode => {
    const token = tokens[at++];
    if (!token) throw new Error("expected an expression");
    if (token.type === "comment") {
      throw new Error("a comment must be in a list");
    }
    if (token.type === "word") {
      return Literal(
        token.from,
        token.to,
        token.text,
        /^\d+$/.test(token.text) ? "number" : "symbol"
      );
    }
    if (token.type !== "(") throw new Error(`unexpected ${token.text}`);
    const head = tokens[at++];
    if (head?.type !== "word") throw new Error("expected a name");
    const items: ASTNode[] = [];
    const body: ASTNode[] = [];
    let inBody = false;
    while (tokens[at] && tokens[at].type !== ")") {
      const next = tokens[at];
      if (next.type === ";") {
        at++;
        inBody = true;
      } else if (next.type === "comment") {
        at++;
        (inBody ? body : items).push(
          Comment(next.from, next.to, next.text, { orphan: true })
        );
      } else {
        (inBody ? body : items).push(expression());
      }
    }
    const close = tokens[at++];
    if (!close) throw new Error("expected )");
    switch (head.text) {
      case "block":
        return Block(token.from, close.to, items);
      case "two":
        return Two(token.from, close.to, items, body);
      case "plain":
        return Plain(token.from, close.to, items);
      case "bad":
        return Bad(token.from, close.to);
      case "badopt":
        return BadOpt(token.from, close.to, items[0] ?? null);
      case "let": {
        if (inBody || items.length < 1 || items.length > 2) {
          throw new Error("(let name) or (let name value)");
        }
        // (null, where the next form has undefined: both are an empty field)
        return Let(token.from, close.to, items[0], items[1] ?? null);
      }
      case "letbody": {
        if (items.length < 1 || items.length > 2) {
          throw new Error("(letbody name [value] ; body...)");
        }
        return LetBody(token.from, close.to, items[0], items[1], body);
      }
      default:
        throw new Error(`unknown form ${head.text}`);
    }
  };

  const roots: ASTNode[] = [];
  while (at < tokens.length) roots.push(expression());
  return roots;
};

let counter = 0;
/** A fresh copy of the language (a language id can only be added once) */
export const makeLayoutLanguage = () => {
  const id = `layouts-${counter++}`;
  const language = addLanguage({
    id,
    name: "layouts",
    parse,
    blockComment: { open: "#|", close: "|#" },
  });
  return { language, remove: () => removeLanguage(id) };
};

/** What a node looks like, for comparing: `(block a #| note |# b)` */
export const shape = (node: ASTNode): string => {
  const all = (list: unknown) => (list as ASTNode[]).map(shape).join(" ");
  switch (node.type) {
    case "comment":
      return `#| ${node.fields.comment} |#`;
    case "block":
      return `(block ${all(node.fields.statements)})`.replace(" )", ")");
    case "two":
      return `(two ${all(node.fields.args)} ; ${all(node.fields.body)})`;
    case "plain":
      return `(plain ${all(node.fields.args)})`.replace(" )", ")");
    case "let":
      return `(let ${all([node.fields.symbol, node.fields.init].filter(Boolean))})`;
    case "letbody":
      return `(letbody ${all([node.fields.symbol, node.fields.init].filter(Boolean))} ; ${all(node.fields.body)})`;
    case "badopt":
      return "(badopt)";
    default:
      return String(node.fields.value ?? node.type);
  }
};
