import { act } from "@testing-library/react";
import wescheme from "@bootstrapworld/cmb-wescheme";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import {
  BIG_DOCUMENT,
  MAX_ACTIVITIES,
  MAX_UNPRINTED,
  getActivityBase,
  getLog,
  getLastError,
  getReducerActivities,
  resetActivityLog,
} from "../src/state/activityLog";
import * as actions from "../src/state/actions";
import { AST } from "../src/ast";
import { logResults } from "../src/utils";
import {
  BugReport,
  buildIssue,
  toReportActions,
  ReportAction,
} from "../src/ui/bugReport";
const { parseIssueBody } = require("../../../scripts/field-reports");

const report = (actions: ReportAction[], code = "(f x)"): BugReport => ({
  format: 2,
  version: "0.9.0",
  language: "wescheme",
  blockMode: true,
  userAgent: "test",
  code,
  actions,
  droppedActions: 0,
});

const bodyOf = (url: URL) => url.searchParams.get("body")!;

describe("the activity recorder", () => {
  beforeEach(() => resetActivityLog());

  it("keeps only the most recent activities, and the document before them", () => {
    const { cmb, store } = mountCMB(wescheme);
    cmb.setValue("(f x)\n(g y)");
    for (let i = 0; i < MAX_ACTIVITIES + 50; i++) {
      act(() => {
        store.dispatch(i % 2 ? actions.collapseAll() : actions.uncollapseAll());
      });
    }
    expect(getReducerActivities()).toHaveLength(MAX_ACTIVITIES);
    const { dropped, baseCode } = getActivityBase();
    expect(dropped).toBeGreaterThan(50);
    expect(baseCode).toBe("(f x)\n(g y)");
    teardown();
  });

  describe("in a big document", () => {
    const big = Array.from(
      { length: BIG_DOCUMENT / 3 + 50 },
      (_, i) => `(f ${i} y)`
    ).join("\n");

    it("does not print the document on every change, but can when asked", () => {
      const { cmb } = mountCMB(wescheme);
      cmb.setValue(big);
      const print = jest.spyOn(AST.prototype, "toString");
      const before = print.mock.calls.length;
      cmb.setValue(big + "\n(g z)");
      cmb.setValue(big + "\n(g w)");
      expect(print.mock.calls.length).toBe(before);
      const last = getLog()
        .filter((e) => e.type === "SET_AST")
        .pop() as { code: string };
      expect(last.code.endsWith("(g w)")).toBe(true);
      print.mockRestore();
      teardown();
    });

    it("keeps only the latest few, each starting from a whole document", () => {
      const { cmb } = mountCMB(wescheme);
      for (let i = 0; i < MAX_UNPRINTED + 8; i++) {
        cmb.setValue(big + `\n(g ${i})`);
      }
      const states = getLog().filter((e) => e.type === "SET_AST");
      expect(states.length).toBeLessThanOrEqual(MAX_UNPRINTED);
      expect(getLog()[0].type).toBe("SET_AST");
      expect(getActivityBase().dropped).toBeGreaterThan(0);
      expect((states[states.length - 1] as { code: string }).code).toMatch(
        new RegExp(`\\(g ${MAX_UNPRINTED + 7}\\)$`)
      );
      teardown();
    });
  });

  it("remembers the exception that was reported", () => {
    mountCMB(wescheme);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    act(() => {
      logResults(new Error("it broke"));
    });
    teardown();
    expect(getLastError()?.message).toBe("it broke");
    expect(getLastError()?.stack).toContain("it broke");
  });

  it("records collapsing with a node number that another session can use", () => {
    const { cmb, store } = mountCMB(wescheme);
    cmb.setValue("(f x)");
    const node = cmb.getAst().rootNodes[0];
    act(() => {
      store.dispatch(actions.collapseNode(node));
    });
    expect(toReportActions(getReducerActivities())).toContainEqual({
      type: "COLLAPSE",
      nid: node.nid,
    });
    teardown();
  });
});

