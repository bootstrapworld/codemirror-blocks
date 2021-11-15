import { act } from "@testing-library/react";
import { API } from "../src/CodeMirrorBlocks";
import { Pos } from "../src/editor";
import wescheme from "../src/languages/wescheme";
import * as actions from "../src/state/actions";
import { AppStore } from "../src/state/store";

import { teardown, mountCMB, keyDown } from "../src/toolkit/test-utils";

describe("When editing and moving commented nodes", () => {
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

  afterEach(() => {
    teardown();
  });

  describe("inserting comments", () => {
    beforeEach(() => {
      cmb.setValue(`
(comment free)
1; comment1
#| comment2 |#
2`);
    });

    it("when the mode is toggled, it should reformat all comments as block comments", () => {
      cmb.setBlockMode(false);
      // the opening whitespace should be removed!
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });

    it("you should be able to insert a commented node after a commented node", () => {
      const commentedNode = cmb.getAst().rootNodes[2];
      expect(commentedNode.toString()).toMatchInlineSnapshot(`
        "#| comment2 |#
        2"
      `);
      setQuarantine(commentedNode.to, commentedNode.to, "1 #| comment1 |#");
      keyDown("Enter");
      cmb.setBlockMode(false);
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2
1 #| comment1 |#`);
    });

    it("you should be able to insert a commented node after an uncommented node", () => {
      const uncommentedNode = cmb.getAst().rootNodes[0];
      expect(uncommentedNode.toString()).toMatchInlineSnapshot(
        `"(comment free)"`
      );
      setQuarantine(uncommentedNode.to, uncommentedNode.to, "1 #| comment1 |#");
      keyDown("Enter");
      cmb.setBlockMode(false);
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
1 #| comment1 |#
#| comment2 |#
2`);
    });
  });
});
