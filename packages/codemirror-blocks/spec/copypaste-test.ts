import wescheme from "../src/languages/wescheme";
import { copy, pasteFromClipboard } from "../src/copypaste";
import * as announcer from "../src/announcer";
import { ASTNode } from "../src/ast";

const roots = (code: string): ASTNode[] => [
  ...wescheme.buildAST(code).rootNodes,
];

const buffer = () =>
  [...document.querySelectorAll("textarea")].find(
    (el) => el.style.opacity === "0"
  ) as HTMLTextAreaElement | undefined;

type FakeClipboard = { writeText: jest.Mock };
const setClipboard = (clipboard: FakeClipboard | undefined) =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });

let execCommand: jest.Mock;
beforeEach(() => {
  execCommand = jest.fn();
  document.execCommand = execCommand;
});
afterEach(() => {
  setClipboard(undefined);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("copy", () => {
  it("writes the node's text to navigator.clipboard", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    copy(roots("(f x y)"));
    expect(writeText).toHaveBeenCalledWith("(f x y)");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("joins several nodes with spaces, in document order", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const [a, b, c] = roots("a b c");
    copy([c, a, b]);
    expect(writeText).toHaveBeenCalledWith("a b c");
  });

  it("puts a commented node on its own lines so the comment can't drift", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    copy(roots("a\n#| about b |#\nb\nc"));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toMatch(/^a\n#\| about b \|#\nb\nc$/);
  });

  it("copies nothing when given no nodes", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    copy([]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when there is no navigator.clipboard", () => {
    setClipboard(undefined);
    copy(roots("(f x)"));
    expect(execCommand).toHaveBeenCalledWith("copy");
    // the text was selected in the hidden buffer for execCommand to copy
    expect(buffer()?.value).toBe("(f x)");
  });

  it("falls back to execCommand, and logs, when writeText fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error("no")) });
    copy(roots("(f x)"));
    await new Promise((r) => setTimeout(r, 0));
    expect(error).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    error.mockRestore();
  });

  it("returns keyboard focus to where it was", () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    copy(roots("a"));
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("announces what was copied when told the verb", () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const say = jest.spyOn(announcer, "say");
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    copy(roots("a b"), "copied");
    expect(say).toHaveBeenCalledTimes(1);
    expect(String(say.mock.calls[0][0])).toMatch(/copied/);
    button.remove();
  });

  it("stays quiet without a verb", () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const say = jest.spyOn(announcer, "say");
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    copy(roots("a"));
    expect(say).not.toHaveBeenCalled();
    button.remove();
  });
});

describe("pasteFromClipboard", () => {
  beforeEach(() => jest.useFakeTimers());

  it("gives the browser a moment to fill the hidden buffer, then reads it", () => {
    const done = jest.fn();
    pasteFromClipboard(done);
    const el = buffer()!;
    expect(document.activeElement).toBe(el);
    expect(el.value).toBe("");
    // the browser's native paste fills the focused buffer
    el.value = "pasted text";
    expect(done).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60);
    expect(done).toHaveBeenCalledWith("pasted text");
  });

  it("gives keyboard focus back to where it was, before handing over the text", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    let focusWhenDone: Element | null = null;
    pasteFromClipboard(() => {
      focusWhenDone = document.activeElement;
    });
    expect(document.activeElement).toBe(buffer());
    jest.advanceTimersByTime(60);
    expect(focusWhenDone).toBe(button);
    button.remove();
  });

  it("hands over an empty string if nothing was pasted", () => {
    const done = jest.fn();
    pasteFromClipboard(done);
    jest.advanceTimersByTime(60);
    expect(done).toHaveBeenCalledWith("");
  });

  it("clears whatever an earlier copy left in the buffer", () => {
    setClipboard(undefined);
    copy(roots("old"));
    const done = jest.fn();
    pasteFromClipboard(done);
    jest.advanceTimersByTime(60);
    expect(done).toHaveBeenCalledWith("");
  });
});
