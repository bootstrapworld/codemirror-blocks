/** @jest-environment jsdom */
import wescheme from "./compat/wescheme";
import { teardown, mountCMB } from "./compat/test-utils";
import { drag, getNodeLabeled } from "./compat/dnd";

afterEach(teardown);

describe("a drop on a block inside a top-level block replaces it", () => {
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
  it("does nothing on the dragged block's own ancestor", () => {
    const { cmb } = mountCMB(wescheme);
    cmb.setValue(`(f (g x) y)`);
    drag(getNodeLabeled(/^x\b/)).dropOnto(getNodeLabeled(/call to g /));
    expect(cmb.getValue()).toBe("(f (g x) y)");
  });
});
