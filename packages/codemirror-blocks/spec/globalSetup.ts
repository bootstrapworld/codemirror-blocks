import "@testing-library/jest-dom";

export {};

window.focus = () => {};

// See https://github.com/jsdom/jsdom/issues/3002 for why this is necessary
document.createRange = () => {
  const range = new Range();

  range.getBoundingClientRect = jest.fn();

  range.getClientRects = () => {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn(),
    };
  };

  return range;
};

class MockDataTransfer implements DataTransfer {
  dropEffect!: "none" | "copy" | "link" | "move";
  effectAllowed:
    | "none"
    | "copy"
    | "link"
    | "move"
    | "copyLink"
    | "copyMove"
    | "linkMove"
    | "all"
    | "uninitialized" = "uninitialized";
  files!: FileList;
  items!: DataTransferItemList;
  types: readonly string[] = [];
  clearData(_format?: string): void {
    throw new Error("Method not implemented.");
  }
  private data = "";
  getData(_format: string): string {
    return this.data;
  }
  setData(format: string, data: string): void {
    this.data = data;
  }
  setDragImage(_image: Element, _x: number, _y: number): void {
    throw new Error("Method not implemented.");
  }
}

window.DataTransfer = MockDataTransfer as typeof window.DataTransfer;

window.HTMLMediaElement.prototype.play = jest.fn();
window.HTMLMediaElement.prototype.pause = jest.fn();

// After every test that mounts an editor, check the properties that must hold
// whatever the test did. Tests that deliberately leave the editor in an
// unusual state can call `skipInvariants()`.
let invariantsSkipped = false;
export const skipInvariants = () => {
  invariantsSkipped = true;
};

afterEach(() => {
  const skipped = invariantsSkipped;
  invariantsSkipped = false;
  // only editors created by mountCMB() are checked
  if (!skipped && document.getElementById("cmb-editor")) {
    // required lazily: importing the editor must wait until the DOM mocks
    // above are in place
    const { findInvariantViolations } = require("./helpers/invariants");
    expect(findInvariantViolations()).toEqual([]);
  }
});

// Fail any test that makes React (or the editor) log an error. React reports
// most misuse (bad keys, setState during render, act() warnings) this way.
// Tests that expect errors can call `allowConsoleErrors()`, which also keeps
// the expected errors off the console. It returns the spy, so a test can
// check what was logged. Unexpected errors still print and still fail.
let consoleErrorsAllowed = false;
let errorSpy: jest.SpyInstance;
export const allowConsoleErrors = (): jest.SpyInstance => {
  consoleErrorsAllowed = true;
  return errorSpy.mockImplementation(() => {});
};

// The same for warnings: warnings never fail a test, but an expected one can
// be kept off the console (and inspected) with this.
let warnSpy: jest.SpyInstance;
export const allowConsoleWarnings = (): jest.SpyInstance =>
  warnSpy.mockImplementation(() => {});

// The WeScheme lexer reports every syntax error it recovers from with a bare
// console.log. Nothing can act on it, so drop that one message.
// eslint-disable-next-line no-console
const realLog = console.log;
let logSpy: jest.SpyInstance;

beforeEach(() => {
  consoleErrorsAllowed = false;
  errorSpy = jest.spyOn(console, "error");
  warnSpy = jest.spyOn(console, "warn");
  logSpy = jest
    .spyOn(console, "log")
    .mockImplementation((...args: unknown[]) => {
      if (args[0] !== "LEXING ERROR") realLog(...args);
    });
});
afterEach(() => {
  const calls = errorSpy.mock.calls.map((args) => args.map(String).join(" "));
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  logSpy.mockRestore();
  if (!consoleErrorsAllowed) {
    expect(calls).toEqual([]);
  }
});
