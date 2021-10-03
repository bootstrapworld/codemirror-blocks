import { debugLog, minimizeChange } from "../src/utils";

debugLog("Doing util-test.js");

describe("The src/utils helper functions", function () {
  describe("the minimizeChange function", function () {
    it("should handle empty text OK", function () {
      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 1, ch: 1 },
          text: [""],
          removed: [""],
        })
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 1 },
        text: [""],
        removed: [""],
      });

      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 1, ch: 1 },
          text: [""],
          removed: ["a"],
        })
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 1 },
        text: [""],
        removed: ["a"],
      });
    });

    it("should find the first differing char", function () {
      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 1, ch: 4 },
          text: ["xbc"],
          removed: ["abc"],
        })
      ).toEqual({
        from: { line: 1, ch: 1 },
        to: { line: 1, ch: 4 },
        text: ["xbc"],
        removed: ["abc"],
      });

      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 1, ch: 4 },
          text: ["abx"],
          removed: ["abc"],
        })
      ).toEqual({
        from: { line: 1, ch: 3 },
        to: { line: 1, ch: 4 },
        text: ["x"],
        removed: ["c"],
      });

      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 1, ch: 4 },
          text: ["abc"],
          removed: ["abc"],
        })
      ).toEqual({
        from: { line: 1, ch: 4 },
        to: { line: 1, ch: 4 },
        text: [""],
        removed: [""],
      });
    });

    it("should find all identical lines", function () {
      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 2, ch: 1 },
          text: ["a", "b"],
          removed: ["a", "b"],
        })
      ).toEqual({
        from: { line: 2, ch: 1 },
        to: { line: 2, ch: 1 },
        text: [""],
        removed: [""],
      });

      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 2, ch: 1 },
          text: ["ab", "c"],
          removed: ["ab", "x"],
        })
      ).toEqual({
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 1 },
        text: ["c"],
        removed: ["x"],
      });

      expect(
        minimizeChange({
          from: { line: 1, ch: 1 },
          to: { line: 2, ch: 2 },
          text: ["a", "bc"],
          removed: ["a", "c"],
        })
      ).toEqual({
        from: { line: 2, ch: 0 },
        to: { line: 2, ch: 2 },
        text: ["bc"],
        removed: ["c"],
      });
    });
  });
});
