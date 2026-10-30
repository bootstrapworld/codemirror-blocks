import wescheme from "../src/languages/wescheme";
import {
  elementForNode,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import { API } from "../src/CodeMirrorBlocks";
import { isBlockNodeMarker } from "../src/editor";
import { dragOnto, dropOnWhitespace, kids, select } from "./helpers/gestures";
import { getNodeLabeled } from "./helpers/dnd";
import { setEditableText } from "./helpers/editing";

/**
 * CodeMirror drops the marker that turns a root's text into a block whenever
 * the text under it is replaced, even when the new text parses to exactly the
 * same block. The editor must draw such a block again.
 */

let cmb: API;
beforeEach(() => {
  cmb = mountCMB(wescheme).cmb;
});
afterEach(() => {
  jest.restoreAllMocks();
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  teardown();
});

const blockMarkers = () => cmb.getCM().getAllMarks().filter(isBlockNodeMarker);
const rootStrings = () => cmb.getAst().rootNodes.map((n) => n.toString());
const drawnRoots = () =>
  cmb
    .getAst()
    .rootNodes.map((n) => elementForNode(n))
    .filter((el) => el && cmb.getWrapperElement().contains(el)).length;

describe("a root that an edit leaves looking the same", () => {
  it("is still a block after its placeholder is deleted again", () => {
    cmb.setValue("(... x)\n42");
    const placeholder = kids(cmb.getAst().rootNodes[0])[0];
    expect(placeholder.type).toBe("blank");
    select(placeholder);
    keyDown("Delete", {}, placeholder);
    expect(cmb.getValue()).toBe("(... x)\n42");
    expect(blockMarkers()).toHaveLength(2);
    expect(drawnRoots()).toBe(2);
  });

  it("is still a block after its placeholder is dragged to the trash can", () => {
    cmb.setValue("(... x)\n42");
    const placeholder = kids(cmb.getAst().rootNodes[0])[0];
    dragOnto(
      elementForNode(placeholder)!,
      document.querySelector(".TrashCan")!
    );
    expect(cmb.getValue()).toBe("(... x)\n42");
    expect(blockMarkers()).toHaveLength(2);
    expect(drawnRoots()).toBe(2);
  });

  it("is still a block after being dragged to where it already was", () => {
    cmb.setValue("x\nc");
    // delete c, then add it again at the end of line 0: the same two roots
    dropOnWhitespace(cmb, getNodeLabeled(/^c,/), { line: 0, ch: 1 });
    expect(rootStrings()).toEqual(["x", "c"]);
    expect(blockMarkers()).toHaveLength(2);
    expect(drawnRoots()).toBe(2);
  });

  it("keeps working: the redrawn block can be edited", () => {
    cmb.setValue("(... x)\n42");
    const placeholder = kids(cmb.getAst().rootNodes[0])[0];
    select(placeholder);
    keyDown("Delete", {}, placeholder);
    const root = cmb.getAst().rootNodes[0];
    mouseDown(root);
    keyDown("Enter", { ctrlKey: true }, root);
    setEditableText("(g y)");
    keyDown("Enter");
    expect(cmb.getValue()).toBe("(g y)\n42");
    expect(blockMarkers()).toHaveLength(2);
  });
});
