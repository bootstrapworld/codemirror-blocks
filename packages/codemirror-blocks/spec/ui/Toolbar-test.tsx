import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Context from "../../src/components/Context";
import { addLanguage } from "../../src/languages";
import { Literal } from "../../src/nodes";
import { Primitive, PrimitiveGroup } from "../../src/parsers/primitives";
import { AppStore, createAppStore } from "../../src/state/store";
import Toolbar from "../../src/ui/Toolbar";

describe("Toolbar", () => {
  let primitives!: PrimitiveGroup;
  beforeAll(() => {
    addLanguage({
      id: "some-lang-id",
      name: "some lang",
      parse: jest.fn(),
      getASTNodeForPrimitive: (primitive: Primitive) => {
        return Literal({ line: 0, ch: 0 }, { line: 0, ch: 0 }, primitive.name);
      },
    });
    primitives = PrimitiveGroup.fromConfig("some-lang-id", {
      name: "root",
      primitives: ["star", "square", "sqrt", "ellipse"],
    });
  });

  let store!: AppStore;
  beforeEach(() => {
    store = createAppStore();
  });

  afterEach(cleanup);

  const renderWithContext = (el: React.ReactElement) =>
    render(<Context store={store}>{el}</Context>);

  it("should render without errors when no primitives are given", () => {
    renderWithContext(<Toolbar toolbarRef={React.createRef()} />);
  });

  it("should render the primitives that are given", () => {
    renderWithContext(
      <Toolbar toolbarRef={React.createRef()} primitives={primitives} />
    );
    expect(screen.getByText("star")).toMatchInlineSnapshot(`
      <span
        class="Primitive list-group-item"
        draggable="true"
        id="toolbar-star"
        tabindex="-1"
      >
        star
      </span>
    `);
    expect(screen.getByText("square")).toMatchInlineSnapshot(`
      <span
        class="Primitive list-group-item"
        draggable="true"
        id="toolbar-square"
        tabindex="-1"
      >
        square
      </span>
    `);
    ["star", "square", "sqrt", "ellipse"].forEach((text) => {
      expect(screen.queryByText(text)).toBeInTheDocument();
    });
  });

  it("should toggle the selection state of a primitive when clicked", () => {
    renderWithContext(
      <Toolbar toolbarRef={React.createRef()} primitives={primitives} />
    );
    const star = screen.getByText("star");
    expect(star).not.toHaveClass("selected");
    star.focus();
    expect(star).toHaveClass("selected");
  });

  describe("Navigating between primitives", () => {
    const selectPrimitive = (name: string) => {
      const primitiveEl = screen.getByText(name);
      expect(primitiveEl).not.toHaveClass("selected");
      primitiveEl.focus();
      expect(primitiveEl).toHaveClass("selected");
      return primitiveEl;
    };

    beforeEach(() => {
      renderWithContext(
        <Toolbar toolbarRef={React.createRef()} primitives={primitives} />
      );
    });

    it("selects the next primitive when down is pressed", () => {
      const starEl = selectPrimitive("star");
      userEvent.keyboard("{ArrowDown}");
      expect(starEl).not.toHaveClass("selected");
      expect(document.activeElement).toHaveTextContent("square");
      expect(document.activeElement).toHaveClass("selected");
    });
    it("selects the previous primitive when up is pressed", () => {
      const squareEl = selectPrimitive("square");
      userEvent.keyboard("{ArrowUp}");
      expect(squareEl).not.toHaveClass("selected");
      expect(document.activeElement).toHaveTextContent("star");
      expect(document.activeElement).toHaveClass("selected");
    });
  });

  describe("Searching", () => {
    let searchInput!: HTMLInputElement;
    beforeEach(() => {
      renderWithContext(
        <Toolbar toolbarRef={React.createRef()} primitives={primitives} />
      );
      searchInput = screen.getByPlaceholderText(
        "Search functions"
      ) as HTMLInputElement;
    });

    const searchFor = (text: string) => {
      fireEvent.change(searchInput, { target: { value: text } });
    };

    it("should render a search box", () => {
      expect(searchInput).toMatchInlineSnapshot(`
        <input
          class="form-control"
          disabled=""
          id="search_box"
          placeholder="Search functions"
          type="search"
          value=""
        />
      `);
    });

    describe("after typing into the search box", () => {
      it("should update the text in the search box", () => {
        searchFor("sq");
        expect(searchInput.value).toBe("sq");
      });

      it("should clear the search box when the remove icon is clicked", () => {
        searchFor("sq");
        const clearText = screen.getByLabelText("clear text");
        expect(clearText).toMatchInlineSnapshot(`
          <button
            aria-label="clear text"
            class="glyphicon glyphicon-remove"
          />
        `);
        fireEvent.click(clearText);
        expect(searchInput.value).toBe("");
      });

      it("should filter the displayed primitives", async () => {
        expect(screen.queryByText("square")).toBeInTheDocument();
        expect(screen.queryByText("ellipse")).toBeInTheDocument();
        searchFor("sq");
        expect(screen.queryByText("square")).toBeInTheDocument();
        expect(screen.queryByText("ellipse")).not.toBeInTheDocument();
        searchFor("ell");
        expect(screen.queryByText("square")).not.toBeInTheDocument();
        expect(screen.queryByText("ellipse")).toBeInTheDocument();
      });
    });
  });
});
