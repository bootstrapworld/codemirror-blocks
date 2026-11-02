import { say } from "./announcer";
import { ASTNode } from "./ast";
import { createEditAnnouncement, poscmp } from "./utils";

// lazily create a hidden buffer, for use with copy/cut/paste
let _buffer: HTMLTextAreaElement;
let bufferInUse = false;
function getCopyPasteBuffer() {
  if (_buffer) {
    return _buffer;
  }
  _buffer = document.createElement("textarea");
  _buffer.ariaHidden = "true";
  _buffer.tabIndex = -1;
  _buffer.style.opacity = "0";
  _buffer.style.height = "1px";
  document.body.appendChild(_buffer);
  // The buffer takes focus only while a copy or paste is under way. If the
  // browser gives it focus at any other time, keys (undo, among them) would go
  // to an element that hears none of them: pass focus on to the editor.
  _buffer.addEventListener("focus", () => {
    if (!bufferInUse) {
      document.querySelector<HTMLElement>(".CodeMirror textarea")?.focus();
    }
  });
  return _buffer;
}

export function pasteFromClipboard(done: (value: string) => void) {
  const buffer = getCopyPasteBuffer();
  const previouslyFocusedElement = document.activeElement;
  buffer.value = "";
  bufferInUse = true;
  buffer.focus();
  setTimeout(() => {
    const value = buffer.value;
    bufferInUse = false;
    // Give focus back *before* handing over the text, or keyboard shortcuts
    // (like undo) would keep going to the hidden buffer. The edit may move
    // focus again afterwards, e.g. onto the pasted node.
    // (not back to the buffer itself, if a paste began while another was
    // waiting, nor to an element the page no longer holds: the editor's own
    // input is next best)
    if (
      previouslyFocusedElement instanceof HTMLElement &&
      previouslyFocusedElement !== buffer &&
      previouslyFocusedElement.isConnected
    ) {
      previouslyFocusedElement.focus();
    } else {
      document.querySelector<HTMLElement>(".CodeMirror textarea")?.focus();
    }
    done(value);
  }, 50);
}

function copyToClipboard(text: string) {
  const buffer = getCopyPasteBuffer();
  buffer.value = text;
  bufferInUse = true;
  buffer.select();
  bufferInUse = false;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch((e) => {
      console.error("Failed copying to clipboard: ", e);
      // lets try using the deprecated API:
      document.execCommand("copy");
    });
  } else if (document.execCommand) {
    document.execCommand("copy");
  }
}

/**
 * Copy the given nodes onto the clipboard.
 * This function is called from keymap.tsx and PrimitiveList.tsx
 * In both places, the call site checks to ensure the copy
 * event is fired when a DOM node is active.
 */
export function copy(nodes: ASTNode[], editWord?: string) {
  const previouslyFocusedElement = document.activeElement;
  if (nodes.length === 0) {
    return;
  }
  // Pretty-print each copied node. Join them with spaces, or newlines for
  // commented nodes (to prevent a comment from attaching itself to a
  // different node after pasting).
  nodes.sort((a, b) => poscmp(a.from, b.from));
  let annt: string;
  if (editWord) {
    annt = createEditAnnouncement(nodes, editWord);
    say(annt);
  }
  let text = "";
  let postfix = "";
  for (const node of nodes) {
    const prefix = node.options && node.options.comment ? "\n" : postfix;
    text = text + prefix + node.toString();
    postfix = node.options && node.options.comment ? "\n" : " ";
  }
  // do the actual copy, then restore focus
  copyToClipboard(text);
  (previouslyFocusedElement as HTMLElement).focus();
}
