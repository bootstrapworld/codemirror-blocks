import wescheme from "../src/languages/wescheme";

/*eslint no-unused-vars: "off"*/
import {
  mac,
  cmd_ctrl,
  wait,
  removeEventListeners,
  teardown,
  activationSetup,
  click,
  mouseDown,
  mouseenter,
  mouseover,
  mouseleave,
  doubleClick,
  blur,
  paste,
  cut,
  copy,
  dragstart,
  dragover,
  drop,
  dragenter,
  dragenterSeq,
  dragend,
  dragleave,
  keyDown,
  keyPress,
  insertText,
  finishRender,
} from "../src/toolkit/test-utils";

console.log("Doing focus-test.js");

// be sure to call with `apply` or `call`
let setup = async function () {
  await activationSetup.call(this, wescheme);
};

describe("The CodeMirrorBlocks Class", function () {
  beforeEach(async function () {
    await setup.call(this);
  });

  afterEach(function () {
    teardown();
  });

  describe("focusing,", function () {
    beforeEach(async function () {
      this.cmb.setValue("(+ 1 2 3)");
      await finishRender(this.cmb);
      this.expression = this.cmb.getAst().rootNodes[0];
      this.func = this.expression.func;
      this.literal1 = this.expression.args[0];
      this.literal2 = this.expression.args[1];
      this.literal3 = this.expression.args[2];
    });

    it("tabbing to the editor for the first time should activate node 0", async function () {
      this.cmb.focus();
      expect(this.cmb.getFocusedNode().nid).toBe(0);
    });

    it("deleting the last node should shift focus to the next-to-last", async function () {
      mouseDown(this.literal3);
      await finishRender(this.cmb);
      expect(document.activeElement).toBe(this.literal3.element);
      keyDown(" ");
      keyDown("Delete");
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe("(+ 1 2)");
      expect(this.cmb.getFocusedNode().id).toBe(this.literal2.id);
    });

    it("deleting the first node should shift focus to the parent", async function () {
      mouseDown(this.literal1);
      await finishRender(this.cmb);
      expect(document.activeElement).toBe(this.literal1.element);
      keyDown(" ");
      keyDown("Delete");
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe("(+ 2 3)");
      expect(this.cmb.getFocusedNode().id).toBe(this.func.id);
    });

    it("deleting the nth node should shift focus to n-1", async function () {
      mouseDown(this.literal2);
      await finishRender(this.cmb);
      expect(document.activeElement).toBe(this.literal2.element);
      keyDown(" ");
      keyDown("Delete");
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe("(+ 1 3)");
      expect(this.cmb.getFocusedNode().id).toBe(this.literal1.id);
    });

    it("deleting multiple nodes should shift focus to the one before", async function () {
      mouseDown(this.literal2);
      await finishRender(this.cmb);
      keyDown(" ");
      keyDown("ArrowDown");
      keyDown(" ", {}, this.literal3);
      await finishRender(this.cmb);
      expect(this.cmb.getSelectedNodes().length).toBe(2);
      keyDown("Delete");
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe("(+ 1)");
      expect(this.cmb.getFocusedNode().id).toBe(this.literal1.id);
    });

    it("inserting a node should put focus on the new node", async function () {
      mouseDown(this.literal1);
      await finishRender(this.cmb);
      keyDown("]", { ctrlKey: true });
      await finishRender(this.cmb);
      insertText("99"); // in place of 2x keydown
      keyDown("Enter");
      await finishRender(this.cmb);
      // extra WS is removed when we switch back to text, but in blockmode
      // there's an extra space inserted after 99
      expect(this.cmb.getValue()).toBe("(+ 1 99 2 3)");
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.cmb.getFocusedNode().value).toBe("99");
    });

    it("inserting multiple nodes should put focus on the last of the new nodes", async function () {
      mouseDown(this.literal1);
      await finishRender(this.cmb);
      keyDown("]", { ctrlKey: true });
      await finishRender(this.cmb);
      insertText("99 88 77");
      keyDown("Enter");
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe("(+ 1 99 88 77 2 3)");
      // TODO(Emmanuel): does getFocusedNode().value always return strings?
      expect(this.cmb.getFocusedNode().value).toBe("77");
    });
  });
});
