import { act } from "@testing-library/react";
import wescheme from "@bootstrapworld/cmb-wescheme";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import {
  MAX_ACTIVITIES,
  UIEvent,
  getLog,
  getReducerActivities,
  resetActivityLog,
} from "../src/state/activityLog";
import { installFakeClipboard } from "./helpers/clipboard";
import { setEditableText } from "./helpers/editing";
import {
  dragOnto,
  dropTargets,
  pasteAtCursor,
  toolbarPrimitive,
  typeChar,
} from "./helpers/gestures";

/** the person's own doings so far, without the states they caused */
const events = () =>
  getLog().filter((e) =>
    [
      "KEY",
      "MOUSE",
      "DRAG",
      "EDIT",
      "EDIT_CANCEL",
      "TYPE",
      "PASTE",
      "CLIP",
      "MODE",
      "SEARCH",
    ].includes(e.type)
  ) as UIEvent[];

const block = (cmb: ReturnType<typeof mountCMB>["cmb"], i: number) => {
  const node = cmb.getAst().rootNodes[i];
  return { node, el: document.getElementById(`block-node-${node.id}`)! };
};

describe("recording what people do", () => {
  beforeEach(() => resetActivityLog());
  afterEach(() => {
    jest.restoreAllMocks();
    teardown();
  });

  it("records keys (only the ones the editor acts on), with the block that had them", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)\n(g y)");
    const { node, el } = block(cmb, 1);
    mouseDown(el);
    keyDown("q", {}, el); // (no command: not recorded)
    keyDown("ArrowDown", {}, el);
    keyDown("Z", { ...cmd_ctrl, shiftKey: true }, el);
    expect(events()).toEqual([
      { type: "MOUSE", nid: node.nid },
      { type: "KEY", key: "ArrowDown", nid: node.nid },
      {
        type: "KEY",
        key: "Z",
        mods: (cmd_ctrl.ctrlKey ? "C" : "M") + "S",
        nid: node.nid,
      },
    ]);
  });

  it("records the text an edit box was saved with, and a cancelled edit", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)");
    const { el } = block(cmb, 0);
    mouseDown(el);
    keyDown("Enter", cmd_ctrl, el);
    setEditableText("(f y)");
    keyDown("Enter", {}, document.activeElement!);
    keyDown("Enter", cmd_ctrl, block(cmb, 0).el);
    keyDown("Escape", {}, document.activeElement!);
    expect(events().filter((e) => e.type.startsWith("EDIT"))).toEqual([
      { type: "EDIT", text: "(f y)", how: "enter" },
      { type: "EDIT_CANCEL" },
    ]);
  });

  it("records typing and pasting at the top level, and the pasted clipboard", () => {
    const { cmb } = mountCMB(wescheme);
    installFakeClipboard("(h 1)");
    cmb.setValue("(f x)");
    act(() => cmb.getCM().setCursor({ line: 0, ch: 5 }));
    typeChar(cmb, "z");
    pasteAtCursor(cmb, "(p q)");
    const { el } = block(cmb, 0);
    mouseDown(el);
    keyDown("V", cmd_ctrl, el);
    expect(events().map((e) => e.type)).toEqual([
      "TYPE",
      "PASTE",
      "MOUSE",
      "EDIT", // (the pasted text, saved when the click moved on)
      "KEY",
      "CLIP",
    ]);
    expect(events()[0]).toMatchObject({ char: "z", sel: { from: { ch: 5 } } });
    expect(events()[1]).toMatchObject({ text: "(p q)" });
    expect(events()[5]).toEqual({ type: "CLIP", text: "(h 1)" });
  });

  it("records drags from a block and from the toolbar, to a block, a gap and the trash", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)\n(g y)");
    const a = block(cmb, 0);
    const b = block(cmb, 1);
    const y = [...b.node.children()][1]; // (a literal: a block can land on it)
    dragOnto(a.el, document.getElementById(`block-node-${y.id}`)!);
    dragOnto(toolbarPrimitive("sqrt"), dropTargets(cmb.getWrapperElement())[1]);
    dragOnto(block(cmb, 0).el, document.querySelector(".TrashCan")!);
    const drags = events().filter((e) => e.type === "DRAG");
    expect(drags).toEqual([
      { type: "DRAG", from: { nid: a.node.nid }, to: { nid: y.nid } },
      { type: "DRAG", from: { tool: "sqrt" }, to: { gap: 1 } },
      { type: "DRAG", from: expect.objectContaining({}), to: { trash: true } },
    ]);
  });

  it("keeps the log bounded, and says where what is left starts", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)");
    const { el } = block(cmb, 0);
    for (let i = 0; i < MAX_ACTIVITIES + 40; i++) mouseDown(el);
    expect(getLog()).toHaveLength(MAX_ACTIVITIES);
    expect(getReducerActivities().length).toBeLessThan(MAX_ACTIVITIES);
  });

  it("records nothing while nobody does anything", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue("(f x)");
    const before = getLog().length;
    act(() => cmb.getCM().setCursor({ line: 0, ch: 1 }));
    expect(events()).toEqual([]);
    expect(getLog().length - before).toBeLessThanOrEqual(2); // (focus moves only)
  });
});
