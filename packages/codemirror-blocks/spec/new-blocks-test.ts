import CodeMirror from "codemirror";
import { act } from "react-dom/test-utils";
import { AST, ASTNode } from "../src/ast";
import type { API } from "../src/CodeMirrorBlocks";
import wescheme from "../src/languages/wescheme";
import { FunctionAppNode } from "../src/nodes";

import {
  teardown,
  click,
  mouseDown,
  keyDown,
  mountCMB,
  isNodeEditable,
} from "../src/toolkit/test-utils";

describe("The CodeMirrorBlocks Class", function () {
  let cmb!: API;
  beforeEach(async function () {
    cmb = await mountCMB(wescheme);
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
  /*
  // Should we make the language prop accessible externally so we can run this?
  it('should optionally take a language object', function() {
     const b = new CodeMirrorBlocks(
      document.getElementById('root'), 
      {value: "", incrementalRendering: false }, 
      example);
     expect(b.language.id).toBe('example');
  });
  */
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
          cmb.setQuarantine(
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
        act(() => {
          cmb.setQuarantine(
            { line: 0, ch: 0, xRel: 0 } as CodeMirror.Position,
            { line: 0, ch: 0, xRel: 0 } as CodeMirror.Position,
            "9"
          );
        });
        keyDown("Enter");
        expect(cmb.getValue()).toEqual("9\n42\n11");
      });
      it("typing between two blocks on a line", async function () {
        act(() => {
          cmb.setQuarantine(
            { line: 0, ch: 3, xRel: 0 } as CodeMirror.Position,
            { line: 0, ch: 3, xRel: 0 } as CodeMirror.Position,
            "9"
          );
        });
        keyDown("Enter");
        expect(cmb.getValue()).toEqual("42\n9\n11");
      });

      // TODO: figure out how to fire a paste event
    });
    /*
    it('should begin editing a node on click', async function() {
      click(literal);
      await finishRender();
      expect(document.activeElement.classList).toContain('blocks-editing');
    });
    
    it('should save a valid, edited node on blur', async function() {
      click(literal);
      await finishRender();
      insertText("9");
      await finishRender();
      keyDown("Enter");
      await finishRender();
      expect(cmb.getValue()).toEqual('9');
    })
    */
    it("should not allow required blanks to be deleted", async function () {
      cmb.setValue("()");
      cmb.getValue("(...)"); // blank should be inserted by parser, as '...'
      const blank = (cmb.getAst().rootNodes[0] as FunctionAppNode).fields.func;
      click(blank.element!);
      expect(isNodeEditable(blank)).toBe(true);
      keyDown("Delete");
      cmb.getValue("(...)"); // deleting the blank should be a no-op
    });

    it("should return the node being edited on ESC", async function () {
      click(literal);
      const quarantine = document.activeElement;
      keyDown("Escape", {}, quarantine!);
      expect(cmb.getValue()).toEqual("11");
    });

    it("should blur the node being edited on enter", async function () {
      click(literal);
      keyDown("Enter");
      expect(document.activeElement).not.toBe(undefined);
    });

    it("should blur the node being edited on top-level click", async function () {
      click(literal.element!);
      click(cmb.getWrapperElement());
      expect(document.activeElement).not.toBe(undefined);
    });

    xdescribe('when "saving" bad inputs,', function () {
      // beforeEach(async function () {
      //   spyOn(cmb, "replaceRange");
      //   click(literal.element);
      //   let quarantine = document.activeElement;
      //   let selection = window.getSelection();
      //   expect(selection.rangeCount).toEqual(1);
      //   let range = selection.getRangeAt(0);
      //   range.deleteContents();
      //   range.insertNode(document.createTextNode('"moo'));
      //   blur(quarantine);
      // });
      /*it('should not save anything & set all error state', function() {
        let quarantine = document.activeElement;//trackSetQuarantine.calls.mostRecent().returnValue;
        expect(cmb.replaceRange).not.toHaveBeenCalled();
        expect(quarantine.classList).toContain('blocks-error');
        expect(quarantine.title).toBe('Error: parse error');
        expect(cmb.hasInvalidEdit).toBe(quarantine);
      });*/
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

      it("Ctrl-[ should activate a quarantine to the left", async function () {
        mouseDown(firstArg.element!);
        keyDown("[", { ctrlKey: true });
        //expect(cmb.setQuarantine).toHaveBeenCalled();
      });

      it("Ctrl-] should activate a quarantine to the right", async function () {
        mouseDown(firstArg.element!);
        keyDown("]", { ctrlKey: true }, firstArg.element!);
        //expect(cmb.setQuarantine).toHaveBeenCalled();
      });

      it("Ctrl-] should activate a quarantine in the first arg position", async function () {
        mouseDown(blank.fields.func.element!);
        keyDown("]", { ctrlKey: true }, blank.fields.func.element!);
        //expect(cmb.setQuarantine).toHaveBeenCalled();
      });

      it("should activate a quarantine on dblclick", async function () {
        click(whiteSpaceEl);
        //expect(cmb.setQuarantine).toHaveBeenCalled();
      });

      describe("in corner-cases with no arguments,", function () {
        let ast!: AST;
        let firstRoot!: ASTNode;
        let argWS!: ChildNode;

        beforeEach(async function () {
          cmb.setValue("(f)");
          ast = cmb.getAst();
          firstRoot = ast.rootNodes[0];
          argWS =
            firstRoot.element!.getElementsByClassName("blocks-args")[0]
              .firstChild!;
        });

        it("should allow editing the argument whitespace", async function () {
          /* left off here*/
          click(argWS);
          //expect(cmb.setQuarantine).toHaveBeenCalled();
        });
      });

      describe("and specifically when editing it,", function () {
        // fails nondeterministically - figure out how to avoid
        // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
        // it('should save whiteSpace on blur', async function() {
        //   fireEvent(whiteSpaceEl, dblclick());
        //   expect(trackSetQuarantine).toHaveBeenCalledWith("", whiteSpaceEl);
        //   let quarantine = trackSetQuarantine.calls.mostRecent().returnValue;
        //   let trackOnBlur = spyOn(quarantine, 'onblur').and.callThrough();
        //   quarantine.appendChild(document.createTextNode('4253'));
        //   fireEvent(quarantine, blur());
        //   expect(trackOnBlur).toHaveBeenCalled();
        //   expect(trackSaveEdit).toHaveBeenCalledWith(quarantine);
        //   expect(quarantine.textContent).toBe('4253'); // confirms text=4253 inside saveEdit, blocks.js line 495
        //   expect(trackCommitChange).toHaveBeenCalled();
        //   expect(trackReplaceRange).toHaveBeenCalledWith(' 4253', Object({ ch: 4, line: 0 }), Object({ ch: 4, line: 0 }));
        //   expect(cmb.getValue()).toBe('(+ 1 4253 2) (+)');
        //   expect(cmb.hasInvalidEdit).toBe(false);
        // });

        // not sure how to handle trackChange
        // it('should blur whitespace you are editing on enter', async function() {
        //   fireEvent(whiteSpaceEl, dblclick());
        //   let quarantine = trackSetQuarantine.calls.mostRecent().returnValue;
        //   fireEvent(quarantine, keydown(ENTER));
        //   expect(trackHandleChange).toHaveBeenCalled();
        // });

        xdescribe('when "saving" bad whitepspace inputs,', function () {
          // beforeEach(async function () {
          // fireEvent(whiteSpaceEl, dblclick());
          // quarantine = trackSetQuarantine.calls.mostRecent().returnValue;
          // quarantine.appendChild(document.createTextNode('"moo'));
          // fireEvent(quarantine, blur());
          // });
          // fails nondeterministically - figure out how to avoid
          // see https://github.com/bootstrapworld/codemirror-blocks/issues/123
          // it('should not save anything & set all error state', async function() {
          //   expect(trackSaveEdit).toHaveBeenCalledWith(quarantine);
          //   expect(quarantine.textContent).toBe('"moo');
          //   expect(cmb.replaceRange).not.toHaveBeenCalled();
          //   expect(quarantine.classList).toContain('blocks-error');
          //   expect(quarantine.title).toBe('Error: parse error');
          //   expect(cmb.hasInvalidEdit).toBe(true);
          // });
        });
      });
    });
  });
});
