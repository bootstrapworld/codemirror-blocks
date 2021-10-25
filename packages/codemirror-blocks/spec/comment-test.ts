import { ASTNode } from "../src/ast";
import { API } from "../src/CodeMirrorBlocks";
import wescheme from "../src/languages/wescheme";

import {
  wait,
  teardown,
  click,
  finishRender,
  mountCMB,
} from "../src/toolkit/test-utils";

const QUARANTINE_DELAY = 2000;

describe("When editing and moving commented nodes", function () {
  let cmb!: API;
  beforeEach(async function () {
    cmb = await mountCMB(wescheme);
  });

  afterEach(function () {
    teardown();
  });

  describe("inserting comments", function () {
    let expr0!: ASTNode;

    beforeEach(async function () {
      cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
      cmb.setBlockMode(true);
      await finishRender();
      const ast = cmb.getAst();
      expr0 = ast.rootNodes[0];
    });

    it("when the mode is toggled, it should reformat all comments as block comments", async function () {
      cmb.setBlockMode(false);
      await finishRender();
      // the opening whitespace should be removed!
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });

    // TODO(pcardune) reenable
    xit("you should be able to insert a commented node after a commented node", async function () {
      cmb.setQuarantine(
        { line: 3, ch: 1 },
        { line: 3, ch: 1 },
        "1 #| comment1 |#"
      );
      await wait(QUARANTINE_DELAY);
      click(expr0);
      await finishRender();
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2
1 #| comment1 |#`);
    });

    // TODO(pcardune) reenable
    xit("you should be able to insert a commented node after an uncommented node", async function () {
      cmb.setQuarantine(
        { line: 0, ch: 14 },
        { line: 0, ch: 14 },
        "1 #| comment1 |#"
      );
      await wait(QUARANTINE_DELAY);
      click(expr0);
      await finishRender();
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
1 #| comment1 |#
#| comment2 |#
2`);
    });
  });
});