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
import { debugLog } from "../src/utils";

debugLog("Doing drag-test.js");

describe("Drag and drop", () => {
  let cmb!: API;
  beforeEach(async () => {
    cmb = await mountCMB(wescheme);
  });

  afterEach(teardown);

  describe("when drag existing node and drop on existing node,", () => {
    let funcSymbol: ASTNode;
    let firstArg: ASTNode;
    let secondArg: ASTNode;
    let thirdArg: ASTNode;
    let dropTargetEls: NodeListOf<Element>;

    const retrieve = () => {
      const funcApp = cmb.getAst().rootNodes[0] as FunctionApp;
      funcSymbol = funcApp.func;
      firstArg = funcApp.args[0];
      secondArg = funcApp.args[1];
      thirdArg = funcApp.args[2];
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
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      secondArg.element!.dispatchEvent(drop());
      retrieve();
      expect(secondArg.element!.textContent).toBe("3");
    });

    it("should set the right css class on dragenter 2", () => {
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      let elt = dropTargetEls[3];
      expect(elt.classList).toContain("blocks-drop-target");
      dragenterSeq(elt);
      expect(elt.classList).toContain("blocks-over-target");
    });

    it("should set the right css class on dragenter 2’", () => {
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      let elt = secondArg;
      dragenterSeq(elt);
    });

    it("should set the right css class on dragleave 3", () => {
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      let elt = dropTargetEls[3];
      dragenter();
      dragleave();
      expect(elt.classList).not.toContain("blocks-over-target");
    });

    it("should do nothing when dragging over a non-drop target 4", () => {
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      let nonDT = cmb.getAst().rootNodes[0].element!;
      dragenterSeq(nonDT);
      expect(secondArg.element!.classList).not.toContain("blocks-over-target");
    });

    it("should do nothing when dropping onto a non-drop target 5", () => {
      let initialValue = cmb.getValue();
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      let nonDT = cmb.getAst().rootNodes[0].element!;
      nonDT.dispatchEvent(drop());
      expect(cmb.getValue()).toBe(initialValue);
    });

    it("should update the text on drop to a later point in the file 6", () => {
      expect(dropTargetEls[3].classList).toContain("blocks-drop-target");
      // drag the first arg to the drop target
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      dropTargetEls[3].dispatchEvent(drop());
      expect(cmb.getValue().replace(/\s+/, " ")).toBe("(+ 2 3 1)");
    });

    it("should update the text on drop to an earlier point in the file 7", () => {
      let dragEvent = dragstart();
      secondArg.element!.dispatchEvent(dragEvent);
      dropTargetEls[0].dispatchEvent(drop());
      expect(cmb.getValue().replace("  ", " ")).toBe("(+ 2 1 3)");
    });

    /*
    it('should move an item to the top level when dragged outside a node 8', function() {
      debugLog('################ 8');
      let dragEvent = dragstart();
      secondArg.element.dispatchEvent(dragEvent);
      let dropEvent = drop(dragEvent.dataTransfer);
      let nodeEl = cmb.getAst().rootNodes[0].element;
      let wrapperEl = cmb.getWrapperElement();
      // These two show up as undefined in monitor.getClientOffset ?
      dropEvent.pageX = wrapperEl.offsetLeft + wrapperEl.offsetWidth - 10;
      dropEvent.pageY = nodeEl.offsetTop + wrapperEl.offsetHeight - 10;
      nodeEl.parentElement.dispatchEvent(dropEvent);
      expect(cmb.getValue().replace('  ', ' ')).toBe('(+ 1 3) 2');
      debugLog('%%%%%%%%%%%%%%%% 8');
    });
    */

    it("should replace a literal that you drag onto 9", () => {
      let dragEvent = dragstart();
      firstArg.element!.dispatchEvent(dragEvent);
      secondArg.element!.dispatchEvent(drop());
      expect(cmb.getValue().replace(/\s+/, " ")).toBe("(+ 1 3)");
    });

    // these two tests seem to fail because dragend is not called.
    // see https://github.com/react-dnd/react-dnd/issues/455 for more info

    /*
    it('should support dragging plain text to replace a literal 10', function() {
      debugLog('################ 10');
      let elt1 = firstArg.element;
      let dragEvent = dragstart();
      elt1.dispatchEvent(dragEvent);
      dragEvent.dataTransfer = new DataTransfer();
      dragEvent.dataTransfer.setData('text/plain', '5000');
      elt1.dispatchEvent(dragend());
      firstArg.element.dispatchEvent(drop(dragEvent.dataTransfer));
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
      nodeEl.parentElement.dispatchEvent(dropEvent);
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
      let retrieve = () => {
        firstRoot = cmb.getAst().rootNodes[0];
        lastDropTarget = document.querySelectorAll(".blocks-drop-target")[4];
      };
      retrieve();

      mouseDown(firstRoot); // click the root
      keyDown("ArrowLeft", {}, firstRoot); // collapse it
      expect(firstRoot.element!.getAttribute("aria-expanded")).toBe("false");
      expect(firstRoot.nid).toBe(0);
      let dragEvent = dragstart();
      firstRoot.element!.dispatchEvent(dragEvent); // drag to the last droptarget
      lastDropTarget.dispatchEvent(drop());
      await finishRender();
      retrieve();
      let newFirstRoot = cmb.getAst().rootNodes[0] as FunctionApp;
      let newLastChild = newFirstRoot.args[2];
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
      let dragEvent = dragstart();
      source.element!.dispatchEvent(dragEvent); // drag to the last droptarget
      target1.dispatchEvent(drop());
      await finishRender();
    });

    // TODO(pcardune) reenable
    xit("regression test for empty identifierLists returning a null location", async () => {
      let dragEvent = dragstart();
      source.element!.dispatchEvent(dragEvent); // drag to the last droptarget
      target2.dispatchEvent(drop());
      await finishRender();
    });
  });
});
