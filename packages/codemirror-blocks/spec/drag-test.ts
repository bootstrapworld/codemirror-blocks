import wescheme from "../src/languages/wescheme";
import "codemirror/addon/search/searchcursor.js";

/*eslint no-unused-vars: "off"*/
import {
  teardown,
  mouseDown,
  dragstart,
  drop,
  dragenter,
  dragenterSeq,
  dragleave,
  keyDown,
  finishRender,
  mountCMB,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { ASTNode } from "../src/ast";
import { FunctionApp } from "../src/nodes";
import { fireEvent } from "@testing-library/react";

describe("Drag and drop", () => {
  let cmb!: API;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);
  });

  afterEach(teardown);

  describe("when drag existing node and drop on existing node,", () => {
    let firstArg: ASTNode;
    let secondArg: ASTNode;
    let dropTargetEls: NodeListOf<Element>;

    const retrieve = () => {
      const funcApp = cmb.getAst().rootNodes[0] as FunctionApp;
      firstArg = funcApp.fields.args[0];
      secondArg = funcApp.fields.args[1];
      dropTargetEls = cmb
        .getAst()
        .rootNodes[0].element!.querySelectorAll(".blocks-drop-target");
    };

    beforeEach(async () => {
      cmb.setValue("(+ 1 2 3)");
      await finishRender();
      retrieve();
    });

    it("should override nodes 1", () => {
      expect(secondArg.element!.textContent).toBe("2");
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      fireEvent(secondArg.element!, drop());
      retrieve();
      expect(secondArg.element!.textContent).toBe("3");
    });

    it("should set the right css class on dragenter 2", () => {
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      const elt = dropTargetEls[3];
      expect(elt.classList).toContain("blocks-drop-target");
      dragenterSeq(elt);
      expect(elt.classList).toContain("blocks-over-target");
    });

    it("should set the right css class on dragenter 2’", () => {
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      const elt = secondArg;
      dragenterSeq(elt);
    });

    it("should set the right css class on dragleave 3", () => {
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      const elt = dropTargetEls[3];
      dragenter();
      dragleave();
      expect(elt.classList).not.toContain("blocks-over-target");
    });

    it("should do nothing when dragging over a non-drop target 4", () => {
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      const nonDT = cmb.getAst().rootNodes[0].element!;
      dragenterSeq(nonDT);
      expect(secondArg.element!.classList).not.toContain("blocks-over-target");
    });

    it("should do nothing when dropping onto a non-drop target 5", () => {
      const initialValue = cmb.getValue();
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      const nonDT = cmb.getAst().rootNodes[0].element!;
      fireEvent(nonDT, drop());
      expect(cmb.getValue()).toBe(initialValue);
    });

    it("should update the text on drop to a later point in the file 6", () => {
      expect(dropTargetEls[3].classList).toContain("blocks-drop-target");
      // drag the first arg to the drop target
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      fireEvent(dropTargetEls[3], drop());
      expect(cmb.getValue().replace(/\s+/, " ")).toBe("(+ 2 3 1)");
    });

    it("should update the text on drop to an earlier point in the file 7", () => {
      const dragEvent = dragstart();
      fireEvent(secondArg.element!, dragEvent);
      fireEvent(dropTargetEls[0], drop());
      expect(cmb.getValue().replace("  ", " ")).toBe("(+ 2 1 3)");
    });

    /*
    it('should move an item to the top level when dragged outside a node 8', function() {
      debugLog('################ 8');
      let dragEvent = dragstart();
      fireEvent(secondArg.element,dragEvent);
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = cmb.getAst().rootNodes[0].element;
      let wrapperEl = cmb.getWrapperElement();
      // These two show up as undefined in monitor.getClientOffset ?
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      fireEvent(nodeEl.parentElement,dropEvent);
      expect(cmb.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      debugLog('%%%%%%%%%%%%%%%% 8');
    });
    */

    it("should replace a literal that you drag onto 9", () => {
      const dragEvent = dragstart();
      fireEvent(firstArg.element!, dragEvent);
      fireEvent(secondArg.element!, drop());
      expect(cmb.getValue().replace(/\s+/, " ")).toBe("(+ 1 3)");
    });

    // these two tests seem to fail because dragend is not called.
    // see https://github.com/react-dnd/react-dnd/issues/455 for more info

    /*
    it('should support dragging plain text to replace a literal 10', function() {
      debugLog('################ 10');
      let elt1 = firstArg.element;
      let dragEvent = dragstart();
      fireEvent(elt1,dragEvent);
      dragEvent.dataTransfer = new DataTransfer();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      fireEvent(elt1,dragend());
      fireEvent(firstArg.element,drop(dragEvent.dataTransfer));
      //expect(cmb.getValue().replace(/\s+/, ' ')).toBe('(+ 5000 2 3)');
      debugLog('%%%%%%%%%%%%%%%% 10');
    });
    */

    /*
    it('should support dragging plain text onto some whitespace 11', function() {
      debugLog('################ 11');
      let dragEvent = dragstart();
      dragEvent.dataTransfer = new DataTransfer();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = cmb.getAst().rootNodes[0].element;
      let wrapperEl = cmb.getWrapperElement();
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      fireEvent(nodeEl.parentElement,dropEvent);
      expect(cmb.getValue().replace('  ', ' ')).toBe('(+ 1 2 3)\n5000');
      debugLog('%%%%%%%%%%%%%%%% 11');
    });
    */
    // TODO(pcardune) reenable
    xit("save collapsed state when dragging root to be the last child of the next root", async () => {
      cmb.setValue("(collapse me)\n(+ 1 2)");
      await finishRender();
      let firstRoot!: ASTNode;
      let lastDropTarget!: Element;
      const retrieve = () => {
        firstRoot = cmb.getAst().rootNodes[0];
        lastDropTarget = document.querySelectorAll(".blocks-drop-target")[4];
      };
      retrieve();

      mouseDown(firstRoot); // click the root
      keyDown("ArrowLeft", {}, firstRoot); // collapse it
      expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");
      expect(firstRoot.nid).toBe(0);
      const dragEvent = dragstart();
      fireEvent(firstRoot.element!, dragEvent); // drag to the last droptarget
      fireEvent(lastDropTarget, drop());
      await finishRender();
      retrieve();
      const newFirstRoot = cmb.getAst().rootNodes[0] as FunctionApp;
      const newLastChild = newFirstRoot.fields.args[2];
      expect(cmb.getValue()).toBe("\n(+ 1 2 (collapse me))");
      expect(newFirstRoot.element!.getAttribute("aria-expanded")).toBe("true");
      expect(newLastChild.element!.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("corner cases", () => {
    let source!: ASTNode;
    let target1!: Element;
    let target2!: Element;

    const retrieve = () => {
      source = cmb.getAst().rootNodes[0];
      target1 = document.querySelectorAll(".blocks-drop-target")[1];
      target2 = document.querySelectorAll(".blocks-drop-target")[2];
    };

    beforeEach(async () => {
      cmb.setValue(";comment\n(a)\n(c)\n(define-struct e ())\ng");
      await finishRender();
      retrieve();
    });

    afterEach(() => {
      teardown();
    });

    // TODO(pcardune) reenable
    xit("regression test for unstable block IDs", async () => {
      const dragEvent = dragstart();
      fireEvent(source.element!, dragEvent); // drag to the last droptarget
      fireEvent(target1, drop());
      await finishRender();
    });

    // TODO(pcardune) reenable
    xit("regression test for empty identifierLists returning a null location", async () => {
      const dragEvent = dragstart();
      fireEvent(source.element!, dragEvent); // drag to the last droptarget
      fireEvent(target2, drop());
      await finishRender();
    });
  });
});
