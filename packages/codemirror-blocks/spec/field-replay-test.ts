import * as fs from "fs";
import wescheme from "../src/languages/wescheme";
import * as copypaste from "../src/copypaste";
import {
  cmd_ctrl,
  keyDown,
  mountCMB,
  mouseDown,
  teardown,
} from "../src/toolkit/test-utils";
import {
  getActivityBase,
  getLog,
  resetActivityLog,
} from "../src/state/activityLog";
import {
  BugReport,
  ReportAction,
  buildIssue,
  toReportActions,
} from "../src/ui/bugReport";
import { installFakeClipboard } from "./helpers/clipboard";
import { setEditableText } from "./helpers/editing";
import { dragOnto, dropTargets, toolbarPrimitive } from "./helpers/gestures";
import { isEvent, replay, replayReport, shrink } from "./helpers/fieldReplay";
const { parseIssueBody } = require("../../../scripts/field-reports");

/**
 * Replays a bug report sent from the editor (src/ui/bugReport.ts), in jsdom.
 *
 *   CMB_FIELD_REPLAY=soak-results/field/issue-123.json npx jest field-replay
 *
 * (scripts/field-reports.js saves those files and prints the command.)
 * A failing report is shrunk, like a randomized sequence. How it is replayed
 * (the person's keys, clicks and drags again, or only the states they left the
 * editor in) is described in helpers/fieldReplay.ts, and the run says which.
 */

const sample: BugReport = {
  format: 1,
  version: "0.9.0",
  language: "wescheme",
  blockMode: true,
  userAgent: "test",
  code: "(f x)",
  actions: [
    { type: "SET_AST", code: "(f x)\n(g y)" },
    { type: "SET_FOCUS", nid: 0 },
    { type: "COLLAPSE", nid: 0 },
    { type: "UNCOLLAPSE", nid: 0 },
    { type: "SET_AST", code: "(f x)" },
    { type: "UNDO" },
    { type: "REDO" },
  ],
  droppedActions: 0,
};

describe("replaying a field report (states)", () => {
  it("runs a healthy report to the end", () => {
    const info = replayReport(sample, sample.actions);
    expect(info.result).toBeUndefined();
    expect(info.mode).toBe("state");
  });

  it("says which action broke the editor, and shrinks to it", () => {
    const list: ReportAction[] = [
      ...sample.actions,
      { type: "SET_AST", code: "(unclosed" },
    ];
    const failure = replay(sample, list);
    expect(failure?.failedAt).toBe(list.length - 1);
    const small = shrink(sample, list, failure!);
    expect(small).toEqual([{ type: "SET_AST", code: "(unclosed" }]);
  });

  it("reports a language it does not know", () => {
    expect(replay({ language: "cobol" }, [])?.problem).toMatch(/unknown/);
  });
});

/** A person at the editor, recorded for real, then sent as a report */
function record(
  doing: (
    env: ReturnType<typeof mountCMB>,
    el: (i: number) => HTMLElement
  ) => void
): BugReport {
  resetActivityLog();
  const env = mountCMB(wescheme);
  installFakeClipboard("");
  jest.spyOn(console, "error").mockImplementation(() => {});
  env.cmb.setValue("(f x)\n(g y)");
  doing(env, (i) => {
    const node = env.cmb.getAst().rootNodes[i];
    return document.getElementById(`block-node-${node.id}`)!;
  });
  const { dropped, baseCode } = getActivityBase();
  const report: BugReport = {
    format: 2,
    version: "0.9.0",
    language: "wescheme",
    blockMode: true,
    userAgent: "test",
    code: env.cmb.getValue(),
    startCode: baseCode,
    actions: toReportActions(getLog()),
    droppedActions: dropped,
  };
  jest.restoreAllMocks();
  teardown();
  // through the issue and back, as it travels
  const { url } = buildIssue(report);
  return parseIssueBody(url.searchParams.get("body")).report;
}

