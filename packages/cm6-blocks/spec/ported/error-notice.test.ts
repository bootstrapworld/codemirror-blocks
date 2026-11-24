/** @jest-environment jsdom */
// PORTED from packages/codemirror-blocks/spec/error-notice-test.ts; see doc/experiments/cm6-direct-tree.md, ninth round.
// edited: the notice shows when one of the editor's own actions (a key) meets an error, or an error nobody caught comes soon after the editor was used
// (forty-fourth round: the report form and the watcher; nothing is sent by the editor, the form shows the report to copy, and `onReport` is the way out).
import { make } from "../helpers";
import { allowConsoleErrors } from "../compat/global-setup";
import { parseReportText } from "../../src/error-report";

const press = (ed: ReturnType<typeof make>) =>
  ed.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
const notices = () => document.querySelectorAll('[role="alert"]');

describe("the notice that offers to report an error", () => {
  let ed: ReturnType<typeof make>;
  const fail = (m: string) =>
    jest.spyOn(ed.renderer, "nodeOf").mockImplementation(() => {
      throw new Error(m);
    });
  let logged: jest.SpyInstance;
  beforeEach(() => {
    logged = allowConsoleErrors();
    ed = make("scheme", "(f x)\n(g y)");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    notices().forEach((e) => e.remove());
  });
  const button = (label: string) =>
    [...notices()[0].querySelectorAll("button")].find(
      (b) => b.textContent === label
    ) as HTMLButtonElement | undefined;
  const uncaught = (e: unknown) =>
    window.dispatchEvent(
      new ErrorEvent("error", { error: e, message: String(e) })
    );
  const spoken = () =>
    ed.said.filter((t: string) => t.startsWith("Something went wrong"));

  it("appears, and is spoken, when an error is recorded", () => {
    expect(notices()).toHaveLength(0);
    fail("boom");
    press(ed);
    expect(notices()[0].textContent).toMatch(/Something went wrong: boom/);
    expect(spoken()).toHaveLength(1);
  });

  it("is not spoken again while it is still showing", () => {
    fail("one");
    press(ed);
    press(ed);
    expect(notices()).toHaveLength(1);
    expect(spoken()).toHaveLength(1);
  });

  it("can be dismissed without sending anything", () => {
    fail("boom");
    press(ed);
    button("Dismiss")!.click();
    expect(notices()).toHaveLength(0);
  });

  // edited: no button opens a page of a project; the form shows the report (the error, the program, the recorded actions) to copy, and goes away with Close
  it("opens a report with the error and the recorded actions, and goes away", () => {
    use();
    fail("boom");
    press(ed);
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    expect(notices()[0].querySelector("textarea")?.offsetParent).toBeFalsy();
    button("Report this problem")!.click();
    const form = notices()[0].querySelector(
      ".blocks-error-report"
    ) as HTMLElement;
    expect(form.hidden).toBe(false);
    const text = (form.querySelector("textarea") as HTMLTextAreaElement).value;
    expect(text).toContain("boom");
    const report = parseReportText(text)!;
    expect(report.error.message).toBe("boom");
    expect(report.source).toBe("action");
    expect(report.code).toBe(" (f x)\n(g y)");
    expect(report.activity.entries.some((e) => e.action === "text")).toBe(true);
    expect(report.activity.base).toBe("(f x)\n(g y)"); // (the text the log starts from)
    expect(report.activity.entries[0].change).toEqual([
      { from: 0, to: 0, insert: " " },
    ]);
    // nothing is sent, and no page is opened: with no `onReport` there is no Send button
    expect(open).not.toHaveBeenCalled();
    expect(button("Send")).toBeUndefined();
    button("Close")!.click();
    expect(notices()).toHaveLength(0);
  });

  it("sends the report to the page's own handler, when it has one, only when Send is pressed", () => {
    const sent: unknown[] = [];
    const seen: unknown[] = [];
    ed.destroy();
    ed = make("scheme", "(f x)\n(g y)", {
      onReport: (r) => sent.push(r),
      onError: (e) => seen.push(e),
    });
    fail("boom");
    press(ed);
    // (the page is told of the error at once; the report is sent when the person says)
    expect(seen).toHaveLength(1);
    expect(sent).toHaveLength(0);
    button("Report this problem")!.click();
    expect(sent).toHaveLength(0);
    button("Send")!.click();
    expect(sent).toHaveLength(1);
    expect((sent[0] as { error: { message: string } }).error.message).toBe(
      "boom"
    );
    expect(ed.said).toContain("Report sent");
    expect(notices()).toHaveLength(0);
  });

  it("keeps the form open, and says so, when the page's handler fails", () => {
    ed.destroy();
    ed = make("scheme", "(f x)", {
      onReport: () => {
        throw new Error("offline");
      },
    });
    fail("boom");
    press(ed);
    button("Report this problem")!.click();
    button("Send")!.click();
    expect(notices()[0].textContent).toMatch(/not sent: offline/);
  });

  it("writes the error to the console, as the old editor's log did, and does not swallow it", () => {
    fail("loud");
    press(ed);
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ message: "loud" })
    );
  });

  // (something done to the editor: a change of the text is recorded in the activity log)
  const use = (e = ed) =>
    e.view.dispatch({ changes: { from: 0, insert: " " } });
  describe("an error nobody caught", () => {
    it("counts one right after the editor was used", () => {
      use();
      uncaught(new Error("late"));
      expect(notices()[0].textContent).toMatch(/Something went wrong: late/);
      button("Report this problem")!.click();
      const report = parseReportText(
        (notices()[0].querySelector("textarea") as HTMLTextAreaElement).value
      )!;
      expect(report.source).toBe("uncaught");
    });

    it("counts an unhandled rejection too", () => {
      use();
      const e = new Event("unhandledrejection") as Event & { reason: unknown };
      e.reason = new Error("rejected");
      window.dispatchEvent(e);
      expect(notices()[0].textContent).toMatch(
        /Something went wrong: rejected/
      );
    });

    it("ignores one long after the editor was used", () => {
      use();
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now + 60_000);
      uncaught(new Error("not ours"));
      expect(notices()).toHaveLength(0);
    });

    it("ignores one when the editor was never used", () => {
      uncaught(new Error("not ours"));
      expect(notices()).toHaveLength(0);
    });

    it("does not swallow it: the event is not cancelled", () => {
      use();
      const e = new ErrorEvent("error", {
        error: new Error("x"),
        cancelable: true,
      });
      window.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    });

    it("is not watched once the editor is destroyed, or when the page turns the watcher off", () => {
      use();
      ed.destroy();
      uncaught(new Error("after"));
      expect(notices()).toHaveLength(0);
      const off = make("scheme", "(f x)\n(g y)", {
        watchUncaughtErrors: false,
      });
      off.view.dispatch({ changes: { from: 0, insert: " " } });
      uncaught(new Error("unwatched"));
      expect(notices()).toHaveLength(0);
    });
  });
});
