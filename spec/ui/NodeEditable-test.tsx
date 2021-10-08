import { fireEvent, render, screen } from "@testing-library/react";
import CodeMirror from "codemirror";
import React from "react";
import { Provider } from "react-redux";
import { OverwriteTarget } from "../../src/actions";
import NodeEditable from "../../src/components/NodeEditable";
import { AppStore, createAppStore } from "../../src/store";
import { say } from "../../src/announcer";
import { CodeMirrorFacade } from "../../src/editor";

jest.mock("../../src/announcer");

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

  // const renderInContext = (nodeEditable: ReturnType<typeof NodeEditable>) => {
  //   const onClick = jest.fn();
  //   const onDoubleClick = jest.fn();
  //   const onMouseDown = jest.fn();
  //   return render(
  //     <Provider store={store}>
  //       <div
  //         onClick={onClick}
  //         onDoubleClick={onDoubleClick}
  //         onMouseDown={onMouseDown}
  //       >
  //         {nodeEditable}
  //       </div>
  //     </Provider>
  //   );
  // };

  describe("when editing text (isInsertion=false)", () => {
    describe("after first mount", () => {
      beforeEach(() => {
        const target = new OverwriteTarget(
          { line: 0, ch: 0 },
          { line: 0, ch: 1 }
        );
        render(
          <Provider store={store}>
            <NodeEditable
              {...defaultProps()}
              value="someVar"
              isInsertion={false}
              target={target}
            />
          </Provider>
        );
      });

      it("announces to the user that editing has commenced", () => {
        expect(say).toHaveBeenCalledTimes(1);
        expect(say).toHaveBeenCalledWith(
          "editing someVar.  Use Enter to save, and Alt-Q to cancel"
        );
      });

      it("selects the text being edited", () => {
        expect(document.getSelection()?.toString()).toEqual("someVar");
      });

      it("it sets an aria label that matches the text", () => {
        expect(screen.getByLabelText("someVar")).toBeInTheDocument();
      });
    });
  });

  describe("event traps", () => {
    // TODO(pcardune): maybe this behavior belongs inside ContentEditable instead of NodeEditable.
    it("prevents mouseDown, click, and double click events from propagating to parents nodes, since this should act like a text input", () => {
      const target = new OverwriteTarget(
        { line: 0, ch: 0 },
        { line: 0, ch: 1 }
      );
      const onClick = jest.fn();
      const onDoubleClick = jest.fn();
      const onMouseDown = jest.fn();
      render(
        <Provider store={store}>
          <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseDown={onMouseDown}
          >
            <NodeEditable
              {...defaultProps()}
              value="someVar"
              isInsertion={false}
              target={target}
            />
          </div>
        </Provider>
      );

      const el = screen.getByText("someVar");
      fireEvent.click(el);
      expect(onClick).not.toHaveBeenCalled();
      fireEvent.doubleClick(el);
      expect(onDoubleClick).not.toHaveBeenCalled();
      fireEvent.mouseDown(el);
      expect(onMouseDown).not.toHaveBeenCalled();
    });
  });

  // describe("blur event", () => {
  //   it("does stuff", () => {
  //     const store = createAppStore();
  //     cm.setValue("someVar");
  //     const ast = wescheme.parse(cm.getValue());
  //     store.dispatch({ type: "SET_AST", ast });

  //     const someVarLiteral = ast.rootNodes[0];

  //     render(
  //       <Provider store={store}>
  //         <NodeEditable
  //           value="someVar"
  //           isInsertion={false}
  //           cm={cm}
  //           target={target}
  //           onChange={jest.fn()}
  //           onDisableEditable={jest.fn()}
  //         />
  //       </Provider>
  //     );
  //   });
  // });
});
