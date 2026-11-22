/** @jest-environment jsdom */
// PORTED from packages/codemirror-blocks/spec/error-notice-test.ts; see doc/experiments/cm6-direct-tree.md, ninth round.
// edited: this editor shows the notice when one of its own actions (a key) meets an error; it has no report form, no activity log and no handler
// for errors nobody caught, so the tests that open a report, and those about uncaught window errors, stay skipped.
import { make } from "../helpers";

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
  beforeEach(() => {
    ed = make("scheme", "(f x)\n(g y)");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    notices().forEach((e) => e.remove());
  });
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
    (notices()[0].querySelector("button") as HTMLElement).click();
    expect(notices()).toHaveLength(0);
  });

  // SKIPPED (I): there is no report form here (the notice says what went wrong, with a Dismiss button); sending a report needs somewhere to send it, a decision for later
  it.skip("opens a report with the error and the recorded actions, and goes away", () =>
    undefined);

  // SKIPPED (I): errors nobody caught (window "error" events) are not watched here, and there is no activity log to count "right after the editor was used" against; about 40 more lines and a decision on what an uncaught error is
  it.skip("counts an uncaught error right after the editor was used", () =>
    undefined);

  // SKIPPED (I): as above
  it.skip("ignores an uncaught error long after the editor was used", () =>
    undefined);
});
