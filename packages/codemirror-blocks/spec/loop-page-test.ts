import example from "@bootstrapworld/example";
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
  parse: (code: string) => example.parse(code).map(loopify),
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
    // each list has its drop targets: before, between and after
    expect(head.querySelectorAll(".blocks-drop-target")).toHaveLength(2);
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

  // The header is a list, so the editor lets a block in, and the text printed is
  // what the editor then reads; how many items belong to the header is the
  // language's to say, so it can read the text another way than it was edited.
  it("takes a block into its header, which a language then reads its own way", () => {
    const t = header()[0];
    mouseDown(t);
    keyDown("]", { ctrlKey: true }, t);
    setEditableText("8");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(while 1 8 2 3)");
    // (this language's `while` has a header of one: the 8 is read as the body's)
    expect(header()).toHaveLength(1);
    expect(body()).toHaveLength(3);
  });

  // The open question: nothing says a header may not be empty or short. What
  // happens now is that the item is gone, the text is printed without it, and
  // the next item is read as the header: the loop does not break, but it is not
  // the loop that was edited.
  it("losing the one item of its header: the next item is read as the header", () => {
    const t = header()[0];
    mouseDown(t);
    keyDown(" ", {}, t);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(while 2 3)");
    expect(header().map(String)).toEqual(["2"]);
    expect(body().map(String)).toEqual(["3"]);
    expect(typeOf()).toBe(reparsed());
  });
});
