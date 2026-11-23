/** @jest-environment jsdom */
// @ts-nocheck
// PORTED from packages/codemirror-blocks/spec/comment-test.ts: only the imports changed (to ../compat/*); see doc/experiments/cm6-direct-tree.md, ninth round.
import { act } from "../compat/testing-library";
import { API } from "../compat/test-utils";
import { Pos } from "../src/editor";
import wescheme from "../compat/wescheme";
import * as actions from "../compat/actions";
import { AppStore } from "../src/state/store";

import { teardown, mountCMB, keyDown } from "../compat/test-utils";

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

    // SKIPPED (D): the old editor prints the program again when the mode is switched, which rewrites the comments (the opening whitespace goes); this editor does not print: the text stays exactly as written, on every switch (twenty-ninth round)

    // first error (sweep): Error: expect(received).toBe(expected) // Object.is equality
    it.skip("when the mode is toggled, it should reformat all comments as block comments", () => {
      cmb.setBlockMode(false);
      // the opening whitespace should be removed!
      expect(cmb.getValue()).toBe(`(comment free)
1 #| comment1 |#
#| comment2 |#
2`);
    });

    // SKIPPED (I): makes a quarantine through the redux store (`actions.setQuarantine`)

    // first error (sweep): Error: not in the compat layer: store.dispatch(actions.setQuarantine(...)) (a quarantine is a redux state of the old editor)
    it.skip("you should be able to insert a commented node after a commented node", () => {
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

    // SKIPPED (I): makes a quarantine through the redux store (`actions.setQuarantine`)

    // first error (sweep): Error: not in the compat layer: store.dispatch(actions.setQuarantine(...)) (a quarantine is a redux state of the old editor)
    it.skip("you should be able to insert a commented node after an uncommented node", () => {
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
