import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CodeMirror from "codemirror";
import React from "react";
import { useDrag } from "react-dnd";
import Context from "../../src/components/Context";
import { ItemTypes } from "../../src/dnd";
import { CodeMirrorFacade } from "../../src/editor";
import { addLanguage, Language } from "../../src/languages";
import { AppStore, createAppStore } from "../../src/state/store";
import * as actions from "../../src/state/actions";
import * as selectors from "../../src/state/selectors";
import TrashCan from "../../src/ui/TrashCan";
import { ASTNode } from "../../src/ast";
import { Literal } from "../../src/nodes";

let language: Language;
beforeAll(() => {
  language = addLanguage({
    id: "some-lang",
    name: "some lang",
    parse: (code: string) => {
      return code
        .split(/\s+/)
        .map((s) => Literal({ line: 0, ch: 0 }, { line: 0, ch: 1 }, s));
    },
  });
});

let store!: AppStore;
let editor!: CodeMirrorFacade;
beforeEach(() => {
  editor = new CodeMirrorFacade(CodeMirror(document.body));
  store = createAppStore();
});
afterEach(() => {
  cleanup();
});

const renderWithContext = (el: React.ReactElement) =>
  render(<Context store={store}>{el}</Context>);

it("should render a trashcan", () => {
  const result = renderWithContext(
    <TrashCan language={language} editor={editor} />
  );
  expect(result.container).toMatchInlineSnapshot(`
    <div>
      <div
        aria-hidden="true"
        class="TrashCan"
      >
        🗑️
      </div>
    </div>
  `);
});

const DragStub = ({ node }: { node: ASTNode }) => {
  const [_, connectDragSource] = useDrag({
    type: ItemTypes.NODE,
    item: () => ({ id: node.id }),
  });
  return connectDragSource(<div>draggable thing</div>);
};

describe("dragging a node over the trashcan", () => {
  let trashcan: HTMLElement;
  let draggable: HTMLElement;
  beforeEach(() => {
    editor.setValue("a b c");
    store.dispatch(actions.setBlockMode(true, editor.getValue(), language));

    const ast = selectors.getAST(store.getState());

    renderWithContext(
      <div>
        <DragStub node={ast.rootNodes[0]} />
        <TrashCan language={language} editor={editor} />
      </div>
    );
    trashcan = document.querySelector(".TrashCan")!;
    draggable = screen.getByText("draggable thing");
    fireEvent.dragStart(draggable);
    fireEvent.dragEnter(trashcan);
    fireEvent.dragOver(trashcan);
  });

  it("should add an 'over' css class", () => {
    expect(trashcan).toMatchInlineSnapshot(`
      <div
        aria-hidden="true"
        class="TrashCan over"
      >
        🗑️
      </div>
    `);
  });

  it("should delete the node that was dropped onto it", () => {
    expect(selectors.getAST(store.getState()).toString()).toBe("a\nb\nc");
    fireEvent.drop(trashcan);
    expect(selectors.getAST(store.getState()).toString()).toBe("b\nc");
  });
});
