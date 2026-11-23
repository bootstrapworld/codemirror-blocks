/*
 * EXPERIMENT. The text/blocks toggle of the old editor: its button (`.blocks-toggle-btn`, "Switch to text mode" / "Switch to blocks mode"), the
 * classes the editor's element carries (`Editor`, and `blocks` or `text`), the toolbar that closes in text mode, and the dialog that explains why a
 * text that does not parse cannot be shown as blocks. The switch itself is `ed.setMode` (lezer-view.ts); the animation is morph.ts.
 *
 *   const toggle = mountModeToggle(ed, element);   // element: what holds the editor, and (optionally) a `.toolbar-pane` child
 *   toggle.destroy();
 */
import type { LezerBlockEditor } from "./lezer-view";
import { endMorph, morphing, switchWithMorph } from "./morph";
import { modalOpen, trapTab } from "./modal";

export interface ModeToggle {
  readonly button: HTMLButtonElement;
  /** the same as pressing the button */
  toggle(): void;
  destroy(): void;
}

/** the dialog "Could not convert to Blocks": modal, closed by Escape or its button, and the focus goes back to where it was */
export function openModeError(
  host: HTMLElement,
  message: string,
  done: () => void
): { close(): void } {
  const doc = host.ownerDocument;
  const before = doc.activeElement as HTMLElement | null;
  const box = doc.createElement("div");
  box.className = "blocks-help blocks-mode-error";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Could not convert to Blocks");
  box.tabIndex = -1;
  const h = doc.createElement("h2");
  h.textContent = "Could not convert to Blocks";
  const p = doc.createElement("p");
  p.textContent = message;
  const close = doc.createElement("button");
  close.textContent = "Close";
  close.className = "closeDialog";
  box.append(h, p, close);
  let open = true;
  let release = (): void => {};
  const finish = (): void => {
    if (!open) return;
    open = false;
    release();
    box.remove();
    if (before?.isConnected) before.focus();
    done();
  };
  close.addEventListener("click", finish);
  box.addEventListener("keydown", (e) => {
    e.stopPropagation();
    trapTab(box, e);
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
    }
  });
  host.appendChild(box);
  release = modalOpen(box, finish);
  close.focus();
  return { close: finish };
}

/**
 * The button and the classes for `ed`, in `root`. Pressing the button switches the mode with the words floating (morph.ts); a switch to blocks that
 * the text does not allow opens the dialog with the parser's message, and the editor stays in text mode. A mode switched in code (`ed.setMode`)
 * is followed by the button and the classes, without the animation.
 */
export function mountModeToggle(
  ed: LezerBlockEditor,
  root: HTMLElement
): ModeToggle {
  const doc = root.ownerDocument;
  const button = doc.createElement("button");
  button.className = "blocks-toggle-btn btn btn-default btn-sm";
  button.type = "button";
  const icon = doc.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  const title = doc.createElement("span");
  title.className = "btn-title screenreader-only";
  button.append(icon, title);
  root.classList.add("Editor");
  root.insertBefore(button, root.firstChild);
  let dialog: { close(): void } | null = null;

  const show = (mode: "text" | "blocks"): void => {
    root.classList.toggle("blocks", mode === "blocks");
    root.classList.toggle("text", mode === "text");
    icon.textContent = mode === "blocks" ? "✏️" : "\u{1F9F1}";
    title.textContent = `Switch to ${mode === "blocks" ? "text" : "blocks"} mode`;
    // (the toolbar of a text is closed: not heard, not reached)
    const pane = root.querySelector(":scope > .toolbar-pane");
    if (pane) {
      pane.setAttribute("aria-hidden", String(mode === "text"));
      pane.toggleAttribute("inert", mode === "text");
    }
  };
  show(ed.mode);
  const stopListening = ed.onModeChange(show);

  const toggle = (): void => {
    const toBlocks = ed.mode === "text";
    const problem = toBlocks ? ed.modeProblem() : null;
    if (problem) {
      // (a program that is not one cannot be made blocks, and says so at once)
      if (dialog) return;
      dialog = openModeError(root, problem, () => (dialog = null));
      return;
    }
    switchWithMorph(
      root,
      toBlocks,
      () => ed.setMode(toBlocks ? "blocks" : "text") === null,
      {
        scroller: ed.view.scrollDOM,
        lines: ed.view.contentDOM,
      }
    );
  };
  const onClick = (): void => {
    // (a press while the toolbar is still opening makes the switch that is on its way, at once, and that is all it does)
    if (morphing() && endMorph()) return;
    toggle();
  };
  button.addEventListener("click", onClick);
  return {
    button,
    toggle,
    destroy() {
      stopListening();
      button.removeEventListener("click", onClick);
      dialog?.close();
      button.remove();
      endMorph();
    },
  };
}
