import * as fs from "fs";
import { act } from "@testing-library/react";
import lambda from "../src/languages/lambda";
import wescheme from "../src/languages/wescheme";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import * as actions from "../src/state/actions";
import * as selectors from "../src/state/selectors";
import type { BugReport, ReportAction } from "../src/ui/bugReport";
import { findInvariantViolations } from "./helpers/invariants";
import { minimise } from "./helpers/random";

/**
 * Replays a bug report sent from the editor (src/ui/bugReport.ts), in jsdom.
 *
 *   CMB_FIELD_REPLAY=soak-results/field/issue-123.json npx jest field-replay
 *
 * (scripts/field-reports.js saves those files and prints the command.)
 * A failing report is shrunk, like a randomized sequence.
 *
 * What can be replayed: the document after each edit (typed, dropped, pasted,
 * cut... all arrive as the new text), focus moving to a block, mode switches,
 * collapsing and expanding, undo and redo. What cannot: the keys, clicks and
 * drags that *caused* those; the editor is put in the state they left it in,
 * not driven through them. A bug that needs the exact event sequence (a
 * handler that throws on a particular key) will not show up here; the report's
 * own `error` is the record of it.
 */

const languages: Record<string, typeof wescheme> = { wescheme, lambda };

export type ReplayResult = { failedAt: number; problem: string } | undefined;

/** Run the actions in a fresh editor; say which one broke it, and how. */
export function replay(
  report: Pick<BugReport, "language" | "startCode">,
  list: readonly ReportAction[]
): ReplayResult {
  const language = languages[report.language];
  if (!language) {
    return { failedAt: -1, problem: `unknown language ${report.language}` };
  }
  const { cmb, store } = mountCMB(language);
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  // (jsdom has no scrollIntoView, which the editor calls to keep a block in view)
  const proto = Element.prototype as { scrollIntoView?: () => void };
  proto.scrollIntoView ??= () => {};
  try {
    if (report.startCode) cmb.setValue(report.startCode);
    cmb.clearHistory();
    for (const [i, a] of list.entries()) {
      try {
        apply(cmb, store, a, language);
      } catch (e) {
        return { failedAt: i, problem: `threw ${String(e)}` };
      }
      if (errors.mock.calls.length) {
        return {
          failedAt: i,
          problem: `console.error: ${errors.mock.calls[0].map(String).join(" ")}`,
        };
      }
      const violations = findInvariantViolations();
      if (violations.length) {
        return { failedAt: i, problem: violations.join("\n") };
      }
    }
    return undefined;
  } finally {
    errors.mockRestore();
    teardown();
  }
}

function apply(
  cmb: ReturnType<typeof mountCMB>["cmb"],
  store: ReturnType<typeof mountCMB>["store"],
  a: ReportAction,
  language: typeof wescheme
) {
  const node = (nid: number) =>
    selectors.getAST(store.getState()).nodeNIdMap.get(nid);
  switch (a.type) {
    case "SET_AST":
      return cmb.executeAction({ type: "SET_AST", code: a.code });
    case "SET_FOCUS":
      return cmb.executeAction({ type: "SET_FOCUS", nid: a.nid });
    case "SET_BLOCK_MODE":
      return act(() => {
        store.dispatch(
          actions.setBlockMode(a.enabled, cmb.getValue(), language)
        );
      });
    case "COLLAPSE":
    case "UNCOLLAPSE": {
      const n = node(a.nid);
      if (!n) return; // (the node is not there in this replay: nothing to do)
      const make =
        a.type === "COLLAPSE" ? actions.collapseNode : actions.uncollapseNode;
      return act(() => {
        store.dispatch(make(n));
      });
    }
    case "COLLAPSE_ALL":
      return act(() => {
        store.dispatch(actions.collapseAll());
      });
    case "UNCOLLAPSE_ALL":
      return act(() => {
        store.dispatch(actions.uncollapseAll());
      });
    case "UNDO":
      return cmb.undo();
    case "REDO":
      return cmb.redo();
  }
}

/** Shrink to a shorter list that still fails the same way (by its first line). */
export function shrink(
  report: Pick<BugReport, "language" | "startCode">,
  list: readonly ReportAction[],
  first: NonNullable<ReplayResult>
) {
  const kind = (r: ReplayResult) => r?.problem.split("\n")[0].slice(0, 40);
  return minimise(list.slice(0, first.failedAt + 1), (candidate) => {
    const again = replay(report, candidate);
    return !!again && kind(again) === kind(first);
  });
}

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

describe("replaying a field report", () => {
  it("runs a healthy report to the end", () => {
    expect(replay(sample, sample.actions)).toBeUndefined();
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

  const file = process.env.CMB_FIELD_REPLAY;
  if (file) {
    it(`replays ${file}`, () => {
      const report = JSON.parse(fs.readFileSync(file, "utf8")) as BugReport;
      const failure = replay(report, report.actions);
      if (failure) {
        const small = shrink(report, report.actions, failure);
        throw new Error(
          `The field report broke the editor at action ${failure.failedAt}: ${failure.problem}\nShrunk to ${small.length} actions:\n${JSON.stringify(small)}`
        );
      }
    });
  }
});
