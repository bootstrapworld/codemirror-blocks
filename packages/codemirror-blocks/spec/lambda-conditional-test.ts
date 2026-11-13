import lambda from "@bootstrapworld/lambda";
import type { ASTNode } from "../src/ast";
import type { API } from "../src/CodeMirrorBlocks";
import {
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/**
 * Lambda's `if` is the core Conditional: `else if` goes on as another branch,
 * and the steps of a branch are bare if there is one and in braces if there are
 * several. What is written does not change; the tree is one level deeper.
 */
const printed = (code: string) => lambda.buildAST(code).toString();
const conditional = (code: string) =>
  [...lambda.buildAST(code).descendants()].find(
    (n) => n.type === "conditional"
  )!;
const f = (n: ASTNode) =>
  n.fields as unknown as {
    branches: ASTNode[];
    otherwise: ASTNode[];
    body: ASTNode[];
  };
const types = (code: string) =>
  [...lambda.buildAST(code).descendants()].map((n) => n.type).join(" ");

describe("lambda: an if is a conditional with branches", () => {
  it("is printed as it is written", () => {
    for (const code of [
      "if x then y",
      'if x then "a" else "b"',
      "if x then y else z",
      "if a then x else if b then y else z",
      "if a then x else if b then y",
    ]) {
      expect(printed(code)).toBe(code);
    }
  });

  it("is a conditional of branches, the else being steps of its own", () => {
    const c = conditional("if a then x else if b then y else z");
    expect(f(c).branches.map((b) => b.type)).toEqual([
      "conditionalBranch",
      "conditionalBranch",
    ]);
    expect(f(c).otherwise.map(String)).toEqual(["z"]);
    expect(conditional("if a then x").fields).toHaveProperty("otherwise");
    expect(f(conditional("if a then x")).otherwise).toHaveLength(0);
  });

  it("writes several steps in braces, and reads them back as the same list", () => {
    const code = "if c then { a; b } else { d; e; g }";
    // (the steps of a block are on lines of their own, as the statements of a
    // block always were)
    const again = printed(code);
    expect(again.replace(/\s+/g, " ")).toBe(code);
    const c = conditional(code);
    expect(f(f(c).branches[0]).body.map(String)).toEqual(["a", "b"]);
    expect(f(c).otherwise.map(String)).toEqual(["d", "e", "g"]);
    // (the tree has no block node inside the list: its statements are the list)
    expect(types(code)).toBe(
      "prog conditional conditionalBranch literal literal literal literal literal literal"
    );
    expect(types(again)).toBe(types(code));
  });

  it("writes a step in braces bare, as it always did", () => {
    expect(printed("if c then { a } else { d }")).toBe("if c then a else d");
  });

  it("keeps a comment inside a block with the step it is above", () => {
    const code = "if c then {\n  a;\n  #| note |#\n  b\n}";
    const body = f(f(conditional(code)).branches[0]).body;
    expect(body).toHaveLength(2);
    expect(body[1].options.comment).toBeDefined();
    // (and it is written again, where it was, and reads back the same)
    expect(printed(code)).toContain("#| note |#");
    expect(types(printed(code))).toBe(types(code));
  });
});

describe("lambda: editing the blocks of an if", () => {
  let cmb: API;
  beforeEach(() => {
    cmb = mountCMB(lambda).cmb;
  });
  afterEach(() => teardown());
  const body = () => f(f(conditional(cmb.getValue())).branches[0]).body;

  it("inserts a step beside a step, which makes the steps a block", () => {
    cmb.setValue("if c then a");
    cmb.clearHistory();
    const a = [...cmb.getAst().descendants()].find((n) => String(n) === "a")!;
    mouseDown(a);
    keyDown("]", { ctrlKey: true }, a);
    setEditableText("z");
    keyDown("Enter");
    expect(cmb.getValue().replace(/\s+/g, " ")).toBe("if c then { a; z }");
    expect(body().map(String)).toEqual(["a", "z"]);
    expect(types(cmb.getValue())).toBe(
      [...cmb.getAst().descendants()].map((n) => n.type).join(" ")
    );
  });
});
