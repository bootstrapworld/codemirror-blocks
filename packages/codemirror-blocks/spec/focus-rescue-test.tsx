import { act } from "@testing-library/react";
import example from "@bootstrapworld/example";
import { API } from "../src/CodeMirrorBlocks";
import {
  elementForNode,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";

/**
 * The editor puts a block's widgets on the page again after an edit elsewhere,
 * and the browser then drops focus to the body without the block being rendered
 * (so no effect of it runs). The block that has focus takes it back, unless
 * someone has pressed somewhere since: that is leaving, not losing.
 */
let cmb!: API;
const frames = (n = 3) =>
  act(
    () =>
      new Promise<void>((done) => {
        const step = (i: number) =>
          i === 0 ? done() : requestAnimationFrame(() => step(i - 1));
        step(n);
      })
  );
const focusedBlock = () => {
  const node = cmb.getAst().rootNodes[0];
  mouseDown(node);
  return elementForNode(node)!;
};
// (what the editor does to a widget: the page changes, and focus falls to the body)
const dropFocus = async () => {
  (document.activeElement as HTMLElement).blur();
  expect(document.activeElement).toBe(document.body);
  act(() => {
    document.body.appendChild(document.createElement("span"));
  });
  await frames();
};

beforeEach(() => {
  cmb = mountCMB(example).cmb;
  cmb.setValue("(+ 1 2)");
});
afterEach(() => teardown());

describe("a focused block, when the page drops focus to the body", () => {
  it("takes focus back after the page changes", async () => {
    const el = focusedBlock();
    el.focus();
    await frames(15);
    await dropFocus();
    expect(document.activeElement).toBe(el);
  });

  it("does not, after a press somewhere on the page", async () => {
    const el = focusedBlock();
    el.focus();
    await frames(15);
    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
    });
    await dropFocus();
    expect(document.activeElement).toBe(document.body);
  });
});
