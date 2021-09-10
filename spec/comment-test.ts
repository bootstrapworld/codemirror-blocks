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

console.log("Doing comment-test.js");

const QUARANTINE_DELAY = 2000;

// be sure to call with `apply` or `call`
let setup = function () {
  activationSetup.call(this, wescheme);
};

describe("When editing and moving commented nodes", function () {
  beforeEach(function () {
    setup.call(this);
  });

  afterEach(function () {
    teardown();
  });

  describe("inserting comments", function () {
    beforeEach(async function () {
      this.cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
      this.cmb.setBlockMode(true);
      await finishRender(this.cmb);
      let ast = this.cmb.getAst();
      this.expr0 = ast.rootNodes[0];
      this.expr1 = ast.rootNodes[1];
      this.expr2 = ast.rootNodes[2];
    });

    it("when the mode is toggled, it should reformat all comments as block comments", async function () {
      this.cmb.setBlockMode(false);
      await finishRender(this.cmb);
      // the opening whitespace should be removed!
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });

    it("you should be able to insert a commented node after a commented node", async function () {
      this.cmb.setQuarantine(
        { line: 3, ch: 1 },
        { line: 3, ch: 1 },
        "1 #| comment1 |#"
      );
      await wait(QUARANTINE_DELAY);
      click(this.expr0);
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2
1 #| comment1 |#`);
    });

    it("you should be able to insert a commented node after an uncommented node", async function () {
      this.cmb.setQuarantine(
        { line: 0, ch: 14 },
        { line: 0, ch: 14 },
        "1 #| comment1 |#"
      );
      await wait(QUARANTINE_DELAY);
      click(this.expr0);
      await finishRender(this.cmb);
      expect(this.cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
1 #| comment1 |#
#| comment2 |#
2`);
    });
  });
});
