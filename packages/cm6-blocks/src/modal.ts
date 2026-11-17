/*
 * EXPERIMENT. What the old editor's dialogs get from react-modal (`components/Dialog.tsx`), for the dialogs of this package (help, search):
 * while a dialog is open the rest of the page is hidden from screen readers (react-modal puts `aria-hidden="true"` on the app element;
 * here the app element is not known, so every sibling of the dialog and of its ancestors gets it, which is the whole page but the
 * dialog) and cannot be reached (`inert`, where the browser has it), the focus stays inside the dialog, and everything is put back as
 * it was when the dialog goes, whichever way it goes.
 */

interface Saved {
  count: number;
  aria: string | null;
  inert: string | null;
}
/** one record for each element hidden, shared by all open dialogs: an element hidden by two of them comes back when the last one closes */
const hidden = new WeakMap<Element, Saved>();
/** the open dialogs, the newest last: only that one holds the focus */
const open: HTMLElement[] = [];
const NEVER = new Set([
  "SCRIPT",
  "STYLE",
  "LINK",
  "META",
  "TEMPLATE",
  "HEAD",
  "TITLE",
  "NOSCRIPT",
]);

/** the parts of the page that must go on being heard: live regions (the editor announces what it does through one) */
const isLive = (e: Element): boolean =>
  e.hasAttribute("aria-live") ||
  e.getAttribute("role") === "status" ||
  e.getAttribute("role") === "alert";

/**
 * Hide everything but `dialog` (and what it sits in) from screen readers and from the keyboard and the pointer, and keep the focus
 * inside it. Returns the function that puts it all back: call it BEFORE moving the focus back to where it was.
 */
export function modalOpen(
  dialog: HTMLElement,
  onOutside?: () => void
): () => void {
  const doc = dialog.ownerDocument;
  const mine: Element[] = [];
  for (
    let node: Element = dialog;
    node.parentElement;
    node = node.parentElement
  ) {
    for (const sib of Array.from(node.parentElement.children)) {
      if (sib === node || NEVER.has(sib.tagName) || isLive(sib)) continue;
      const saved = hidden.get(sib);
      if (saved) saved.count++;
      else {
        hidden.set(sib, {
          count: 1,
          aria: sib.getAttribute("aria-hidden"),
          inert: sib.getAttribute("inert"),
        });
        sib.setAttribute("aria-hidden", "true");
        sib.setAttribute("inert", "");
      }
      mine.push(sib);
    }
  }
  // the overlay (react-modal's: `ReactModal__Overlay`, a pane over the whole page behind the dialog; a click on it asks to close):
  // made after the page was hidden so it is not hidden itself, and it is for the pointer only: not announced, not focusable
  let overlay: HTMLElement | null = null;
  if (onOutside && dialog.parentElement) {
    const o = doc.createElement("div");
    overlay = o;
    o.className = "blocks-overlay";
    o.setAttribute("aria-hidden", "true");
    o.addEventListener("mousedown", (e) => e.preventDefault()); // (no focus to the body)
    o.addEventListener("click", (e) => {
      if (e.target === o && open[open.length - 1] === dialog) onOutside();
    });
    dialog.parentElement.insertBefore(o, dialog);
  }
  open.push(dialog);
  let last: HTMLElement = dialog;
  let released = false;
  const onFocus = (e: FocusEvent): void => {
    const t = e.target as Node | null;
    if (!t || !dialog.isConnected || open[open.length - 1] !== dialog) return;
    if (dialog.contains(t)) last = t as HTMLElement;
    else
      (last.isConnected && dialog.contains(last) ? last : dialog).focus({
        preventScroll: true,
      });
  };
  // (a click on something that cannot take focus, or on the hidden page, sends it to the body: it goes back in)
  const onBlur = (): void => {
    setTimeout(() => {
      const a = doc.activeElement;
      if (
        released ||
        !dialog.isConnected ||
        open[open.length - 1] !== dialog ||
        (a && a !== doc.body && a !== doc.documentElement)
      )
        return;
      (last.isConnected && dialog.contains(last) ? last : dialog).focus({
        preventScroll: true,
      });
    }, 0);
  };
  doc.addEventListener("focusin", onFocus, true);
  dialog.addEventListener("focusout", onBlur);
  return () => {
    if (released) return;
    released = true;
    overlay?.remove();
    open.splice(open.indexOf(dialog), 1);
    doc.removeEventListener("focusin", onFocus, true);
    dialog.removeEventListener("focusout", onBlur);
    for (const el of mine) {
      const saved = hidden.get(el);
      if (!saved || --saved.count > 0) continue;
      hidden.delete(el);
      if (saved.aria === null) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", saved.aria);
      if (saved.inert === null) el.removeAttribute("inert");
      else el.setAttribute("inert", saved.inert);
    }
  };
}

/** Tab and Shift-Tab go round the focusable things inside `dialog` and never out of it */
export function trapTab(dialog: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== "Tab") return;
  const f = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      "input, select, textarea, button, a[href], [tabindex]"
    )
  ).filter(
    (x) =>
      x.tabIndex >= 0 &&
      !x.closest("[hidden]") &&
      !(x as HTMLButtonElement).disabled
  );
  if (!f.length) {
    e.preventDefault();
    return;
  }
  const i = f.indexOf(e.target as HTMLElement);
  const to = e.shiftKey
    ? f[(i <= 0 ? f.length : i) - 1]
    : f[(i + 1) % f.length];
  e.preventDefault();
  to.focus();
}
