import { cleanup, render } from "@testing-library/react";
import React from "react";
import { AST } from "../../src/ast";
import { Language } from "../../src/CodeMirrorBlocks";
import Context from "../../src/components/Context";
import { addLanguage } from "../../src/languages";
import { AppStore, createAppStore } from "../../src/state/store";
import BlockEditor from "../../src/ui/BlockEditor";

let testLanguage!: Language;
beforeAll(() => {
  testLanguage = addLanguage({
    id: "some-lang-id",
    name: "some lang",
    parse: jest.fn(),
  });
});

let store!: AppStore;
beforeEach(() => {
  store = createAppStore();
});

afterEach(cleanup);

const renderWithContext = (el: React.ReactElement) =>
  render(<Context store={store}>{el}</Context>);

xdescribe("on first render", () => {
  const onMount = jest.fn();

  it("calls the onMount callback with the editor, and api that were created", () => {
    renderWithContext(
      <BlockEditor
        value=""
        onMount={onMount}
        keyDownHelpers={{}}
        passedAST={new AST([])}
        language={testLanguage}
      />
    );
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
