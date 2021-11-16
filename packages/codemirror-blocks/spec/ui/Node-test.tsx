import { render } from "@testing-library/react";
import React from "react";
import { AST } from "../../src/ast";
import Context, { LanguageContext } from "../../src/components/Context";
import Node from "../../src/components/Node";
import { addLanguage } from "../../src/languages";
import { Comment, Literal } from "../../src/nodes";
import { AppStore, createAppStore } from "../../src/state/store";

let store!: AppStore;
beforeEach(() => {
  store = createAppStore();
});

const testLang = addLanguage({
  id: "some-lang-id",
  name: "some lang",
  parse: jest.fn(),
});

const renderWithContext = (el: React.ReactElement) =>
  render(
    <Context store={store}>
      <LanguageContext.Provider value={testLang}>{el}</LanguageContext.Provider>
    </Context>
  );

it("renders a draggable span with various aria properties", () => {
  const ast = AST.from(testLang.id, [
    Literal({ line: 0, ch: 0 }, { line: 0, ch: 1 }, "someVar", "symbol", {
      ariaLabel: "the someVar variable",
    }),
  ]);
  const result = renderWithContext(
    <Node node={ast.rootNodes[0]}>This is a literal for someVar</Node>
  );
  expect(result.container).toMatchInlineSnapshot(`
    <div>
      <span
        aria-expanded="true"
        aria-label="the someVar variable,"
        aria-labelledby="block-node-0 "
        aria-level="1"
        aria-posinset="1"
        aria-selected="false"
        aria-setsize="1"
        class="blocks-literal blocks-node"
        draggable="true"
        id="block-node-0"
        role="treeitem"
        style=""
        tabindex="-1"
      >
        This is a literal for someVar
      </span>
    </div>
  `);
});

it("renders a comment that is associated with a node", () => {
  const ast = AST.from(testLang.id, [
    Literal({ line: 0, ch: 0 }, { line: 0, ch: 1 }, "someVar", "symbol", {
      ariaLabel: "the someVar variable",
      comment: Comment({ line: 0, ch: 2 }, { line: 0, ch: 7 }, "hello"),
    }),
  ]);
  const result = renderWithContext(
    <Node node={ast.rootNodes[0]}>This is a literal for someVar</Node>
  );
  expect(result.container).toMatchInlineSnapshot(`
    <div>
      <span
        aria-expanded="true"
        aria-label="the someVar variable,"
        aria-labelledby="block-node-1 block-node-1-comment"
        aria-level="1"
        aria-posinset="1"
        aria-selected="false"
        aria-setsize="1"
        class="blocks-literal blocks-node"
        draggable="true"
        id="block-node-1"
        role="treeitem"
        style=""
        tabindex="-1"
      >
        This is a literal for someVar
        <span
          aria-hidden="true"
          class="blocks-comment"
          id="block-node-1-comment"
        >
          <span
            class="screenreader-only"
          >
            Has comment,
          </span>
           
          <span>
            hello
          </span>
        </span>
      </span>
    </div>
  `);
});
