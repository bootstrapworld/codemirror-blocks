import wescheme from "../src/languages/wescheme";
import lambda from "../src/languages/lambda";
import { Comment } from "../src/nodes";
import {
  isNodeEditable,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import * as announcer from "../src/announcer";

const here = { line: 0, ch: 0 };
const editComment = { ctrlKey: true, shiftKey: true };

afterEach(() => {
  jest.restoreAllMocks();
  teardown();
});

describe("how a language writes comments", () => {
  it("is declared by the language, if it has block comments", () => {
    expect(wescheme.blockComment).toEqual({ open: "#|", close: "|#" });
    expect(lambda.blockComment).toBeUndefined();
  });

  it("is what a comment is printed with", () => {
    const slashes = { open: "/*", close: "*/" };
    expect(
      Comment(here, here, "a b", { blockComment: slashes }).toString()
    ).toBe("/* a b */");
  });
});

describe("Edit Comment", () => {
  it("opens a box in a language with block comments", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)");
    const root = cmb.getAst().rootNodes[0];
    mouseDown(root);
    keyDown("]", editComment, root);
    expect(isNodeEditable(root)).toBe(false); // (the block itself stays a block)
    expect(document.activeElement?.getAttribute("contenteditable")).toBe(
      "true"
    );
  });

  it("says so, and opens nothing, in a language without them", () => {
    const say = jest.spyOn(announcer, "say");
    const { cmb } = mountCMB(lambda);
    cmb.setValue("f(x)");
    const root = cmb.getAst().rootNodes[0];
    mouseDown(root);
    keyDown("]", editComment, root);
    expect(say).toHaveBeenCalledWith("This language has no comments");
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
});
