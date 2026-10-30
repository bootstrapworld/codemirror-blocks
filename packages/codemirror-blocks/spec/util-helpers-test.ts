import type { EditorChange } from "codemirror";
import wescheme from "../src/languages/wescheme";
import {
  BEEP,
  WRAP,
  adjustForChange,
  changeEnd,
  debugLog,
  getNodeContainingBiased,
  isDummyPos,
  logResults,
  dummyPos,
  nodeCommentContaining,
  partition,
  posWithinNode,
  setLogReporter,
  skipWhile,
  srcRangeContains,
  warn,
} from "../src/utils";

const pos = (line: number, ch: number) => ({ line, ch });

describe("srcRangeContains", () => {
  const range = { from: pos(1, 2), to: pos(3, 4) };

  it("is true inside the range, and on both of its ends", () => {
    expect(srcRangeContains(range, pos(2, 0))).toBe(true);
    expect(srcRangeContains(range, pos(1, 2))).toBe(true);
    expect(srcRangeContains(range, pos(3, 4))).toBe(true);
  });

  it("is false before the range and after it", () => {
    expect(srcRangeContains(range, pos(1, 1))).toBe(false);
    expect(srcRangeContains(range, pos(0, 9))).toBe(false);
    expect(srcRangeContains(range, pos(3, 5))).toBe(false);
    expect(srcRangeContains(range, pos(4, 0))).toBe(false);
  });
});

describe("small list helpers", () => {
  it("skipWhile moves on until the test fails, and handles a missing start", () => {
    const next = (n: number) => (n < 10 ? n + 1 : null);
    expect(skipWhile((n) => n < 5, 1, next)).toBe(5);
    expect(skipWhile((n) => n < 5, 7, next)).toBe(7);
    expect(skipWhile(() => true, 8, next)).toBeNull(); // ran off the end
    expect(skipWhile((n: number) => n < 5, null, next)).toBeNull();
    expect(skipWhile((n: number) => n < 5, undefined, next)).toBeUndefined();
  });

  it("partition splits a list in two, keeping the order", () => {
    expect(partition([1, 2, 3, 4, 5, 6], (n) => n % 2 === 0)).toEqual([
      [2, 4, 6],
      [1, 3, 5],
    ]);
    expect(partition([], () => true)).toEqual([[], []]);
  });

  it("warn says where a warning came from", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    warn("Editor", "careful");
    expect(spy).toHaveBeenCalledWith("CodeMirrorBlocks - Editor - careful");
    spy.mockRestore();
  });

  it("recognizes the dummy position", () => {
    expect(isDummyPos(dummyPos)).toBe(true);
    expect(isDummyPos(pos(-1, 3))).toBe(false); // only -1:0 is the dummy
    expect(isDummyPos(pos(0, 0))).toBe(false);
  });
});

describe("positions in the syntax tree", () => {
  // (f (g x)): the whole call is 0:0 to 0:9, (g x) is 0:3 to 0:8
  const ast = wescheme.buildAST("(f (g x))");
  const [root] = ast.rootNodes;
  const [f, inner] = [...root.children()];

  it("posWithinNode includes both ends of the node, and nothing past them", () => {
    expect(posWithinNode(pos(0, 3), inner)).toBe(true);
    expect(posWithinNode(pos(0, 5), inner)).toBe(true);
    expect(posWithinNode(pos(0, 8), inner)).toBe(true);
    expect(posWithinNode(pos(0, 2), inner)).toBe(false);
    expect(posWithinNode(pos(0, 9), inner)).toBe(false);
    expect(posWithinNode(pos(1, 0), inner)).toBe(false);
    expect(f.type).toBe("literal");
  });

  it("getNodeContainingBiased finds the smallest node that starts at or before the cursor", () => {
    const at = (line: number, ch: number) =>
      getNodeContainingBiased(pos(line, ch), ast)?.toString() ?? null;
    expect(at(0, 0)).toBe("(f (g x))"); // the call, before its first child
    expect(at(0, 1)).toBe("f");
    expect(at(0, 3)).toBe("(g x)"); // before g
    expect(at(0, 4)).toBe("g");
    expect(at(0, 6)).toBe("x");
    expect(at(0, 8)).toBe("(f (g x))"); // after (g x): back in the outer call
    expect(at(0, 9)).toBeNull(); // the end of the call is not in it
    expect(at(2, 0)).toBeNull();
  });

  it("a cursor in a node's comment finds the node", () => {
    const commented = wescheme.buildAST(";; note\n(f x)");
    const [call] = commented.rootNodes;
    const comment = call.options.comment!;
    expect(nodeCommentContaining(pos(0, 2), call)).toBeTruthy();
    expect(nodeCommentContaining(pos(1, 1), call)).toBeFalsy();
    expect(nodeCommentContaining(pos(0, 2), f)).toBeFalsy(); // no comment
    expect(
      getNodeContainingBiased(
        pos(comment.from.line, comment.from.ch + 1),
        commented
      )
    ).toBe(call);
  });
});

