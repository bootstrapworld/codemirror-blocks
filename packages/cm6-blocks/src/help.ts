/*
 * EXPERIMENT. The help dialog (Shift-Ctrl-/): the keys of `keys.ts` in a table, in a modal box next to the editor. Escape or the button
 * closes it and the focus goes back to where it was. The old editor's dialog is the same list ("Keyboard Shortcuts").
 */
import { KEYS, writeKey } from "./keys";

export interface Help {
  close(): void;
}

export function openHelp(host: HTMLElement, mac: boolean, done: () => void): Help {
  const doc = host.ownerDocument;
  const box = doc.createElement("div");
  box.className = "blocks-help";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Keyboard Shortcuts");
  box.tabIndex = -1;
  const h = doc.createElement("h2");
  h.textContent = "Keyboard Shortcuts";
  box.appendChild(h);
  const table = doc.createElement("table");
  table.className = "shortcuts";
  const body = doc.createElement("tbody");
  for (const k of KEYS) {
    const tr = doc.createElement("tr");
    const what = doc.createElement("td");
    what.textContent = k.description;
    const keys = doc.createElement("td");
    for (const key of k.keys) {
      const kbd = doc.createElement("kbd");
      kbd.textContent = writeKey(key, mac);
      keys.appendChild(kbd);
    }
    tr.append(what, keys);
    body.appendChild(tr);
  }
  table.appendChild(body);
  box.appendChild(table);
  const close = doc.createElement("button");
  close.textContent = "Close";
  close.className = "closeDialog";
  box.appendChild(close);
  let open = true;
  const finish = (): void => {
    if (!open) return;
    open = false;
    box.remove();
    done();
  };
  close.addEventListener("click", finish);
  box.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
    }
  });
  host.appendChild(box);
  close.focus();
  return { close: finish };
}
