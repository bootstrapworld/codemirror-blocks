import wescheme from "@bootstrapworld/wescheme";
import { areNodesEqualish } from "../src/ui/ToplevelBlock";

const { parse } = wescheme;

/**
 * A root's block marker covers its comment, so a root whose comment moves must
 * be drawn again even though its own text and position are unchanged.
 */
describe("areNodesEqualish", () => {
  const root = (code: string) => parse(code)[0];

  it("is false when only the root's comment moved", () => {
    const before = root("#| c |#\nfoo");
    const after = root("\nfoo #| c |#");
    expect(after.from).toEqual(before.from);
    expect(areNodesEqualish(before, after)).toBe(false);
  });

  it("is true for the same text", () => {
    expect(areNodesEqualish(root("foo #| c |#"), root("foo #| c |#"))).toBe(
      true
    );
  });
});
