import React from "react";
import * as P from "pretty-fast-pretty-printer";
import wescheme from "@bootstrapworld/wescheme";
import {
  Args,
  Languages,
  Node,
  Nodes,
  defineNode,
  field,
} from "../src/CodeMirrorBlocks";
import type { ASTNode } from "../src/ast";
import type { API } from "../src/CodeMirrorBlocks";
import {
  cmd_ctrl,
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { installFakeClipboard } from "./helpers/clipboard";
import { dragOnto, dropOnWhitespace } from "./helpers/gestures";

/**
 * A list field that is `fixed` has as many elements as the parser made: nothing
 * is inserted into it, and an element that is deleted, cut or dragged out
 * leaves a blank (as the child of a required field does). The language here
 * reads `(triple a b c)` as a node of that kind.
 */
const Triple = defineNode({
  type: "triple",
  label: "triple",
  fields: { items: field.list({ fixed: true }) },
  pretty: (node) => P.standardSexpr("triple", node.fields.items),
  render: (props) => (
    <Node {...props} variant="compound">
      <span className="blocks-operator">triple</span>
      <Args className="blocks-triple-items" field="items">
        {props.node.fields.items}
      </Args>
    </Node>
  ),
});

function tripleify(node: ASTNode): ASTNode {
  if (node.type !== "functionApp") return node;
  const { func, args } = node.fields as { func: ASTNode; args: ASTNode[] };
  const kids = args.map(tripleify);
  if (func.type === "literal" && String(func.fields.value) === "triple") {
    return Triple(node.from, node.to, { items: kids }, node.options);
  }
  return Nodes.FunctionApp(
    node.from,
    node.to,
    { func, args: kids },
    node.options
  );
}

const language = Languages.addLanguage({
  id: "fixed-list-test",
  name: "A fixed list, for a test",
  parse: (code: string) => wescheme.parse(code).map(tripleify),
  getExceptionMessage: (e: unknown) => String(e),
});

let cmb: API;
let clipboard: ReturnType<typeof installFakeClipboard>;
beforeEach(() => {
  cmb = mountCMB(language).cmb;
  clipboard = installFakeClipboard();
  cmb.setValue("(triple a b c)\n(f x)");
  cmb.clearHistory();
});
afterEach(() => {
  clipboard.restore();
  teardown();
});

const root = (i = 0) => cmb.getAst().rootNodes[i];
const items = () => (root(0).fields as { items: ASTNode[] }).items;
const shape = (nodes: Iterable<ASTNode>) =>
  [...nodes].map((n) => n.type).join(" ");
const sameAsReparsed = () =>
  expect(shape(cmb.getAst().descendants())).toBe(
    shape(language.buildAST(cmb.getValue()).descendants())
  );
const select = (node: ASTNode) => {
  mouseDown(node);
  keyDown(" ", {}, node);
};
const undo = () => keyDown("Z", cmd_ctrl);
const el = (node: ASTNode) => elementForNode(node)!;

describe("a list of a fixed length", () => {
  it("has no drop targets, where an ordinary list has them", () => {
    const fixed = document.querySelector(".blocks-triple-items")!;
    expect(fixed.querySelectorAll(".blocks-drop-target")).toHaveLength(0);
    expect(fixed.querySelectorAll(".blocks-literal")).toHaveLength(3);
    expect(
      document.querySelectorAll(".blocks-functionApp .blocks-drop-target")
        .length
    ).toBeGreaterThan(0);
  });

  it("leaves a blank when an element is deleted, and undo brings it back", () => {
    const [, b] = items();
    select(b);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(triple a ... c)\n(f x)");
    expect(items().map((n) => n.type)).toEqual(["literal", "blank", "literal"]);
    sameAsReparsed();
    undo();
    expect(cmb.getValue()).toBe("(triple a b c)\n(f x)");
    expect(items()).toHaveLength(3);
    sameAsReparsed();
  });

  it("keeps a blank that is deleted: the length does not change", () => {
    const [, b] = items();
    select(b);
    keyDown("Delete");
    select(items()[1]);
    keyDown("Delete");
    expect(items()).toHaveLength(3);
    expect(items()[1].type).toBe("blank");
  });

  it("leaves a blank when an element is cut, and undo puts it back", () => {
    const [, b] = items();
    select(b);
    keyDown("X", cmd_ctrl);
    expect(clipboard.text).toBe("b");
    expect(items().map((n) => n.type)).toEqual(["literal", "blank", "literal"]);
    sameAsReparsed();
    undo();
    expect(items().map(String)).toEqual(["a", "b", "c"]);
  });

  it("leaves a blank when an element is dragged out, and undo puts it back", () => {
    const [, b] = items();
    dropOnWhitespace(cmb, el(b), { line: 2, ch: 0 });
    expect(items().map((n) => n.type)).toEqual(["literal", "blank", "literal"]);
    expect(cmb.getValue()).toContain("b");
    sameAsReparsed();
    undo();
    expect(items().map(String)).toEqual(["a", "b", "c"]);
    expect(cmb.getValue()).toBe("(triple a b c)\n(f x)");
  });

  it("is replaced by a block dropped on an element, or on a blank", () => {
    const x = (root(1).fields as { args: ASTNode[] }).args[0];
    dragOnto(el(x), el(items()[1]));
    expect(items().map(String)).toEqual(["a", "x", "c"]);
    expect(items()).toHaveLength(3);
    sameAsReparsed();
    undo();
    select(items()[0]);
    keyDown("Delete");
    const y = (root(1).fields as { args: ASTNode[] }).args[0];
    dragOnto(el(y), el(items()[0]));
    expect(items()).toHaveLength(3);
    expect(items()[0].type).toBe("literal");
    sameAsReparsed();
  });

  it("is replaced by a paste over an element", () => {
    clipboard.text = "z";
    const [, b] = items();
    select(b);
    keyDown("V", cmd_ctrl, b);
    expect(items().map(String)).toEqual(["a", "z", "c"]);
    sameAsReparsed();
    undo();
    expect(items().map(String)).toEqual(["a", "b", "c"]);
  });

  it("refuses an insertion from the keyboard, before and after an element", () => {
    const [, b] = items();
    mouseDown(b);
    keyDown("]", { ctrlKey: true }, b);
    expect(document.activeElement).not.toHaveAttribute("contenteditable");
    keyDown("[", { ctrlKey: true }, b);
    expect(document.activeElement).not.toHaveAttribute("contenteditable");
    expect(items()).toHaveLength(3);
    expect(cmb.getValue()).toBe("(triple a b c)\n(f x)");
  });
});
