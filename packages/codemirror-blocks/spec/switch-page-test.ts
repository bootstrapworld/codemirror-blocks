import * as P from "pretty-fast-pretty-printer";
import wescheme from "@bootstrapworld/wescheme";
import { Languages, Nodes } from "../src/CodeMirrorBlocks";
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
 * No language of ours makes a multi-way Conditional, so this is one that does,
 * for the test: `(switch x (1 a) (2 b) (default c))` is a switch on x, with a
 * branch for each `(test steps...)` and the steps of `default` as its default.
 */
const word = (node: ASTNode) =>
  node.type === "literal" ? String(node.fields.value) : "";
const parts = (node: ASTNode) => {
  const { func, args } = node.fields as { func: ASTNode; args: ASTNode[] };
  return { func, args };
};
const isCall = (node: ASTNode) => node.type === "functionApp";

const { Conditional, ConditionalBranch } = Nodes.forLanguage({
  // (read back as `default`: the reader of WeScheme makes its own of `else`)
  Conditional: {
    pretty: (node) =>
      P.standardSexpr(node.fields.kind, [
        ...node.fields.header,
        ...node.fields.branches,
        ...(node.fields.otherwise.length
          ? [P.standardSexpr("default", node.fields.otherwise)]
          : []),
      ]),
  },
  ConditionalBranch: {
    pretty: (node) => P.standardSexpr(node.fields.test, node.fields.body),
  },
});

function switchify(node: ASTNode): ASTNode {
  if (!isCall(node)) return node;
  const { func, args } = parts(node);
  const kids = args.map(switchify);
  if (word(func) === "switch") {
    const [subject, ...rest] = kids;
    const last = rest[rest.length - 1];
    const hasDefault =
      last && isCall(last) && word(parts(last).func) === "default";
    const branches = (hasDefault ? rest.slice(0, -1) : rest).map((b) =>
      isCall(b)
        ? ConditionalBranch(b.from, b.to, {
            test: parts(b).func,
            body: parts(b).args,
          })
        : b
    );
    return Conditional(
      node.from,
      node.to,
      {
        kind: "switch",
        header: [subject],
        branches,
        otherwise: hasDefault ? parts(last).args : [],
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
  id: "switch-page-test",
  name: "A switch, for a test",
  parse: (code: string) => wescheme.parse(code).map(switchify),
  getExceptionMessage: (e: unknown) => String(e),
});

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(language).cmb;
  cmb.setValue("(switch x (1 a) (2 b) (default c))");
  cmb.clearHistory();
});
afterEach(() => teardown());

const root = () => cmb.getAst().rootNodes[0];
const f = () =>
  root().fields as unknown as {
    header: ASTNode[];
    branches: ASTNode[];
    otherwise: ASTNode[];
  };
const shape = (nodes: Iterable<ASTNode>) =>
  [...nodes].map((n) => n.type).join(" ");
const typeOf = () => shape(cmb.getAst().descendants());
const reparsed = () => shape(language.buildAST(cmb.getValue()).descendants());
const focused = () => cmb.getFocusedNode()?.toString();

describe("a switch in a page", () => {
  it("is read as a conditional of a subject, branches and a default", () => {
    expect(root().type).toBe("conditional");
    expect(f().header.map(String)).toEqual(["x"]);
    expect(f().branches.map((b) => b.type)).toEqual([
      "conditionalBranch",
      "conditionalBranch",
    ]);
    expect(f().otherwise.map(String)).toEqual(["c"]);
    expect(root().describe(1)).toBe("a switch with 2 branches and an else");
    expect(cmb.getValue()).toBe("(switch x (1 a) (2 b) (default c))");
  });

  it("is drawn: the kind, the subject in a row, the branches in a column, the default", () => {
    const block = document.querySelector(".blocks-conditional")!;
    expect(block.querySelector(":scope > .blocks-operator")?.textContent).toBe(
      "switch"
    );
    const header = block.querySelector(":scope > .blocks-conditional-header")!;
    expect(header.querySelectorAll(".blocks-drop-target")).toHaveLength(0);
    const branches = block.querySelector(
      ":scope > .blocks-conditional-branches"
    )!;
    expect(
      branches.querySelectorAll(":scope > .blocks-conditionalBranch")
    ).toHaveLength(2);
    expect(block.querySelector(".blocks-conditional-else")).not.toBeNull();
  });

  it("is walked with the arrow keys: the subject, then each branch with its test and steps", () => {
    mouseDown(root());
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      keyDown("ArrowDown");
      seen.push(focused());
    }
    expect(seen[0]).toBe("x");
    expect(seen[1]).toContain("1");
    expect(seen[2]).toBe("1");
    expect(seen[3]).toBe("a");
  });

  it("takes a branch, and gives one up, and reads back as it was printed", () => {
    const first = f().branches[0];
    mouseDown(first);
    keyDown("]", { ctrlKey: true }, first);
    setEditableText("(3 z)");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(switch x (1 a) (3 z) (2 b) (default c))");
    expect(f().branches.map((b) => b.type)).toEqual([
      "conditionalBranch",
      "conditionalBranch",
      "conditionalBranch",
    ]);
    expect(typeOf()).toBe(reparsed());
    const second = f().branches[1];
    mouseDown(second);
    keyDown(" ", {}, second);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(switch x (1 a) (2 b) (default c))");
    expect(typeOf()).toBe(reparsed());
  });

  it("leaves a blank when its subject is deleted, and is still a switch", () => {
    const subject = f().header[0];
    mouseDown(subject);
    keyDown(" ", {}, subject);
    keyDown("Delete");
    expect(cmb.getValue()).toBe("(switch ... (1 a) (2 b) (default c))");
    expect(root().type).toBe("conditional");
    expect(f().header.map((n) => n.type)).toEqual(["blank"]);
    expect(f().branches).toHaveLength(2);
    expect(typeOf()).toBe(reparsed());
  });
});
