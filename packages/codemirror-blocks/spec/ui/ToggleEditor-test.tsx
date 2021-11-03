import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import React from "react";
import ReactModal from "react-modal";
import { ASTNode, Language, NodeSpec } from "../../src/CodeMirrorBlocks";
import Context from "../../src/components/Context";
import { addLanguage } from "../../src/languages";
import { AppStore, createAppStore } from "../../src/state/store";
import ToggleEditor from "../../src/ui/ToggleEditor";

let testLanguage!: Language;
const parse = jest.fn().mockReturnValue([]);
const getExceptionMessage = jest.fn().mockImplementation((e) => String(e));
beforeAll(() => {
  testLanguage = addLanguage({
    id: "some-lang-id",
    name: "some lang",
    parse,
    getExceptionMessage,
  });
});

let store!: AppStore;
beforeEach(() => {
  store = createAppStore();
});

afterEach(cleanup);

const renderWithContext = (el: React.ReactElement) => {
  const result = render(<Context store={store}>{el}</Context>);
  ReactModal.setAppElement(result.container);
  return result;
};

describe("on first mount", () => {
  const onMount = jest.fn();
  beforeEach(() => {
    renderWithContext(
      <ToggleEditor language={testLanguage} onMount={onMount} />
    );
  });

  it("should call the function passed to onMount", () => {
    expect(onMount).toHaveBeenCalled();
  });

  it("should render a toggle button", () => {
    const toggleButton = screen.getByRole("button", {
      name: "Switch to blocks mode",
    });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toMatchInlineSnapshot(`
      <button
        class="blocks-toggle-btn btn btn-default btn-sm"
        tabindex="0"
      >
        <span
          aria-hidden="true"
        >
          🧱
        </span>
        <span
          class="btn-title screenreader-only"
        >
          Switch to blocks mode
        </span>
      </button>
    `);
  });
});

describe("Clicking the toggle button", () => {
  beforeEach(() => {
    renderWithContext(
      <ToggleEditor language={testLanguage} onMount={jest.fn()} />
    );
  });

  it("switches the text of the toggle button", () => {
    fireEvent.click(
      screen.getByRole("button", {
        name: "Switch to blocks mode",
      })
    );
    expect(screen.queryByText("Switch to blocks mode")).toBeNull();
    expect(screen.getByRole("button", { name: "Switch to text mode" }))
      .toMatchInlineSnapshot(`
      <button
        class="blocks-toggle-btn btn btn-default btn-sm"
        tabindex="0"
      >
        <span
          aria-hidden="true"
        >
          ✏️
        </span>
        <span
          class="btn-title screenreader-only"
        >
          Switch to text mode
        </span>
      </button>
    `);
  });

  describe("When parsing fails", () => {
    const clickToggle = () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Switch to blocks mode",
        })
      );
    const dialog = () => screen.getByRole("dialog");

    beforeEach(() => {
      parse.mockImplementation(() => {
        throw new Error("Test Language Failed To Parse!");
      });
    });

    it("shows an error dialog if parsing fails", () => {
      getExceptionMessage.mockImplementation((e) => `Aww shucks: ${e}`);
      clickToggle();
      expect(
        within(dialog()).getByRole("heading", {
          name: "Could not convert to Blocks",
        })
      ).toBeDefined();
      expect(within(dialog()).getByText(/Test Language Failed To Parse/))
        .toMatchInlineSnapshot(`
        <p>
          Aww shucks: Error: Test Language Failed To Parse!
        </p>
      `);
    });

    it("shows a fallback error message if the language definition's error translator fails", () => {
      getExceptionMessage.mockImplementation(() => {
        throw new Error("I don't even know how to translate my own errors...");
      });
      clickToggle();
      expect(within(dialog()).getByText(/parser failed/))
        .toMatchInlineSnapshot(`
        <p>
          The parser failed, and the error could not be retrieved
        </p>
      `);
    });

    it("shows an error dialog if the parsed result can't be converted back into a string", () => {
      parse.mockReturnValue([
        new ASTNode({
          from: { line: 0, ch: 0 },
          to: { line: 0, ch: 5 },
          type: "unprettiable",
          fields: {},
          options: {},
          render: () => {},
          spec: NodeSpec.nodeSpec([]),
          pretty: () => {
            throw new Error("This node can't be pretty-printed!");
          },
        }),
      ]);
      clickToggle();
      expect(
        within(dialog()).getByText(/An error occured in the language module/)
      ).toMatchInlineSnapshot(`
        <p>
          An error occured in the language module: 
                  the pretty-printer probably produced invalid code.
                  See the JS console for more detailed reporting.
        </p>
      `);
    });
  });
});
