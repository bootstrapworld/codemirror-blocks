import { clipboardSlot } from "./test-utils";

/**
 * An in-memory clipboard for the current test. In the old editor `copy()` writes through `navigator.clipboard` and paste reads a hidden buffer;
 * here the browser's copy, cut and paste events carry the text, and `keyDown` of Ctrl/Cmd-C, X, V fires them (as a browser does) with this one.
 */
export function installFakeClipboard(initial = "") {
  const slot = clipboardSlot as { text?: string; pasteCount?: number };
  slot.text = initial;
  slot.pasteCount = 0;
  return {
    get text() {
      return slot.text as string;
    },
    set text(v: string) {
      slot.text = v;
    },
    get pasteCount() {
      return slot.pasteCount as number;
    },
    restore: () => {
      slot.text = "";
      slot.pasteCount = 0;
    },
  };
}
