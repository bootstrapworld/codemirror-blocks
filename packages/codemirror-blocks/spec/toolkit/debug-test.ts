import { act, fireEvent, waitFor } from "@testing-library/react";
import example from "../../src/languages/example";
import { createDebuggingInterface as create } from "../../src/toolkit/debug";
import { getReducerActivities } from "../../src/state/activityLog";
import { allowConsoleErrors } from "../globalSetup";

/**
 * The debugging page: an editor with buttons to download the log of what the
 * user did, and to load such a log and replay it a step at a time.
 */
const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const entries = () => [...document.querySelectorAll("#entries li")];

// React updates have to happen inside act(): the page does its own rendering,
// and the editor it returns is used outside any, so do both here
const createDebuggingInterface = (...args: Parameters<typeof create>) => {
  let editor!: ReturnType<typeof create>;
  act(() => {
    editor = create(...args);
  });
  return new Proxy(editor, {
    get(target, key) {
      const value = target[key as keyof typeof target];
      return typeof value === "function"
        ? (...a: unknown[]) => {
            let result: unknown;
            act(() => {
              result = (value as (...x: unknown[]) => unknown).apply(target, a);
            });
            return result;
          }
        : value;
    },
  });
};

/** Hand the page a log file, the way choosing one in the file input does */
const loadLog = (text: string) => {
  const input = byId<HTMLInputElement>("loadFromLog");
  const file = new File([text], "log.txt", { type: "text/plain" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  fireEvent.change(input);
};
/** ...and wait for the page to have read it (it reads it in the background) */
const loadLogAndWait = async (text: string, done: () => void) => {
  loadLog(text);
  await waitFor(done);
};

const log = (history: unknown[]) =>
  JSON.stringify({ history, exception: "DUMMY" });

afterEach(() => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

describe("the page", () => {
  it("shows the language, an editor with the code, and the log buttons", () => {
    const editor = createDebuggingInterface(example, "(+ 1 2)");
    expect(document.querySelector("h1")?.textContent).toContain("Example");
    expect(byId("cmb-editor")).toBeTruthy();
    expect(byId("loadFromLog").getAttribute("type")).toBe("file");
    expect(byId<HTMLInputElement>("nextButton").value).toBe(">>");
    expect(byId<HTMLInputElement>("downloadLog").value).toBe("Download Log");
    expect(entries()).toHaveLength(0);
    // the editor starts as a text editor on the code
    expect(editor.getValue()).toBe("(+ 1 2)");
    expect(editor.getBlockMode()).toBe(false);
  });
});

describe("Download Log", () => {
  it("offers the actions so far as a file named CMB Log.txt", () => {
    const editor = createDebuggingInterface(example, "(f 1)");
    editor.setBlockMode(true);
    editor.setValue("(g 2)");
    const clicked: HTMLAnchorElement[] = [];
    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
        // it is in the page while it is clicked, but not shown
        expect(document.body.contains(this)).toBe(true);
        expect(this.style.display).toBe("none");
      });

    byId("downloadLog").click();

    expect(clicked).toHaveLength(1);
    const link = clicked[0];
    expect(link.getAttribute("download")).toBe("CMB Log.txt");
    const prefix = "data:text/plain;charset=utf-8,";
    const href = link.getAttribute("href") as string;
    expect(href.startsWith(prefix)).toBe(true);
    const downloaded = JSON.parse(
      decodeURIComponent(href.slice(prefix.length))
    );
    expect(downloaded.exception).toBe("DUMMY");
    expect(downloaded.history).toEqual(
      JSON.parse(JSON.stringify(getReducerActivities()))
    );
    expect(
      downloaded.history.some(
        (a: { type: string; code?: string }) =>
          a.type === "SET_AST" && a.code === "(g 2)"
      )
    ).toBe(true);
    // ...and is gone afterwards
    expect(document.body.contains(link)).toBe(false);
  });
});

describe("loading a log", () => {
  it("lists every action, clears the editor, and swaps the buttons", async () => {
    const editor = createDebuggingInterface(example, "(f 1)");
    await loadLogAndWait(
      log([
        { type: "SET_AST", code: "(+ 1 2)" },
        { type: "RESET_STORE_FOR_TESTING" },
      ]),
      () => expect(entries()).toHaveLength(2)
    );
    expect(entries()[0].className).toBe("logEntry");
    expect(JSON.parse(entries()[0].innerHTML)).toEqual({
      type: "SET_AST",
      code: "(+ 1 2)",
    });
    expect(editor.getValue()).toBe("");
    expect(editor.getBlockMode()).toBe(true);
    expect(byId("nextButton").style.display).toBe("inline-block");
    expect(byId("loadFromLog").style.display).toBe("none");
  });

  it.each([
    ["is not JSON", "this is not a log"],
    ["has no history", JSON.stringify({ exception: "DUMMY" })],
    ["has an empty exception", JSON.stringify({ history: [], exception: "" })],
  ])("refuses a file that %s, and says so", async (_what, text) => {
    allowConsoleErrors(); // the contents are logged
    const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    createDebuggingInterface(example, "(f 1)");
    await loadLogAndWait(text, () => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toMatch(/Malformed log file/);
    expect(error).toHaveBeenCalledWith(text);
    expect(entries()).toHaveLength(0);
    expect(byId("loadFromLog").style.display).not.toBe("none");
  });

  it("insists on a file input", () => {
    createDebuggingInterface(example, "");
    const onchange = byId<HTMLInputElement>("loadFromLog").onchange as (
      e: unknown
    ) => void;
    expect(() => onchange({ target: { files: null } })).toThrow(
      "loadLogButton should be a file input"
    );
  });
});

describe("replaying a log", () => {
  const replay = async (history: unknown[]) => {
    const editor = createDebuggingInterface(example, "");
    await loadLogAndWait(log(history), () =>
      expect(entries()).toHaveLength(history.length)
    );
    return editor;
  };
  const next = () => act(() => byId<HTMLInputElement>("nextButton").click());
  const highlighted = () =>
    entries().map((li) => (li as HTMLElement).style.background);

  it("runs one action per click, highlighting the one it ran", async () => {
    const editor = await replay([
      { type: "SET_AST", code: "(f 1)" },
      { type: "RESET_STORE_FOR_TESTING" }, // already handled by the editor: skipped
      { type: "SET_AST", code: "(f 1)\n(g 2 3)" },
    ]);
    expect(editor.getValue()).toBe("");

    next();
    expect(editor.getValue()).toBe("(f 1)");
    expect(editor.getAst().rootNodes).toHaveLength(1);
    expect(highlighted()).toEqual(["lightblue", "none", "none"]);

    next();
    expect(editor.getValue()).toBe("(f 1)");
    expect(highlighted()).toEqual(["none", "lightblue", "none"]);

    next();
    expect(editor.getValue()).toBe("(f 1)\n(g 2 3)");
    expect(editor.getAst().rootNodes).toHaveLength(2);
    expect(highlighted()).toEqual(["none", "none", "lightblue"]);
  });

  it("says Done, and stops, after the last action", async () => {
    await replay([{ type: "SET_AST", code: "7" }]);
    const button = byId<HTMLInputElement>("nextButton");
    expect(button.disabled).toBe(false);
    next();
    expect(button.value).toBe("Done");
    expect(button.disabled).toBe(true);
  });

  it("replays focus by node number", async () => {
    const editor = await replay([
      { type: "SET_AST", code: "(f 1)\n(g 2)" },
      { type: "SET_FOCUS", nid: 3 }, // (f 1) is 0, f 1, 1 is 2
    ]);
    next();
    next();
    expect(editor.getFocusedNode()?.toString()).toBe("(g 2)");
  });

  it("replays what the editor itself recorded", async () => {
    // do something in an editor, keep its log, and play it back in another page
    const first = createDebuggingInterface(example, "(f 1)");
    first.setBlockMode(true);
    const start = getReducerActivities().length;
    first.setValue("(f 1)\n(g 2)");
    const recorded = JSON.parse(
      JSON.stringify(getReducerActivities().slice(start))
    );
    expect(recorded.length).toBeGreaterThan(0);

    const second = await replay(recorded);
    for (let i = 0; i < recorded.length; i++) {
      next();
    }
    expect(second.getValue()).toBe("(f 1)\n(g 2)");
  });
});
