import { createAppStore } from "../../src/state/store";

describe("createAppStore()", () => {
  it("should create a store with some empty state", () => {
    const store = createAppStore();
    expect(store.getState()).toMatchInlineSnapshot(`
      Object {
        "actionFocus": undefined,
        "ast": AST {
          "edgeIdMap": Object {},
          "getAllNodeIds": [Function],
          "getAllNodes": [Function],
          "getNodeAfter": [Function],
          "getNodeAfterCur": [Function],
          "getNodeBefore": [Function],
          "getNodeBeforeCur": [Function],
          "getNodeById": [Function],
          "getNodeByIdOrThrow": [Function],
          "getNodeByNId": [Function],
          "getNodeByNIdOrThrow": [Function],
          "getNodeParent": [Function],
          "isAncestor": [Function],
          "nodeIdMap": Map {},
          "nodeNIdMap": Map {},
          "rootNodes": Array [],
        },
        "collapsedList": Array [],
        "cur": null,
        "editable": Object {},
        "errorId": "",
        "focusId": null,
        "markedMap": Object {},
        "quarantine": null,
        "selections": Array [],
        "undoableAction": undefined,
      }
    `);
  });
});
