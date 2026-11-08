import wescheme from "@bootstrapworld/wescheme";
import lambda from "@bootstrapworld/lambda";
import example from "@bootstrapworld/example";
import { addLanguage } from "../src/languages";
import { FunctionApp, Literal } from "../src/nodes";
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

/** A language that has no comments at all: `(+ 1 2)` is one call */
const plain = addLanguage({
  id: "plain-no-comments",
  name: "Plain",
  parse: (code: string) => [
    FunctionApp(
      { line: 0, ch: 0 },
      { line: 0, ch: code.length },
      {
        func: Literal(
          { line: 0, ch: 1 },
          { line: 0, ch: 2 },
          { value: "+", dataType: "symbol" }
        ),
        args: [],
      }
    ),
  ],
});
const editComment = { ctrlKey: true, shiftKey: true };

afterEach(() => {
  jest.restoreAllMocks();
  teardown();
});

describe("how a language writes comments", () => {
  it("is declared by the language, if it has block comments", () => {
    expect(wescheme.blockComment).toEqual({ open: "#|", close: "|#" });
    expect(lambda.blockComment).toEqual({ open: "#|", close: "|#" });
    expect(example.blockComment).toEqual({ open: "#|", close: "|#" });
    expect(plain.blockComment).toBeUndefined();
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
    const { cmb } = mountCMB(plain);
    cmb.setValue("(+ 1 2)");
    const root = cmb.getAst().rootNodes[0];
    mouseDown(root);
    keyDown("]", editComment, root);
    expect(say).toHaveBeenCalledWith("This language has no comments");
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
});
