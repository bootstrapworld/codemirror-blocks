import { say } from "./announcer";
import { AST, ASTNode } from "./ast";
import { createEditAnnouncement, poscmp } from "./utils";

// lazily create a hidden buffer, for use with copy/cut/paste
let _buffer: HTMLTextAreaElement;
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
  return _buffer;
}

export function pasteFromClipboard(done: (value: string) => void) {
  const buffer = getCopyPasteBuffer();
  buffer.value = "";
  buffer.focus();
  setTimeout(() => {
    done(buffer.value);
  }, 50);
}

function copyToClipboard(text: string) {
  const buffer = getCopyPasteBuffer();
  buffer.value = text;
  buffer.select();
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
 */
export function copy(
  { focusedNode }: { focusedNode: ASTNode | null },
  nodes: ASTNode[],
  editWord?: string
) {
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
  copyToClipboard(text);
  // Copy steals focus. Force it back to the node's DOM element
  // without announcing via activateByNid().
  // TODO(pcardune): it would be better to focus on whatever the
  // previously focused element was, not or not.
  if (focusedNode) {
    focusedNode.element?.focus();
  }
}