describe("replaying a field report (events)", () => {
  afterEach(() => jest.restoreAllMocks());

  /**
   * A bug that no state shows: Copy, which changes nothing in the editor but
   * the clipboard, fails. (It is seeded here by making `copy` log an error.)
   */
  const seedBug = () =>
    jest.spyOn(copypaste, "copy").mockImplementation(() => {
      console.error("copy exploded");
    });

  const sessionWithCopy = () =>
    record(({ cmb }, el) => {
      mouseDown(el(0));
      keyDown("ArrowDown", {}, el(0));
      mouseDown(el(1));
      keyDown(" ", {}, el(1));
      keyDown("C", cmd_ctrl, el(1)); // <- the seeded bug is here
      keyDown("ArrowUp", {}, el(1));
      cmb.getValue();
    });

  it("a recorded session replays, and a seeded bug is seen again", () => {
    const report = sessionWithCopy();
    expect(report.format).toBe(2);
    expect(report.actions.filter(isEvent).length).toBeGreaterThanOrEqual(5);

    // without the bug, the session is healthy
    expect(replayReport(report, report.actions)).toMatchObject({
      mode: "events",
      result: undefined,
    });

    // with it, the replay fails at the Copy key, as the person's session did
    seedBug();
    const info = replayReport(report, report.actions);
    expect(info.mode).toBe("events");
    expect(info.result?.problem).toMatch(/copy exploded/);
    const failed = report.actions[info.result!.failedAt];
    expect(failed).toMatchObject({ type: "KEY", key: "C" });

    // the states alone do not show it: that is what events are for
    const statesOnly = report.actions.filter((a) => !isEvent(a));
    expect(replayReport(report, statesOnly).result).toBeUndefined();

    // and it shrinks to the keys that matter
    const small = shrink(report, report.actions, info.result!);
    expect(small.length).toBeLessThan(report.actions.length);
    expect(small[small.length - 1]).toMatchObject({ type: "KEY", key: "C" });
  });

  it("re-drives edits, drags, and top-level typing", () => {
    const report = record(({ cmb }, el) => {
      mouseDown(el(0));
      keyDown("Enter", cmd_ctrl, el(0));
      setEditableText("(f y)");
      keyDown("Enter", {}, document.activeElement!);
      dragOnto(
        toolbarPrimitive("sqrt"),
        dropTargets(cmb.getWrapperElement())[1]
      );
      dragOnto(el(1), document.querySelector(".TrashCan")!);
    });
    // the replay ends with the same document the session did
    const info = replayReport(report, report.actions);
    expect(info).toMatchObject({
      mode: "events",
      result: undefined,
      notes: [],
    });
    const types = report.actions.filter(isEvent).map((a) => a.type);
    expect(types).toEqual(
      expect.arrayContaining(["MOUSE", "KEY", "EDIT", "DRAG"])
    );
  });

  it("falls back to the states, and says so, when an event cannot be driven", () => {
    const report = sessionWithCopy();
    const withSearch: ReportAction[] = [
      ...report.actions,
      { type: "SEARCH", key: "Enter" },
    ];
    const info = replayReport(report, withSearch);
    expect(info.mode).toBe("state");
    expect(info.notes.join("\n")).toMatch(/search dialog cannot be driven/);
    expect(info.notes.join("\n")).toMatch(/falling back/);
  });

  it("skips an event whose block is not there, and falls back", () => {
    const report = sessionWithCopy();
    const info = replayReport(report, [
      ...report.actions,
      { type: "MOUSE", nid: 999 },
    ]);
    expect(info.mode).toBe("state");
    expect(info.notes[0]).toMatch(/block 999 is not on the page/);
  });
});

const file = process.env.CMB_FIELD_REPLAY;
if (file) {
  describe(`the field report ${file}`, () => {
    it("replays", () => {
      const report = JSON.parse(fs.readFileSync(file, "utf8")) as BugReport;
      const info = replayReport(report, report.actions);
      // eslint-disable-next-line no-console
      console.log(
        `replayed by ${info.mode === "events" ? "driving the events again" : "putting the editor in each recorded state"}` +
          (info.notes.length ? `:\n  ${info.notes.join("\n  ")}` : "")
      );
      if (info.result) {
        const small = shrink(report, report.actions, info.result);
        throw new Error(
          `The field report broke the editor at action ${info.result.failedAt}: ${info.result.problem}\nShrunk to ${small.length} actions:\n${JSON.stringify(small)}`
        );
      }
    });
  });
}
