import { debugLog, minimizeChange } from "../src/utils";

debugLog("Doing util-test.js");

describe("The src/utils helper functions", function () {
  const mockCm = {
    getRange: () => {
      throw new Error(
        `Should not need to lookup text in codemirror when removed is specified`
      );
    },
  };
  describe("the minimizeChange function", function () {
    it("should handle empty text OK", function () {
      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 1, ch: 1 },
            text: [""],
            removed: [""],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 1 },
        text: [""],
        removed: [""],
      });

      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 1, ch: 1 },
            text: [""],
            removed: ["a"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 1 },
        text: [""],
        removed: ["a"],
      });
    });

    it("should find the first differing char", function () {
      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 1, ch: 4 },
            text: ["xbc"],
            removed: ["abc"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 4 },
        text: ["xbc"],
        removed: ["abc"],
      });

      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 1, ch: 4 },
            text: ["abx"],
            removed: ["abc"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 1, ch: 3 },
        to: { line: 1, ch: 4 },
        text: ["x"],
        removed: ["c"],
      });

      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 1, ch: 4 },
            text: ["abc"],
            removed: ["abc"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 1, ch: 4 },
        to: { line: 1, ch: 4 },
        text: [""],
        removed: [""],
      });
    });

    it("should find all identical lines", function () {
      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 2, ch: 1 },
            text: ["a", "b"],
            removed: ["a", "b"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 2, ch: 1 },
        to: { line: 2, ch: 1 },
        text: [""],
        removed: [""],
      });

      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 2, ch: 1 },
            text: ["ab", "c"],
            removed: ["ab", "x"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 1 },
        text: ["c"],
        removed: ["x"],
      });

      expect(
        minimizeChange(
          {
            from: { line: 1, ch: 1 },
            to: { line: 2, ch: 2 },
            text: ["a", "bc"],
            removed: ["a", "c"],
          },
          mockCm
        )
      ).toEqual({
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 2 },
        text: ["bc"],
        removed: ["c"],
      });
    });
  });
});