describe("following a change in the text", () => {
  // replace 1:2-2:3 with two lines, "XY" and "Z", which end at 2:1
  const change: EditorChange = {
    from: pos(1, 2),
    to: pos(2, 3),
    text: ["XY", "Z"],
    removed: ["", ""],
  };

  it("changeEnd is where the new text ends", () => {
    expect(changeEnd(change)).toEqual(pos(2, 1));
    expect(
      changeEnd({
        from: pos(4, 2),
        to: pos(4, 2),
        text: ["abc"],
        removed: [""],
      })
    ).toEqual(pos(4, 5));
    expect(
      changeEnd({
        from: pos(1, 0),
        to: pos(1, 3),
        text: [""],
        removed: ["abc"],
      })
    ).toEqual(pos(1, 0));
  });

  it("leaves a position before the change alone", () => {
    expect(adjustForChange(pos(0, 9), change, true)).toEqual(pos(0, 9));
    expect(adjustForChange(pos(1, 1), change, false)).toEqual(pos(1, 1));
  });

  it("keeps a start at the start of the change, but moves an end to the end of it", () => {
    expect(adjustForChange(pos(1, 2), change, true)).toEqual(pos(1, 2));
    expect(adjustForChange(pos(1, 2), change, false)).toEqual(pos(2, 1));
  });

  it("moves a position inside the changed text to the end of the change", () => {
    expect(adjustForChange(pos(1, 5), change, true)).toEqual(pos(2, 1));
    expect(adjustForChange(pos(2, 3), change, false)).toEqual(pos(2, 1));
  });

  it("shifts a position after the change on the same line over by its length", () => {
    // 2:3 was the end of the replaced text; 2:7 is four characters after it
    expect(adjustForChange(pos(2, 7), change, true)).toEqual(pos(2, 5));
  });

  it("shifts a position on a later line by the lines added or removed", () => {
    // two lines replaced by two lines: no later line moves
    expect(adjustForChange(pos(5, 4), change, true)).toEqual(pos(5, 4));
    const added: EditorChange = {
      from: pos(1, 0),
      to: pos(1, 0),
      text: ["", "", ""],
      removed: [""],
    };
    expect(adjustForChange(pos(5, 4), added, true)).toEqual(pos(7, 4));
    const joined: EditorChange = {
      from: pos(0, 1),
      to: pos(3, 0),
      text: [""],
      removed: ["", "", "", ""],
    };
    expect(adjustForChange(pos(4, 2), joined, true)).toEqual(pos(1, 2));
  });
});

describe("reporting a crash", () => {
  afterEach(() => setLogReporter(() => undefined));

  it("gives the reporter the history, the exception and a description", () => {
    const reporter = jest.fn();
    setLogReporter(reporter);
    const error = new Error("boom");
    logResults(error);
    logResults("again", "My description");
    expect(reporter).toHaveBeenCalledTimes(2);
    const [history, exception, description] = reporter.mock.calls[0];
    expect(Array.isArray(history)).toBe(true);
    expect(exception).toBe(error);
    expect(description).toBe("Crash Log");
    expect(reporter.mock.calls[1].slice(1)).toEqual([
      "again",
      "My description",
    ]);
  });

  it("survives a reporter that fails itself", () => {
    setLogReporter(() => {
      throw new Error("the reporter broke");
    });
    expect(() => logResults(new Error("boom"))).not.toThrow();
  });
});

describe("debugLog", () => {
  const original = process.env.DEBUG;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = original;
    }
    jest.restoreAllMocks();
  });

  it("prints only when DEBUG is set", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.DEBUG;
    debugLog("quiet");
    expect(log).not.toHaveBeenCalled();
    process.env.DEBUG = "1";
    debugLog("loud", 2);
    expect(log).toHaveBeenCalledWith("loud", 2);
  });
});

describe("the sounds", () => {
  it.each([
    ["the beep", BEEP],
    ["the wrap sound", WRAP],
  ])(
    "%s can be fetched across origins, and knows when it is playing",
    (_n, sound) => {
      expect(sound.crossOrigin).toBe("anonymous");
      expect(sound.isPlaying).toBe(false);
      sound.onplaying?.(new Event("playing"));
      expect(sound.isPlaying).toBe(true);
      sound.onpause?.(new Event("pause"));
      expect(sound.isPlaying).toBe(false);
    }
  );
});
