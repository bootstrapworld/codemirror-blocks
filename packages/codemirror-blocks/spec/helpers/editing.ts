import { fireEvent } from "@testing-library/react";

/**
 * Replace the whole text of the contenteditable that currently has focus (a
 * node being edited, or a quarantine), as if the user had typed it.
 */
export function setEditableText(text: string) {
  const el = document.activeElement;
  if (!el) {
    throw new Error("nothing has focus");
  }
  fireEvent.input(el, { target: { innerHTML: text } });
}
