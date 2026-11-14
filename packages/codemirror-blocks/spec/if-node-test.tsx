import React from "react";
import * as P from "pretty-fast-pretty-printer";
import { fireEvent } from "@testing-library/react";
import wescheme from "@bootstrapworld/wescheme";
import { Args, Languages, Node, Nodes } from "../src/CodeMirrorBlocks";
import type { ASTNode } from "../src/ast";
import type { API } from "../src/CodeMirrorBlocks";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/**
 * The core If: a test, steps, and an else that is there only when it has steps,
 * and is drawn faded until then. A test-only language reads
 * `(ifs t a b)` as an if with no else and `(ifs t (then a) (otherwise b))` as one with.
 */
const isForm = (node: ASTNode, word: string) =>
  node.type === "functionApp" &&
  (node.fields as { func: ASTNode }).func.type === "literal" &&
  String((node.fields as { func: ASTNode }).func.fields.value) === word;
const argsOf = (node: ASTNode) => (node.fields as { args: ASTNode[] }).args;

// (written with the keyword `ifs`, which is what the test language reads: the
// reader of WeScheme makes its own node of a plain `if`)
const { If: Ifs } = Nodes.forLanguage({
  If: {
    pretty: (node) => {
      const { test, body, otherwise } = node.fields;
      return otherwise.length
        ? P.standardSexpr("ifs", [
            test,
            P.standardSexpr("then", body),
            P.standardSexpr("otherwise", otherwise),
          ])
        : P.standardSexpr("ifs", [test, ...body]);
    },
  },
});

function ifify(node: ASTNode, make: (typeof Nodes)["If"] = Ifs): ASTNode {
  if (node.type !== "functionApp") return node;
  const { func, args } = node.fields as { func: ASTNode; args: ASTNode[] };
  const kids = args.map((a) => ifify(a, make));
  if (isForm(node, "ifs") && kids.length >= 1) {
    const rest = kids.slice(1);
    const hasElse =
      rest.length === 2 &&
      isForm(rest[0], "then") &&
      isForm(rest[1], "otherwise");
    return make(
      node.from,
      node.to,
      {
        test: kids[0],
        body: hasElse ? argsOf(rest[0]) : rest,
        otherwise: hasElse ? argsOf(rest[1]) : [],
      },
      node.options
    );
  }
  return Nodes.FunctionApp(
    node.from,
    node.to,
    { func, args: kids },
    node.options
  );
}

const language = Languages.addLanguage({
  id: "if-node-test",
  name: "If, for a test",
  parse: (code: string) => wescheme.parse(code).map((n) => ifify(n)),
  getExceptionMessage: (e: unknown) => String(e),
});

let cmb: API;
afterEach(() => teardown());
const mount = (code: string, lang = language) => {
  cmb = mountCMB(lang).cmb;
  cmb.setValue(code);
  cmb.clearHistory();
};
const root = () => cmb.getAst().rootNodes[0];
const f = () =>
  root().fields as unknown as {
    test: ASTNode;
    body: ASTNode[];
    otherwise: ASTNode[];
  };
const elseArea = () => document.querySelector(".blocks-if-else");
const addElse = () =>
  document.querySelector<HTMLElement>('[aria-label="add an else"]');
const undo = () => keyDown("Z", cmd_ctrl);

