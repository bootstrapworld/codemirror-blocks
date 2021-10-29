import { render } from "@testing-library/react";
import React from "react";
import { AST } from "../../src/ast";
import { Language } from "../../src/CodeMirrorBlocks";
import Context, { LanguageContext } from "../../src/components/Context";
import Node from "../../src/components/Node";
import { Literal } from "../../src/nodes";
import { AppStore, createAppStore } from "../../src/store";

let store!: AppStore;
beforeEach(() => {
  store = createAppStore();
});

const testLang: Language = {
  id: "some-lang-id",
  name: "some lang",
  parse: jest.fn(),
};

const renderWithContext = (el: React.ReactElement) =>
  render(
    <Context store={store}>
      <LanguageContext.Provider value={testLang}>{el}</LanguageContext.Provider>
    </Context>
  );

it("renders a draggable span with various aria properties", () => {
  const ast = new AST([
    Literal({ line: 0, ch: 0 }, { line: 0, ch: 1 }, "someVar", "symbol", {
      ariaLabel: "the someVar variable",
    }),
  ]);
  const node = ast.rootNodes[0];
  const result = renderWithContext(
    <Node node={node}>This is a literal for someVar</Node>
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
