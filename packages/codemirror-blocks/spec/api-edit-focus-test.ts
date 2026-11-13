import { act } from "@testing-library/react";
import wescheme from "@bootstrapworld/wescheme";
import { API } from "../src/CodeMirrorBlocks";
import type { ASTNode } from "../src/ast";
import {
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { setEditableText } from "./helpers/editing";

/**
 * A change made through the API does not move the block that has focus, if that
 * block is still there: the editor's idea of it and the keyboard stay together.
 */
let cmb!: API;
const frames = (n = 4) =>
  act(
    () =>
      new Promise<void>((done) => {
        const step = (i: number) =>
          i === 0 ? done() : requestAnimationFrame(() => step(i - 1));
        step(n);
      })
  );
// (the second root, and the block inside it that has focus)
const focusInSecondRoot = async () => {
  const node = (
    cmb.getAst().rootNodes[1] as unknown as {
      fields: { args: { id: string }[] };
    }
  ).fields.args[1];
  const block = cmb.getAst().getNodeByIdOrThrow(node.id);
  mouseDown(block);
  elementForNode(block)!.focus();
  await frames();
  return block.id;
};

beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
  cmb.setValue("(a b)\n(+ 1 2 3)");
});
afterEach(() => teardown());

describe("a change through the API, while a block has keyboard focus", () => {
  it("replaceRange in another root leaves focus on that block", async () => {
    const id = await focusInSecondRoot();
    cmb.replaceRange("(a bb c)", { line: 0, ch: 0 }, { line: 0, ch: 5 });
    await frames();
    expect(cmb.getValue()).toBe("(a bb c)\n(+ 1 2 3)");
    expect(cmb.getFocusedNode()?.id).toBe(id);
    expect(document.activeElement).toBe(
      elementForNode(cmb.getAst().getNodeByIdOrThrow(id))
    );
  });

  it("setValue that keeps the block leaves focus on it", async () => {
    const id = await focusInSecondRoot();
    cmb.setValue("(a bb c)\n(+ 1 2 3)");
    await frames();
    expect(cmb.getFocusedNode()?.id).toBe(id);
    expect(document.activeElement).toBe(
      elementForNode(cmb.getAst().getNodeByIdOrThrow(id))
    );
  });

  it("setValue that removes the block moves focus to the first root, as before", async () => {
    await focusInSecondRoot();
    cmb.setValue("(z)\n(y)");
    await frames();
    expect(cmb.getFocusedNode()).toBe(cmb.getAst().rootNodes[0]);
  });

  it("with no block focused, focus goes to the first root, as before", async () => {
    cmb.replaceRange("(a bb c)", { line: 0, ch: 0 }, { line: 0, ch: 5 });
    await frames();
    expect(cmb.getFocusedNode()?.id).toBe(cmb.getAst().rootNodes[0].id);
  });
});

describe("a change through the API while an edit box is open on another root", () => {
  // The box stays open (the block it edits keeps focus), so it has to commit to
  // where the block is now, and nothing else may be overwritten.
  const editSecondRootLiteral = (value: string) => {
    const literal = (
      cmb.getAst().rootNodes[1] as unknown as { fields: { args: ASTNode[] } }
    ).fields.args[1];
    mouseDown(literal);
    keyDown("Enter", {}, literal);
    expect(document.activeElement).toHaveAttribute("contenteditable", "true");
    setEditableText(value);
  };
  const expectEditedBlockFocused = () => {
    const focused = cmb.getFocusedNode();
    expect(focused?.toString()).toBe("7");
    expect(document.activeElement).toBe(elementForNode(focused!));
  };

  it("commits to the block's new place when the change adds a line and a length", async () => {
    editSecondRootLiteral("7");
    cmb.replaceRange("(a bb\nc)", { line: 0, ch: 0 }, { line: 0, ch: 5 });
    keyDown("Enter");
    await frames();
    expect(cmb.getValue()).toBe("(a bb\nc)\n(+ 1 7 3)");
    expectEditedBlockFocused();
  });

  it("commits to the block's new place when the change is before it on its line", async () => {
    cmb.setValue("(a b) (+ 1 2 3)");
    editSecondRootLiteral("7");
    cmb.replaceRange("(a bbbb)", { line: 0, ch: 0 }, { line: 0, ch: 5 });
    keyDown("Enter");
    await frames();
    expect(cmb.getValue()).toBe("(a bbbb) (+ 1 7 3)");
    expectEditedBlockFocused();
  });
});
