import React from "react";
import CodeMirror from "codemirror";
import { act, render } from "@testing-library/react";
import CodeMirrorHost from "../src/ui/CodeMirrorHost";

/**
 * CodeMirror measures the page when it is shown and keeps what it measured: it
 * is told to measure again once the layout of the next frame is in.
 */
const frames = (n = 3) =>
  act(
    () =>
      new Promise<void>((done) => {
        const step = (i: number) =>
          i === 0 ? done() : requestAnimationFrame(() => step(i - 1));
        step(n);
      })
  );

it("measures again after the frame it was put in the page in", async () => {
  const cm = CodeMirror(() => undefined, { value: "a b" });
  const refresh = jest.spyOn(cm, "refresh");
  const { unmount } = render(<CodeMirrorHost codemirror={cm} value="a b" />);
  const atMount = refresh.mock.calls.length;
  expect(atMount).toBeGreaterThan(0);
  await frames();
  expect(refresh.mock.calls.length).toBeGreaterThan(atMount);
  unmount();
});

it("does not measure after it has been taken out of the page", async () => {
  const cm = CodeMirror(() => undefined, { value: "a b" });
  const refresh = jest.spyOn(cm, "refresh");
  const { unmount } = render(<CodeMirrorHost codemirror={cm} value="a b" />);
  const atMount = refresh.mock.calls.length;
  unmount();
  await frames();
  expect(refresh.mock.calls.length).toBe(atMount);
});
