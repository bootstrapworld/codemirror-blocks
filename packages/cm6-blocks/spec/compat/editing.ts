import { fireEvent } from "@testing-library/dom";

/** Replace the whole text of the edit box that has focus (this editor's is an `input` or `textarea`; the old one's a contenteditable) */
export function setEditableText(text: string) {
  const el = document.activeElement;
  if (!el) throw new Error("nothing has focus");
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) fireEvent.input(el, { target: { value: text } });
  else fireEvent.input(el, { target: { innerHTML: text } });
}
