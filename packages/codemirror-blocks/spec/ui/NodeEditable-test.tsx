import { cleanup, render, screen } from "@testing-library/react";
import CodeMirror from "codemirror";
import React from "react";
import { OverwriteTarget } from "../../src/actions";
import NodeEditable from "../../src/components/NodeEditable";
import { AppStore, createAppStore } from "../../src/store";
import { say } from "../../src/announcer";
import { CodeMirrorFacade } from "../../src/editor";
import Context, { LanguageContext } from "../../src/components/Context";
import { Language } from "../../src/CodeMirrorBlocks";
import { addLanguage } from "../../src/languages";

jest.mock("../../src/announcer");

let testLang!: Language;
beforeAll(() => {
  testLang = addLanguage({
    id: "some-lang-id",
    name: "some lang",
    parse: jest.fn(),
  });
});

afterEach(cleanup);

describe("NodeEditable", () => {
  let editor!: CodeMirrorFacade;
  let store!: AppStore;

  const defaultProps = () => {
    return {
      onChange: jest.fn(),
      onDisableEditable: jest.fn(),
      editor,
    };
  };

  beforeEach(() => {
    editor = new CodeMirrorFacade(CodeMirror(document.body));
    store = createAppStore();
  });
  afterEach(() => {
    editor.codemirror.getWrapperElement().remove();
  });
  const renderWithContext = (el: React.ReactElement) =>
    render(
      <Context store={store}>
        <LanguageContext.Provider value={testLang}>
          {el}
        </LanguageContext.Provider>
      </Context>
    );

  describe("when editing text (isInsertion=false)", () => {
    describe("after first mount", () => {
      beforeEach(() => {
        const target = new OverwriteTarget(
          { line: 0, ch: 0 },
          { line: 0, ch: 1 }
        );
        renderWithContext(
          <NodeEditable
            {...defaultProps()}
            value="someVar"
            isInsertion={false}
            target={target}
          />
        );
      });

      it("announces to the user that editing has commenced", () => {
        expect(say).toHaveBeenCalledTimes(1);
        expect(say).toHaveBeenCalledWith(
          "editing someVar.  Use Enter to save, and Alt-Q to cancel"
        );
      });

      it("selects the text being edited", async () => {
        expect(document.getSelection()?.toString()).toEqual("someVar");
      });

      it("it sets an aria label that matches the text", () => {
        expect(screen.getByLabelText("someVar")).toBeInTheDocument();
      });
    });
  });

  describe("when inserting text (isInsertion=true)", () => {
    beforeEach(() => {
      const target = new OverwriteTarget(
        { line: 0, ch: 0 },
        { line: 0, ch: 1 }
      );
      renderWithContext(
        <NodeEditable
          {...defaultProps()}
          value="someVar"
          isInsertion={true}
          target={target}
        />
      );
    });
    it("announces to the user that they are inserting text", () => {
      expect(say).toHaveBeenCalledTimes(1);
      expect(say).toHaveBeenCalledWith(
        "inserting someVar.  Use Enter to save, and Alt-Q to cancel"
      );
    });
  });
});