describe("an if", () => {
  it("prints (ifs test body...), and with an else (ifs test (then ...) (otherwise ...))", () => {
    mount("(ifs t a b)");
    expect(root().type).toBe("if");
    expect(root().toString()).toBe("(ifs t a b)");
    teardown();
    mount("(ifs t (then a b) (otherwise c))");
    expect(root().toString()).toBe("(ifs t (then a b) (otherwise c))");
  });

  it("says whether it has an else, and how many steps", () => {
    mount("(ifs t a b)");
    expect(root().describe(1)).toBe("an if: if t, then 2 steps");
    teardown();
    mount("(ifs t (then a) (otherwise b c))");
    expect(root().describe(1)).toBe("an if: if t, then 1 step, else 2 steps");
  });

  it("draws the else faded, with a place to drop a block, when it has none", () => {
    mount("(ifs t a)");
    expect(elseArea()).not.toBeNull();
    expect(elseArea()).toHaveClass("blocks-not-live");
    expect(elseArea()!.querySelector(".blocks-operator")?.textContent).toBe(
      "else"
    );
    // (a screenreader is told that the place adds an else, not that there is one)
    expect(addElse()).not.toBeNull();
    expect(elseArea()!.contains(addElse())).toBe(true);
  });

  it("draws the else in full when it has steps", () => {
    mount("(ifs t (then a) (otherwise b))");
    expect(elseArea()).not.toHaveClass("blocks-not-live");
    expect(addElse()).toBeNull();
    expect(elseArea()!.querySelectorAll(".blocks-literal")).toHaveLength(1);
  });

  it("gets an else from a block typed into the faded else, and undo takes it away", () => {
    mount("(ifs t a)");
    fireEvent.click(addElse()!);
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    setEditableText("b");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(ifs t (then a) (otherwise b))");
    expect(f().otherwise.map(String)).toEqual(["b"]);
    expect(elseArea()).not.toHaveClass("blocks-not-live");
    undo();
    expect(cmb.getValue()).toBe("(ifs t a)");
    expect(elseArea()).toHaveClass("blocks-not-live");
  });

  it("opens the faded else for typing from a click on its keyword, not only its small place", () => {
    mount("(ifs t a)");
    fireEvent.click(elseArea()!.querySelector(".blocks-operator")!);
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    setEditableText("b");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(ifs t (then a) (otherwise b))");
  });

  it("loses its else when the last step of it is deleted, and undo brings it back", () => {
    mount("(ifs t (then a) (otherwise b))");
    const b = f().otherwise[0];
    mouseDown(b);
    keyDown(" ", {}, b);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(ifs t a)");
    expect(f().otherwise).toHaveLength(0);
    expect(elseArea()).toHaveClass("blocks-not-live");
    expect(root().describe(1)).toBe("an if: if t, then 1 step");
    undo();
    expect(cmb.getValue()).toBe("(ifs t (then a) (otherwise b))");
    expect(elseArea()).not.toHaveClass("blocks-not-live");
  });

  it("takes a step beside a step of the body", () => {
    mount("(ifs t a)");
    const a = f().body[0];
    mouseDown(a);
    keyDown("]", { ctrlKey: true }, a);
    setEditableText("z");
    keyDown("Enter");
    expect(f().body.map(String)).toEqual(["a", "z"]);
    expect(cmb.getValue()).toBe("(ifs t a z)");
  });
});

describe("an if, written by a language", () => {
  it("can say its keyword, and leave the else out of what it draws", () => {
    const { If } = Nodes.forLanguage({
      If: {
        label: "when",
        pretty: (node) =>
          P.standardSexpr("ifs", [node.fields.test, ...node.fields.body]),
        render(props) {
          return (
            <Node {...props} variant="compound">
              <span className="blocks-operator">when</span>
              {props.node.fields.test.reactElement()}
              <Args className="blocks-conditional-body" field="body">
                {props.node.fields.body}
              </Args>
            </Node>
          );
        },
      },
    });
    const when = Languages.addLanguage({
      id: "if-node-test-when",
      name: "A when, for a test",
      parse: (code: string) => wescheme.parse(code).map((n) => ifify(n, If)),
      getExceptionMessage: (e: unknown) => String(e),
    });
    mount("(ifs t a b)", when);
    expect(document.querySelector(".blocks-if")).not.toBeNull();
    expect(
      document.querySelector(".blocks-if > .blocks-operator")?.textContent
    ).toBe("when");
    expect(elseArea()).toBeNull();
    expect(addElse()).toBeNull();
    expect(root().type).toBe("if");
    expect(root().label).toBe("when");
    // (the core If, in the same page, is not changed by it)
    expect(Nodes.If.type).toBe("if");
  });
});