describe("the bug report", () => {
  it("keeps what can be replayed and leaves out the rest", () => {
    const kept = toReportActions([
      { type: "SET_AST", code: "(f)" },
      { type: "SET_SELECTIONS", selections: ["abc"] },
      { type: "SET_FOCUS", nid: 2 },
      { type: "UNDO" },
    ]);
    expect(kept.map((a) => a.type)).toEqual(["SET_AST", "SET_FOCUS", "UNDO"]);
  });

  it("is read back, whole, by scripts/field-reports.js", () => {
    const r = report([
      { type: "SET_AST", code: 'a "quoted" (text)\n' },
      { type: "SET_FOCUS", nid: 1 },
    ]);
    r.error = { message: "boom", stack: "Error: boom\n at x" };
    const { url, trimmed } = buildIssue(r);
    expect(trimmed).toBe(false);
    expect(parseIssueBody(bodyOf(url)).report).toEqual(r);
  });

  it("drops the oldest actions to fit the link, and starts from the document before them", () => {
    const many: ReportAction[] = [];
    for (let i = 0; i < 100; i++) {
      many.push({ type: "SET_AST", code: `(f ${i} ${"x".repeat(60)})` });
    }
    const { url, sent, trimmed } = buildIssue(report(many), 3000);
    expect(trimmed).toBe(true);
    expect(url.toString().length).toBeLessThanOrEqual(3000);
    expect(sent.actions[sent.actions.length - 1]).toEqual(many[99]);
    expect(sent.droppedActions + sent.actions.length).toBe(100);
    const first = many[sent.droppedActions - 1] as { code: string };
    expect(sent.startCode).toBe(first.code);
    expect(bodyOf(url)).toContain("clipboard");
    expect(parseIssueBody(bodyOf(url)).report.droppedActions).toBe(
      sent.droppedActions
    );
  });

  it("trims events with the states, keeps the newest, and the report still parses", () => {
    const many: ReportAction[] = [];
    for (let i = 0; i < 80; i++) {
      many.push(
        { type: "KEY", key: "Enter", nid: i },
        { type: "EDIT", text: `(f ${i} ${"y".repeat(50)})`, how: "enter" },
        { type: "SET_AST", code: `(f ${i} ${"y".repeat(50)})` }
      );
    }
    const { url, sent, trimmed } = buildIssue(report(many), 3000);
    expect(trimmed).toBe(true);
    expect(url.toString().length).toBeLessThanOrEqual(3000);
    expect(sent.actions[sent.actions.length - 1]).toEqual(
      many[many.length - 1]
    );
    expect(sent.droppedActions + sent.actions.length).toBe(many.length);
    const parsed = parseIssueBody(bodyOf(url)).report;
    expect(parsed.actions).toEqual(sent.actions);
    expect(parsed.actions.some((a: ReportAction) => a.type === "EDIT")).toBe(
      true
    );
  });

  it("keeps events when turning activities into a report", () => {
    const list = [
      { type: "MOUSE", nid: 1 },
      { type: "CLIP", text: "(a b)" },
      { type: "SET_BLOCK_MODE", enabled: true, other: "dropped" },
    ] as unknown as Parameters<typeof toReportActions>[0];
    expect(toReportActions(list)).toEqual([
      { type: "MOUSE", nid: 1 },
      { type: "CLIP", text: "(a b)" },
      { type: "SET_BLOCK_MODE", enabled: true },
    ]);
  });

  it("falls back to the summary alone when the document itself is too big", () => {
    const { url, sent, trimmed } = buildIssue(
      report([], "(f x) ".repeat(5000)),
      3000
    );
    expect(trimmed).toBe(true);
    expect(sent.code).toBe("");
    expect(url.toString().length).toBeLessThanOrEqual(3000);
  });

  it("says what is being sent", () => {
    const body = bodyOf(buildIssue(report([])).url);
    expect(body).toMatch(/exactly what is sent/);
    // (typed text is sent, and the person is told so)
    expect(body).toMatch(/text you typed into a block, pasted, or searched/);
    expect(body).toMatch(/keys you pressed/);
  });
});
