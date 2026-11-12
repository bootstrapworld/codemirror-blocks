import { act } from "@testing-library/react";
import example from "@bootstrapworld/example";
import CodeMirrorBlocks, { API } from "../src/CodeMirrorBlocks";
import {
  elementForNode,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";

/**
 * Focus that the page drops with no render to notice is given back to the
 * focused block, in the editor the user is in, and in no other (focus.ts).
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
// (what the editor does to a widget: the page changes, and focus falls to the body)
const dropFocus = async (inside: HTMLElement) => {
  (document.activeElement as HTMLElement).blur();
  expect(document.activeElement).toBe(document.body);
  act(() => {
    inside.appendChild(document.createElement("span"));
  });
  await frames();
};
const press = (target: Element) =>
  act(() => {
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

describe("an editor", () => {
  let cmb!: API;
  beforeEach(() => {
    cmb = mountCMB(example).cmb;
    cmb.setValue("(+ 1 2)");
  });
  afterEach(() => teardown());

  it("takes focus back after a press somewhere else inside it", async () => {
    const node = cmb.getAst().rootNodes[0];
    mouseDown(node);
    const el = elementForNode(node)!;
    el.focus();
    await frames();
    // (not on a block: on the editor's own scrolling area)
    press(cmb.getScrollerElement());
    await dropFocus(cmb.getWrapperElement() as HTMLElement);
    expect(document.activeElement).toBe(el);
  });

  it("does not, once a press has been made outside it", async () => {
    const node = cmb.getAst().rootNodes[0];
    mouseDown(node);
    elementForNode(node)!.focus();
    await frames();
    press(document.body);
    await dropFocus(cmb.getWrapperElement() as HTMLElement);
    expect(document.activeElement).toBe(document.body);
  });

  it("does not, once focus has gone to something outside it", async () => {
    const node = cmb.getAst().rootNodes[0];
    mouseDown(node);
    elementForNode(node)!.focus();
    await frames();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => input.focus());
    act(() => input.blur());
    await dropFocus(cmb.getWrapperElement() as HTMLElement);
    expect(document.activeElement).toBe(document.body);
    input.remove();
  });
});

describe("two editors on a page", () => {
  const open = (value: string) => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    let editor!: API;
    act(() => {
      editor = CodeMirrorBlocks(
        div,
        { value, incrementalRendering: false, collapseAll: false },
        "example"
      );
    });
    // (jsdom has no layout: say how big the editor is, so that it draws its lines)
    const wrapper = editor.getWrapperElement();
    for (const size of [
      "offsetHeight",
      "offsetWidth",
      "clientHeight",
      "clientWidth",
    ]) {
      jest.spyOn(wrapper, size as "offsetHeight", "get").mockReturnValue(1000);
    }
    act(() => editor.setBlockMode(true));
    act(() => editor.getCM().refresh());
    return editor;
  };
  let a!: API;
  let b!: API;
  beforeEach(() => {
    a = open("(+ 1 2)");
    b = open("(* 3 4)");
  });

  it("a change in one does not take focus from the block that has it in the other", async () => {
    const node = a.getAst().rootNodes[0];
    mouseDown(node);
    const el = elementForNode(node)!;
    el.focus();
    await frames();
    act(() => b.setValue("(* 5 6)"));
    await frames();
    expect(document.activeElement).toBe(el);
  });

  it("a drop in one gives focus back in that one, and does not move it into the other", async () => {
    const node = a.getAst().rootNodes[0];
    mouseDown(node);
    const el = elementForNode(node)!;
    el.focus();
    await frames();
    act(() => b.setValue("(* 5 6)"));
    await frames();
    await dropFocus(a.getWrapperElement() as HTMLElement);
    expect(document.activeElement).toBe(el);
    expect(b.getWrapperElement().contains(document.activeElement)).toBe(false);
  });

  it("focus on the placeholder of one does not let the other take it", async () => {
    const focusBlock = async (editor: API) => {
      const node = editor.getAst().rootNodes[0];
      mouseDown(node);
      elementForNode(node)!.focus();
      await frames();
    };
    await focusBlock(b);
    await focusBlock(a);
    const placeholder = a
      .getWrapperElement()
      .closest(".Editor")!
      .parentElement!.querySelector<HTMLElement>("#cmb-focus-placeholder")!;
    act(() => placeholder.focus());
    expect(document.activeElement).toBe(placeholder);
    // (the page changes in B, and its editor draws: nothing is rendered)
    act(() => {
      b.getWrapperElement().appendChild(document.createElement("span"));
      b.getCM().refresh();
    });
    await frames();
    expect(document.activeElement).toBe(placeholder);
  });
});
