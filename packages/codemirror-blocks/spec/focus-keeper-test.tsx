import { act } from "@testing-library/react";
import example from "@bootstrapworld/example";
import CodeMirrorBlocks, { API } from "../src/CodeMirrorBlocks";
import wescheme from "@bootstrapworld/wescheme";
import {
  elementForNode,
  keyDown,
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
  const open = (value: string, language = "example") => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    let editor!: API;
    act(() => {
      editor = CodeMirrorBlocks(
        div,
        { value, incrementalRendering: false, collapseAll: false },
        language
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

  it("focus on the placeholder of one is not taken into the other", async () => {
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
    // (A may take focus from its own placeholder: it is B that must not)
    expect(b.getWrapperElement().contains(document.activeElement)).toBe(false);
  });

  it("a block that is not drawn in one is waited for on that one's placeholder", () => {
    const c = open("a b", "wescheme");
    const [first, second] = c.getAst().rootNodes;
    mouseDown(first);
    const gone = elementForNode(second)!;
    gone.remove();
    keyDown("ArrowDown", {}, elementForNode(first)!);
    const own = c
      .getWrapperElement()
      .closest(".Editor")!
      .parentElement!.querySelector("#cmb-focus-placeholder");
    expect(document.activeElement).toBe(own);
    expect(document.activeElement).not.toBe(
      a
        .getWrapperElement()
        .closest(".Editor")!
        .parentElement!.querySelector("#cmb-focus-placeholder")
    );
  });
});

describe("a change made through the API", () => {
  let cmb!: API;
  let input!: HTMLInputElement;
  beforeEach(() => {
    cmb = mountCMB(wescheme).cmb;
    cmb.setValue("(+ 1 2)\n(f x)");
    input = document.createElement("input");
    document.body.appendChild(input);
  });
  afterEach(() => {
    input.remove();
    teardown();
  });

  for (const beenIn of [false, true]) {
    const when = beenIn
      ? "after the user was in the editor"
      : "in an editor never entered";
    it(`does not take focus from something outside the editor: setValue ${when}`, async () => {
      if (beenIn) {
        mouseDown(cmb.getAst().rootNodes[0]);
        await frames();
      }
      act(() => input.focus());
      cmb.setValue("(g 1)\n(h 2)");
      await frames(6);
      expect(document.activeElement).toBe(input);
    });
    it(`does not take focus from something outside the editor: replaceRange ${when}`, async () => {
      if (beenIn) {
        mouseDown(cmb.getAst().rootNodes[0]);
        await frames();
      }
      act(() => input.focus());
      cmb.replaceRange("9", { line: 0, ch: 3 }, { line: 0, ch: 4 });
      await frames(6);
      expect(document.activeElement).toBe(input);
    });
  }
});
