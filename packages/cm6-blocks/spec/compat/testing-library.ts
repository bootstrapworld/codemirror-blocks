/** `@testing-library/react`'s part that the old tests use, over `@testing-library/dom` (no React here) */
import { fireEvent as domFireEvent } from "@testing-library/dom";
export { screen, waitFor, createEvent, within } from "@testing-library/dom";
export const act = <T>(fn: () => T): T => fn();
export const cleanup = (): void => {};
/**
 * React's `onChange` is the browser's `input` event; `fireEvent.change` of the React testing library therefore reaches it. Here a handler listens
 * for the real events, so a `change` that sets a value on a text field is sent as the `input` a person's typing makes, and then as `change`.
 */
export const fireEvent: typeof domFireEvent = Object.assign(
  (el: Element | Document | Window, ev: Event) => domFireEvent(el, ev),
  domFireEvent,
  {
    change(el: Element, init?: { target?: Record<string, unknown> }) {
      const isText =
        el instanceof HTMLInputElement &&
        !["checkbox", "radio"].includes(el.type);
      const r = domFireEvent.change(el, init);
      if (isText || el instanceof HTMLTextAreaElement) domFireEvent.input(el);
      return r;
    },
  }
) as never;
