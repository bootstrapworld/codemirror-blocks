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
        "astData": Object {
          "edgeIdMap": Object {},
          "languageId": "",
          "nodeIdMap": Map {},
          "nodeNIdMap": Map {},
          "rootNodes": Array [],
        },
        "blockMode": false,
        "code": "",
        "collapsedList": Array [],
        "editable": Object {},
        "errorId": "",
        "focusId": undefined,
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
    expect(selectors.getAST(getState()).rootNodes.length).toBe(0);
  });
  it("setAST will set the ast being used", () => {
    const newAST = AST.from(wescheme.id, []);
    dispatch(actions.setAST(newAST));
    expect(selectors.getAST(getState()).data).toBe(newAST.data);
  });
});

describe("collapse state", () => {
  let ast: AST;
  beforeEach(() => {
    ast = wescheme.buildAST(`
      (define x 1)
      (define y 2)
      (define z 3)
    `);
    dispatch(actions.setAST(ast));
  });
  it("starts with an empty collapse list", () => {
    expect(selectors.isCollapsed(getState(), ast.rootNodes[0])).toBe(false);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[1])).toBe(false);
    expect(selectors.isCollapsed(getState(), ast.rootNodes[2])).toBe(false);
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

describe("error state", () => {
  it("starts out as error free", () => {
    expect(selectors.getErrorId(getState())).toBe("");
    expect(selectors.isErrorFree(getState())).toBe(true);
  });

  it("setErrorId() will set the error id", () => {
    dispatch(actions.setErrorId("error-id"));
    expect(selectors.isErrorFree(getState())).toBe(false);
    expect(selectors.getErrorId(getState())).toBe("error-id");
  });

  it("clearError() will clear the error state", () => {
    dispatch(actions.setErrorId("error-id"));
    dispatch(actions.clearError());
    expect(selectors.isErrorFree(getState())).toBe(true);
    expect(selectors.getErrorId(getState())).toBe("");
  });
});

describe("focus state", () => {
  let ast: AST;
  beforeEach(() => {
    ast = wescheme.buildAST(`
      (define x 1)
      (define y 2)
      (define z 3)
    `);
    dispatch(actions.setAST(ast));
  });

  it("starts with no node focused", () => {
    expect(selectors.getFocusedNode(getState())).toBe(null);
  });

  it("setFocusedNode() will set the focused node", () => {
    dispatch(actions.setFocusedNode(ast.rootNodes[0]));
    expect(selectors.getFocusedNode(getState())).toBe(ast.rootNodes[0]);
  });
});

describe("block mode", () => {
  it("starts out disabled", () => {
    expect(selectors.isBlockModeEnabled(getState())).toBe(false);
  });

  describe("after calling setBlockMode(true, ...)", () => {
    it("will enable block mode and set the AST and code", () => {
      // initially the ast and code are both empty
      expect(selectors.getCode(getState())).toBe("");
      expect(selectors.getAST(getState()).rootNodes.length).toBe(0);

      // now we enable block mode
      dispatch(actions.setBlockMode(true, "(define x 1)", wescheme));

      // and block mode is enabled, and the code/ast is set
      expect(selectors.isBlockModeEnabled(getState())).toBe(true);
      expect(selectors.getCode(getState())).toBe("(define x 1)");
      expect(selectors.getAST(getState()).rootNodes.length).toBe(1);
    });

    it("will update the code and AST if called multiple times", () => {
      dispatch(actions.setBlockMode(true, "(define x 1)", wescheme));
      dispatch(actions.setBlockMode(true, "(define y 2)", wescheme));
      dispatch(actions.setBlockMode(true, "(define z 3)", wescheme));
      expect(selectors.getCode(getState())).toBe("(define z 3)");
      expect(selectors.getAST(getState()).toString()).toBe("(define z 3)");
    });

    it("will make the code conform to what the language's pretty printer generates", () => {
      dispatch(
        actions.setBlockMode(
          true,
          `(  
           define
            x 
              1  )`,
          wescheme
        )
      );

      expect(selectors.getCode(getState())).toBe("(define x 1)");
    });

    it("will not change anything if parsing fails, and return an error result", () => {
      const result = dispatch(
        actions.setBlockMode(true, `(define x 1`, wescheme)
      );
      expect(selectors.getCode(getState())).toBe("");
      expect(selectors.getAST(getState()).rootNodes.length).toBe(0);
      expect(selectors.isBlockModeEnabled(getState())).toBe(false);
      if (result.successful) {
        fail("expected an error result");
      }
      expect(result.exception).toMatchInlineSnapshot(
        `[Error: Your program could not be parsed]`
      );
    });
  });
});
