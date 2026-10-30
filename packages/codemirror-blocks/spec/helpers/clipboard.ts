import * as copypaste from "../../src/copypaste";

/**
 * Replace the system clipboard with an in-memory one for the current test.
 *
 * `copy()` writes through `navigator.clipboard`, and paste reads what the
 * browser would have put in a hidden textarea; both are redirected to
 * `clipboard.text`. Call `restore()` (or use `jest.restoreAllMocks()`) in
 * afterEach.
 */
export function installFakeClipboard(initial = "") {
  const clipboard = {
    text: initial,
    /** how many times the app asked to paste */
    pasteCount: 0,
    restore: () => {
      delete (navigator as { clipboard?: unknown }).clipboard;
      spy.mockRestore();
    },
  };
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clipboard.text = text;
        return Promise.resolve();
      },
    },
  });
  const spy = jest
    .spyOn(copypaste, "pasteFromClipboard")
    .mockImplementation((done) => {
      clipboard.pasteCount++;
      done(clipboard.text);
    });
  return clipboard;
}
