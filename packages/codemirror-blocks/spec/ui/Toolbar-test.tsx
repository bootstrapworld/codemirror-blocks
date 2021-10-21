import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import React from "react";
import Context from "../../src/components/Context";
import { addLanguage } from "../../src/languages";
import { Literal } from "../../src/nodes";
import { Primitive, PrimitiveGroup } from "../../src/parsers/primitives";
import { AppStore, createAppStore } from "../../src/store";
import Toolbar from "../../src/ui/Toolbar";

fdescribe("Toolbar", () => {
  let primitives!: PrimitiveGroup;
  beforeAll(() => {
    addLanguage({
      id: "some-lang-id",
      name: "some lang",
      parse: jest.fn(),
      getASTNodeForPrimitive: (primitive: Primitive) => {
        return new Literal(
          { line: 0, ch: 0 },
          { line: 0, ch: 0 },
          primitive.name
        );
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
        tabindex="-1"
      >
        star
      </span>
    `);
    expect(screen.getByText("square")).toMatchInlineSnapshot(`
      <span
        class="Primitive list-group-item"
        draggable="true"
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
    const fooPrimitive = screen.getByText("star");
    expect(fooPrimitive).not.toHaveClass("selected");
    fireEvent.focus(fooPrimitive);
    expect(fooPrimitive).toHaveClass("selected");
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

    const searchFor = (text: string) =>
      fireEvent.change(searchInput, { target: { value: text } });

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
