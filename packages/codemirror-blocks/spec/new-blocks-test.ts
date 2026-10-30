import CodeMirror from "codemirror";
import { act } from "@testing-library/react";
import { AST, ASTNode } from "../src/ast";
import type { API } from "../src/CodeMirrorBlocks";
import wescheme from "../src/languages/wescheme";
import { FunctionAppNode } from "../src/nodes";
import { AppStore } from "../src/state/store";
import * as actions from "../src/state/actions";

import {
  teardown,
  click,
  mouseDown,
  keyDown,
  mountCMB,
  isNodeEditable,
  blur,
} from "../src/toolkit/test-utils";
import { Pos } from "../src/editor";
import { setEditableText } from "./helpers/editing";

describe("The CodeMirrorBlocks Class", function () {
  let cmb!: API;
  let store!: AppStore;
  const setQuarantine = (start: Pos, end: Pos, text: string) =>
    act(() => {
      store.dispatch(actions.setQuarantine(start, end, text));
    });
  beforeEach(() => {
    const mounted = mountCMB(wescheme);
    cmb = mounted.cmb;
    store = mounted.store;
  });

  afterEach(function () {
    teardown();
  });

  describe("constructor,", function () {
    it("should create an empty editor", function () {
      const ast = cmb.getAst();
      expect(cmb.getBlockMode()).toBe(true); //broken
      expect(ast.rootNodes.length).toBe(0);
    });

    it("should set block mode to false", function () {
      cmb.setBlockMode(false);
      expect(cmb.getBlockMode()).toBe(false);
    });
  });
  describe("events,", function () {
    let literal!: ASTNode;
    beforeEach(async function () {
      cmb.setValue("11");
      literal = cmb.getAst().rootNodes[0];
    });

    describe("when dealing with top-level input,", function () {
      beforeEach(async function () {
        cmb.setValue("42\n11");
      });
      it("typing at the end of a line", async function () {
        act(() => {
          setQuarantine(
            {
              line: 0,
              ch: 2,
              sticky: "before",
              xRel: 400,
            } as CodeMirror.Position,
            {
              line: 0,
              ch: 2,
              sticky: "before",
              xRel: 400,
            } as CodeMirror.Position,
            "9"
          );
        });
        keyDown("Enter");
        expect(cmb.getValue()).toEqual("42\n9\n11");
      });
      it("typing at the beginning of a line", async function () {
        setQuarantine(
          { line: 0, ch: 0, xRel: 0 } as CodeMirror.Position,
          { line: 0, ch: 0, xRel: 0 } as CodeMirror.Position,
          "9"
        );
        keyDown("Enter");
        expect(cmb.getValue()).toEqual("9\n42\n11");
      });
      it("typing between two blocks on a line", async function () {
        setQuarantine(
          { line: 0, ch: 3, xRel: 0 } as CodeMirror.Position,
          { line: 0, ch: 3, xRel: 0 } as CodeMirror.Position,
          "9"
        );
        keyDown("Enter");
        expect(cmb.getValue()).toEqual("42\n9\n11");
      });

      // TODO: figure out how to fire a paste event
    });
    it("should not allow required blanks to be deleted", async function () {
      cmb.setValue("()");
      // the parser fills in the missing function name with a blank
      expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
        "(...)",
      ]);
      const blank = (cmb.getAst().rootNodes[0] as FunctionAppNode).fields.func;
      click(blank.element!);
      expect(isNodeEditable(blank)).toBe(true);
      keyDown("Delete");
      // deleting the blank is a no-op
      expect(cmb.getValue()).toBe("()");
      expect(cmb.getAst().rootNodes.map((n) => n.toString())).toEqual([
        "(...)",
      ]);
    });

    it("should return the node being edited on ESC", async function () {
      click(literal);
      expect(isNodeEditable(literal)).toBe(true);
      const quarantine = document.activeElement;
      keyDown("Escape", {}, quarantine!);
      expect(cmb.getValue()).toEqual("11");
      expect(isNodeEditable(literal)).toBe(false);
    });

    it("should stop editing the node on enter, leaving an unchanged value alone", async function () {
      click(literal);
      expect(isNodeEditable(literal)).toBe(true);
      keyDown("Enter");
      expect(isNodeEditable(literal)).toBe(false);
      expect(cmb.getValue()).toEqual("11");
      expect(document.activeElement).toHaveAttribute("role", "treeitem");
    });

    // (a real click elsewhere is covered in e2e/typing.e2e.ts: jsdom doesn't
    // move focus on a click, so here focus is taken away explicitly)
    it("should stop editing the node when focus leaves it", async function () {
      click(literal.element!);
      expect(isNodeEditable(literal)).toBe(true);
      blur(document.activeElement!);
      expect(isNodeEditable(literal)).toBe(false);
      expect(cmb.getValue()).toEqual("11");
    });

    describe("when dealing with whitespace,", function () {
      let ast!: AST;
      let firstRoot!: ASTNode;
      let firstArg!: ASTNode;
      let whiteSpaceEl!: Element;
      let blank!: FunctionAppNode;

      beforeEach(async function () {
        cmb.setValue("(+ 1 2) (+)");
        ast = cmb.getAst();
        firstRoot = ast.rootNodes[0];
        firstArg = (ast.rootNodes[0] as FunctionAppNode).fields.args[0];
        whiteSpaceEl = firstArg.element!.nextElementSibling!;
        blank = ast.rootNodes[1] as FunctionAppNode;
      });

      it("Ctrl-[ should jump to the left of a top-level node", function () {
        mouseDown(firstRoot.element!);
        keyDown("[", { ctrlKey: true }, firstRoot.element!);
        const cursor = cmb.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(0);
      });

      it("Ctrl-] should jump to the right of a top-level node", function () {
        mouseDown(firstRoot.element!);
        keyDown("]", { ctrlKey: true }, firstRoot.element!);
        const cursor = cmb.getCursor();
        expect(cursor.line).toBe(0);
        expect(cursor.ch).toBe(7);
      });

      /** type into whatever editable element the key or click just opened */
      const typeAndSave = (text: string) => {
        expect(document.activeElement).toHaveAttribute(
          "contenteditable",
          "true"
        );
        setEditableText(text);
        keyDown("Enter");
      };

      it("Ctrl-[ should open an insertion to the left of an argument", async function () {
        mouseDown(firstArg.element!);
        keyDown("[", { ctrlKey: true });
        typeAndSave("9");
        expect(cmb.getValue()).toBe("(+ 9 1 2) (+)");
      });

      it("Ctrl-] should open an insertion to the right of an argument", async function () {
        mouseDown(firstArg.element!);
        keyDown("]", { ctrlKey: true }, firstArg.element!);
        typeAndSave("9");
        expect(cmb.getValue()).toBe("(+ 1 9 2) (+)");
      });

      it("Ctrl-] should open an insertion in the first arg position", async function () {
        mouseDown(blank.fields.func.element!);
        keyDown("]", { ctrlKey: true }, blank.fields.func.element!);
        typeAndSave("9");
        expect(cmb.getValue()).toBe("(+ 1 2) (+ 9)");
      });

      it("should open an insertion when the whitespace between arguments is clicked", async function () {
        click(whiteSpaceEl);
        typeAndSave("9");
        expect(cmb.getValue()).toBe("(+ 1 9 2) (+)");
      });

      describe("in corner-cases with no arguments,", function () {
        let argWS!: ChildNode;

        beforeEach(async function () {
          cmb.setValue("(f)");
          const firstRoot = cmb.getAst().rootNodes[0];
          argWS =
            firstRoot.element!.getElementsByClassName("blocks-args")[0]
              .firstChild!;
        });

        it("should allow editing the argument whitespace", async function () {
          click(argWS);
          typeAndSave("9");
          expect(cmb.getValue()).toBe("(f 9)");
        });
      });
    });
  });
});
