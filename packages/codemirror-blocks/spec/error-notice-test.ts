import { act, screen, fireEvent } from "@testing-library/react";
import wescheme from "@bootstrapworld/wescheme";
import { mountCMB, teardown } from "../src/toolkit/test-utils";
import * as announcer from "../src/announcer";
import { resetActivityLog } from "../src/state/activityLog";
import { logResults } from "../src/utils";

const REPORT = /Report this problem/;

describe("the notice that offers to report an error", () => {
  let say: jest.SpyInstance;
  let open: jest.SpyInstance;
  beforeEach(async () => {
    say = jest.spyOn(announcer, "say");
    open = jest.spyOn(window, "open").mockImplementation(() => null);
    resetActivityLog();
    mountCMB(wescheme).cmb.setValue("(f x)\n(g y)");
    await new Promise((r) => setTimeout(r, 0));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    teardown();
  });
  const said = () => say.mock.calls.map((c) => String(c[0]));

  it("appears, and is spoken, when an error is recorded", () => {
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => {
      logResults(new Error("boom"));
    });
    expect(screen.getByRole("alert").textContent).toMatch(
      /Something went wrong/
    );
    expect(
      said().filter((t) => t.startsWith("Something went wrong"))
    ).toHaveLength(1);
  });

  it("is not spoken again while it is still showing", () => {
    act(() => {
      logResults(new Error("one"));
      logResults(new Error("two"));
    });
    expect(
      said().filter((t) => t.startsWith("Something went wrong"))
    ).toHaveLength(1);
  });

  it("opens a report with the error and the recorded actions, and goes away", () => {
    act(() => {
      logResults(new Error("boom"));
    });
    fireEvent.click(screen.getByRole("button", { name: REPORT }));
    expect(open).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(String(open.mock.calls[0][0]));
    expect(url).toContain("boom");
    expect(url).toMatch(/\(f.x\)/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can be dismissed without sending anything", () => {
    act(() => {
      logResults(new Error("boom"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("counts an uncaught error right after the editor was used", () => {
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", { error: new Error("late") })
      );
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("ignores an uncaught error long after the editor was used", () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 60_000);
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", { error: new Error("not ours") })
      );
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
