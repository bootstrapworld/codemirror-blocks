import { AppStore, createAppStore } from "../../src/state/store";
import * as selectors from "../../src/state/selectors";
import * as actions from "../../src/state/actions";
import { AST } from "../../src/ast";
import wescheme from "../../src/languages/wescheme";

let getState: AppStore["getState"];
let dispatch: AppStore["dispatch"];
beforeEach(() => {
  const store = createAppStore();
  getState = store.getState;
  dispatch = store.dispatch;
});

describe("createAppStore()", () => {
  it("should create a store with some empty state", () => {
    expect(getState()).toMatchInlineSnapshot(`
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

describe("ast", () => {
  it("starts with an empty ast", () => {
    expect(selectors.selectAST(getState()).rootNodes.length).toBe(0);
  });
  it("setAST will set the ast being used", () => {
    const newAST = new AST([]);
    dispatch(actions.setAST(newAST));
    expect(selectors.selectAST(getState())).toBe(newAST);
  });
});

describe("collapse state", () => {
  let ast: AST;
  beforeEach(() => {
    ast = new AST(
      wescheme.parse(`
      (define x 1)
      (define y 2)
      (define z 3)
    `)
    );
    dispatch(actions.setAST(ast));
  });
  it("starts with an empty collapse list", () => {
    expect(selectors.selectCollapsedList(getState())).toEqual([]);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(false);
  });
  it("collapseNode()/uncollapseNode() will toggle the collapsed state", () => {
    dispatch(actions.collapseNode(ast.rootNodes[0]));
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(true);

    dispatch(actions.uncollapseNode(ast.rootNodes[0]));
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(false);
  });
  it("collapseAll()/uncollapseAll() will toggle the collapsed state of all nodes", () => {
    dispatch(actions.collapseAll());
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(true);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[1])).toBe(true);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[2])).toBe(true);

    dispatch(actions.uncollapseAll());
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(false);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[1])).toBe(false);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[2])).toBe(false);
  });
});
