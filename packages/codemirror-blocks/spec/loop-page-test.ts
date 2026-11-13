import wescheme from "@bootstrapworld/wescheme";
import { Languages, Nodes } from "../src/CodeMirrorBlocks";
import type { ASTNode } from "../src/ast";
import { API } from "../src/CodeMirrorBlocks";
import {
  mountCMB,
  mouseDown,
  keyDown,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/**
 * No language of ours makes a Loop yet, so this is one that does, for the test:
 * `(while 1 2 3)`, `(for-each 1 2 3)`, `(repeat 3 1)`... are read as a loop
 * (the first word is its kind, the header takes as many items as the kind needs,
 * and the rest is its body). It shows how a Loop draws, is walked with the
 * arrow keys, is edited, and reads back.
 */
const HEADER_SIZE: Record<string, number> = {
  while: 1,
  repeat: 1,
  "for-each": 2,
  for: 3,
};

function loopify(node: ASTNode): ASTNode {
  if (node.type !== "functionApp") return node;
  const { func, args } = node.fields as { func: ASTNode; args: ASTNode[] };
  const kids = args.map(loopify);
  const kind = (func.fields as { value: string }).value;
  if (func.type === "literal" && kind in HEADER_SIZE) {
    const size = HEADER_SIZE[kind];
    return Nodes.Loop(
      node.from,
      node.to,
      { kind, header: kids.slice(0, size), body: kids.slice(size) },
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
  id: "loop-page-test",
  name: "Loops, for a test",
  parse: (code: string) => wescheme.parse(code).map(loopify),
  getExceptionMessage: (e: unknown) => String(e),
});

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(language).cmb;
});
afterEach(() => {
  teardown();
});

const root = () => cmb.getAst().rootNodes[0] as ASTNode;
const body = () => (root().fields as { body: ASTNode[] }).body;
const header = () => (root().fields as { header: ASTNode[] }).header;
/** What the tree is: every node's type, in order */
const shape = (nodes: Iterable<ASTNode>) =>
  [...nodes].map((n) => n.type).join(" ");
const typeOf = () => shape(cmb.getAst().descendants());
const reparsed = () => shape(language.buildAST(cmb.getValue()).descendants());
const focused = () => cmb.getFocusedNode()?.toString();

describe("a loop in a page", () => {
  beforeEach(() => {
    cmb.setValue("(while 1 2 3)");
  });

  it("is drawn: the kind, the header in a row, the body in a column", () => {
    expect(root().type).toBe("loop");
    const block = document.querySelector(".blocks-loop")!;
    expect(block).not.toBeNull();
    expect(block.querySelector(":scope > .blocks-operator")?.textContent).toBe(
      "while"
    );
    const head = block.querySelector(":scope > .blocks-loop-header")!;
    const rest = block.querySelector(":scope > .blocks-loop-body")!;
    expect(head.querySelectorAll(":scope > .blocks-literal")).toHaveLength(1);
    expect(rest.querySelectorAll(":scope > .blocks-literal")).toHaveLength(2);
    // the body has its drop targets (before, between and after); the header,
    // which keeps its length, has none
    expect(head.querySelectorAll(".blocks-drop-target")).toHaveLength(0);
    expect(rest.querySelectorAll(".blocks-drop-target")).toHaveLength(3);
  });

  it("is walked by the arrow keys: the header first, then the body", () => {
    mouseDown(root());
    const visited: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      keyDown("ArrowDown");
      visited.push(focused());
    }
    expect(visited).toEqual(["1", "2", "3"]);
    // and back up again
    keyDown("ArrowUp");
    expect(focused()).toBe("2");
  });

  it("takes a block into its body, and prints as it was read", () => {
    const a = body()[0];
    mouseDown(a);
    keyDown("[", { ctrlKey: true }, a);
    setEditableText("9");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(while 1 9 2 3)");
    expect(body()).toHaveLength(3);
    expect(typeOf()).toBe(reparsed());
  });

  it("gives up a block from its body, and prints as it was read", () => {
    const b = body()[1];
    mouseDown(b);
    keyDown(" ", {}, b);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(while 1 2)");
    expect(body()).toHaveLength(1);
    expect(typeOf()).toBe(reparsed());
  });

  // The header is a list of a fixed length: as many as the parser made, so
  // nothing goes in before, between or after them
  it("takes no block into its header", () => {
    const t = header()[0];
    mouseDown(t);
    keyDown("]", { ctrlKey: true }, t);
    expect(document.activeElement).not.toHaveAttribute("contenteditable");
    keyDown("[", { ctrlKey: true }, t);
    expect(document.activeElement).not.toHaveAttribute("contenteditable");
    expect(cmb.getValue()).toBe("(while 1 2 3)");
    expect(
      document
        .querySelector(".blocks-loop-header")!
        .querySelectorAll(".blocks-drop-target")
    ).toHaveLength(0);
  });

  it("losing the one item of its header leaves a blank: it is still a while loop", () => {
    const t = header()[0];
    mouseDown(t);
    keyDown(" ", {}, t);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(while ... 2 3)");
    expect(root().type).toBe("loop");
    expect(header().map((n) => n.type)).toEqual(["blank"]);
    expect(body().map(String)).toEqual(["2", "3"]);
    expect(typeOf()).toBe(reparsed());
  });

  it("goes back to what it was, with the item, when that is undone", () => {
    const t = header()[0];
    mouseDown(t);
    keyDown(" ", {}, t);
    keyDown("Delete");
    keyDown("Z", { ctrlKey: true });
    expect(cmb.getValue()).toBe("(while 1 2 3)");
    expect(header().map(String)).toEqual(["1"]);
  });
});
