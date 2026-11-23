/** @jest-environment jsdom */
import wescheme from "./compat/wescheme";
import { teardown, mountCMB } from "./compat/test-utils";
import { drag, getNodeLabeled } from "./compat/dnd";

afterEach(teardown);

describe("a drop on a value inside a top-level block replaces it", () => {
  it("replaces the block and takes the dragged one out of its old place", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(add firstVar secondVar) (sub fourthVar fifthVar)`);
    drag(getNodeLabeled(/firstVar/)).dropOnto(getNodeLabeled(/fifthVar/));
    expect(cmb.getValue()).toBe("(add secondVar) (sub fourthVar firstVar)");
  });
  it("works inside one list", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f x y)`);
    drag(getNodeLabeled(/^y\b/)).dropOnto(getNodeLabeled(/^x\b/));
    expect(cmb.getValue()).toBe("(f y)");
  });
  it("does not replace a compound block: only values (literals, blanks) are drop targets, as in the old editor", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f (g a b) y)\n(h z)`);
    drag(getNodeLabeled(/^z\b/)).dropOnto(getNodeLabeled(/a g expression /));
    // z did not take the place of (g a b)
    expect(cmb.getValue()).toContain("(g a b)");
  });
  it("does nothing on the dragged block's own ancestor", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f (g x) y)`);
    drag(getNodeLabeled(/^x\b/)).dropOnto(getNodeLabeled(/a g expression /));
    expect(cmb.getValue()).toBe("(f (g x) y)");
  });
});

describe("the trash can (an element with the class TrashCan)", () => {
  it("deletes the dragged block", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f x y)\n(g z)`);
    drag(getNodeLabeled(/a f expression /)).dropOnto(
      document.querySelector(".TrashCan")!
    );
    expect(cmb.getValue().trim()).toBe("(g z)");
  });
  it("deletes a block inside another", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f x y)`);
    drag(getNodeLabeled(/^x\b/)).dropOnto(document.querySelector(".TrashCan")!);
    expect(cmb.getValue()).toBe("(f y)");
  });
  it("deletes nothing when the drag is cancelled over it", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f x y)`);
    const dragging = drag(getNodeLabeled(/^x\b/));
    dragging.dragOver(document.querySelector(".TrashCan")!);
    dragging.cancel();
    expect(cmb.getValue()).toBe("(f x y)");
  });
});
