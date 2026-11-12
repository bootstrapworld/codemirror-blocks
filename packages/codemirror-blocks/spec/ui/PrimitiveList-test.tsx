import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import Context from "../../src/components/Context";
import { addLanguage } from "../../src/languages";
import { Literal } from "../../src/nodes";
import {
  Primitive as PrimitiveModel,
  PrimitiveGroup as GroupModel,
} from "../../src/parsers/primitives";
import { createAppStore } from "../../src/state/store";
import {
  Primitive,
  PrimitiveGroup,
  PrimitiveList,
} from "../../src/ui/PrimitiveList";

jest.mock("../../src/copypaste", () => ({
  ...jest.requireActual("../../src/copypaste"),
  copy: jest.fn(),
}));
const { copy } = require("../../src/copypaste");

describe("the primitives of the toolbar", () => {
  let group!: GroupModel;
  beforeAll(() => {
    addLanguage({
      id: "primitive-list-lang",
      name: "a lang",
      parse: jest.fn(),
      getASTNodeForPrimitive: (primitive: PrimitiveModel) =>
        Literal(
          { line: 0, ch: 0 },
          { line: 0, ch: 0 },
          { value: primitive.name, dataType: "unknown" }
        ),
      getLiteralNodeForPrimitive: (primitive: PrimitiveModel) =>
        Literal(
          { line: 0, ch: 0 },
          { line: 0, ch: 0 },
          { value: primitive.name, dataType: "symbol" }
        ),
    });
    group = GroupModel.fromConfig("primitive-list-lang", {
      name: "root",
      primitives: ["star", "square", "sqrt"],
    });
  });
  afterEach(cleanup);

  const inContext = (el: React.ReactElement) =>
    render(<Context store={createAppStore()}>{el}</Context>);
  const primitives = () => [...group.flatPrimitivesIter()];

  describe("a primitive", () => {
    it("hands its element to a ref function", () => {
      const ref = jest.fn();
      inContext(
        <Primitive
          primitive={primitives()[0]}
          className=""
          onFocus={jest.fn()}
          ref={ref}
        />
      );
      expect(ref).toHaveBeenCalledWith(screen.getByText("star"));
    });

    it("hands its element to a ref object", () => {
      const ref = React.createRef<HTMLElement>();
      inContext(
        <Primitive
          primitive={primitives()[0]}
          className=""
          onFocus={jest.fn()}
          ref={ref}
        />
      );
      expect(ref.current).toBe(screen.getByText("star"));
    });

    it("is copied with the copy key, and other keys do nothing", () => {
      inContext(
        <Primitive
          primitive={primitives()[0]}
          className=""
          onFocus={jest.fn()}
        />
      );
      const star = screen.getByText("star");
      fireEvent.keyDown(star, { key: "x", keyCode: 88 });
      expect(copy).not.toHaveBeenCalled();
      fireEvent.keyDown(star, { key: "c", keyCode: 67, ctrlKey: true });
      fireEvent.keyDown(star, { key: "c", keyCode: 67, metaKey: true });
      expect(copy).toHaveBeenCalled();
    });

    it("copies the literal of the primitive, not a call expression", () => {
      copy.mockClear();
      inContext(
        <Primitive
          primitive={primitives()[0]}
          className=""
          onFocus={jest.fn()}
        />
      );
      fireEvent.keyDown(screen.getByText("star"), {
        key: "c",
        keyCode: 67,
        ctrlKey: true,
      });
      const [nodes] = copy.mock.calls[0];
      expect(nodes).toHaveLength(1);
      expect(nodes[0].fields.dataType).toBe("symbol");
    });

    it("copies the whole expression when the language has no literal for it", () => {
      addLanguage({
        id: "primitive-list-call-only",
        name: "a lang with calls only",
        parse: jest.fn(),
        getASTNodeForPrimitive: (primitive: PrimitiveModel) =>
          Literal(
            { line: 0, ch: 0 },
            { line: 0, ch: 0 },
            { value: `(${primitive.name})`, dataType: "call" }
          ),
      });
      const callOnly = GroupModel.fromConfig("primitive-list-call-only", {
        name: "root",
        primitives: ["star"],
      });
      copy.mockClear();
      inContext(
        <Primitive
          primitive={[...callOnly.flatPrimitivesIter()][0]}
          className=""
          onFocus={jest.fn()}
        />
      );
      expect(() =>
        fireEvent.keyDown(screen.getByText("star"), {
          key: "c",
          keyCode: 67,
          ctrlKey: true,
        })
      ).not.toThrow();
      const [nodes] = copy.mock.calls[0];
      expect(nodes).toHaveLength(1);
      expect(nodes[0].fields.dataType).toBe("call");
    });
  });

  describe("a group", () => {
    const renderGroup = (
      props: Partial<React.ComponentProps<typeof PrimitiveGroup>>
    ) =>
      inContext(
        <PrimitiveGroup
          toolbarRef={React.createRef()}
          setSelectedPrimitive={jest.fn()}
          {...props}
        />
      );

    it("opens and closes when its header gets focus", () => {
      const { container } = renderGroup({ group });
      expect(screen.queryByText("star")).toBeNull();
      act(() => fireEvent.focus(container.querySelector(".group-header")!));
      expect(screen.getByText("star")).toBeInTheDocument();
      act(() => fireEvent.focus(container.querySelector(".group-header")!));
      expect(screen.queryByText("star")).toBeNull();
    });

    it("is an empty group when it is not given one", () => {
      const { container } = renderGroup({});
      act(() => fireEvent.focus(container.querySelector(".group-header")!));
      expect(container.querySelectorAll(".Primitive").length).toBe(0);
    });
  });

  describe("the list", () => {
    const renderList = (
      props: Partial<React.ComponentProps<typeof PrimitiveList>>
    ) =>
      inContext(
        <PrimitiveList
          toolbarRef={React.createRef()}
          setSelectedPrimitive={jest.fn()}
          {...props}
        />
      );

    it("says how many blocks a search found, or that there are none", () => {
      renderList({ primitives: primitives(), searchString: "s" });
      expect(screen.getByText("3 blocks found")).toBeInTheDocument();
      cleanup();
      renderList({ primitives: [], searchString: "zzz" });
      expect(screen.getByText("No blocks found")).toBeInTheDocument();
      cleanup();
      renderList({ primitives: primitives() });
      expect(screen.getByText("blocks")).toBeInTheDocument();
    });

    it("does not move when nothing is selected, or there is nothing to select", () => {
      const { container } = renderList({ primitives: primitives() });
      const list = container.querySelector("ul")!;
      expect(() =>
        fireEvent.keyDown(list, { key: "ArrowDown", keyCode: 40 })
      ).not.toThrow();
      cleanup();
      const empty = renderList({
        primitives: [],
        selectedPrimitive: primitives()[0],
      });
      expect(() =>
        fireEvent.keyDown(empty.container.querySelector("ul")!, {
          key: "ArrowUp",
          keyCode: 38,
        })
      ).not.toThrow();
    });

    it("moves focus up and down, and stays at the ends", () => {
      const all = primitives();
      const { container } = renderList({
        primitives: all,
        selectedPrimitive: all[1],
      });
      const list = container.querySelector("ul")!;
      fireEvent.keyDown(list, { key: "ArrowDown", keyCode: 40 });
      expect(document.activeElement).toBe(screen.getByText("sqrt"));
      cleanup();
      const top = renderList({ primitives: all, selectedPrimitive: all[0] });
      fireEvent.keyDown(top.container.querySelector("ul")!, {
        key: "ArrowUp",
        keyCode: 38,
      });
      expect(document.activeElement).toBe(screen.getByText("star"));
    });

    it("gives focus back to the search box with Escape", () => {
      const toolbarRef = React.createRef<HTMLInputElement>();
      const input = document.createElement("input");
      document.body.appendChild(input);
      (toolbarRef as { current: HTMLInputElement | null }).current = input;
      const { container } = renderList({
        primitives: primitives(),
        toolbarRef,
      });
      fireEvent.keyDown(container.querySelector("ul")!, {
        key: "Escape",
        keyCode: 27,
      });
      expect(document.activeElement).toBe(input);
      input.remove();
    });
  });
});
