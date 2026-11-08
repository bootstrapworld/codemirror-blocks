import { act, fireEvent } from "@testing-library/react";
import lambda from "@bootstrapworld/lambda";
import wescheme from "@bootstrapworld/wescheme";
import { keyDown, mac, mountCMB, teardown } from "../../src/toolkit/test-utils";
import * as actions from "../../src/state/actions";
import * as selectors from "../../src/state/selectors";
import type { UIEvent } from "../../src/state/activityLog";
import type { BugReport, ReportAction } from "../../src/ui/bugReport";
import { installFakeClipboard } from "./clipboard";
import { drag, pressFocus } from "./dnd";
import { setEditableText } from "./editing";
import {
  dragOnto,
  dropOnWhitespace,
  dropTargets,
  pasteAtCursor,
  typeChar,
} from "./gestures";
import { findInvariantViolations } from "./invariants";
import { minimise } from "./random";

/**
 * Replays a bug report sent from the editor (src/ui/bugReport.ts), in jsdom.
 *
 * A report holds two kinds of entries, in the order they happened: what the
 * person did (keys, clicks, drags, text typed or pasted: `UIEvent`s) and the
 * states the editor was put in (SET_AST, SET_FOCUS, ...).
 *
 * - **Event replay** (reports of format 2): starts from the recorded start
 *   document and drives the events again through the same helpers the random
 *   sequences use (`gestures.ts`, `dnd.ts`, `editing.ts`), checking the
 *   invariants after each. The state entries are not applied (they are what
 *   the events caused), except the ones before the first event, which are how
 *   the editor was set up.
 * - **State replay** (format 1 reports, or when events are missing or cannot
 *   be driven): puts the editor into each recorded state, one after another.
 *   The keys, clicks and drags that caused them are not re-driven, so a bug
 *   that needs the exact event sequence will only show in the report's error.
 *
 * `ReplayInfo.mode` and `notes` say which was used and why.
 */

const languages: Record<string, typeof wescheme> = { wescheme, lambda };

export type ReplayResult = { failedAt: number; problem: string } | undefined;
export type ReplayInfo = {
  result: ReplayResult;
  mode: "events" | "state";
  /** why the mode was chosen, and which events could not be driven */
  notes: string[];
};

const EVENTS = new Set<string>([
  "KEY",
  "MOUSE",
  "DRAG",
  "EDIT",
  "EDIT_CANCEL",
  "TYPE",
  "PASTE",
  "CLIP",
  "MODE",
  "SEARCH",
]);
export const isEvent = (a: ReportAction): a is UIEvent => EVENTS.has(a.type);

type Env = ReturnType<typeof mountCMB> & {
  language: typeof wescheme;
  clipboard: ReturnType<typeof installFakeClipboard>;
};

/** Raised when the world is not the one the event was recorded in */
class CannotDrive extends Error {}

type Step =
  { index: number; event: UIEvent } | { index: number; settext: string };

/**
 * Run the entries in a fresh editor; say which one broke it, and how.
 * (Kept for callers that want only the verdict; see `replayReport`.)
 */
export const replay = (
  report: Pick<BugReport, "language" | "startCode"> &
    Partial<Pick<BugReport, "userAgent" | "code">>,
  list: readonly ReportAction[]
): ReplayResult => replayReport(report, list).result;

export function replayReport(
  report: Pick<BugReport, "language" | "startCode"> &
    Partial<Pick<BugReport, "userAgent" | "code">>,
  list: readonly ReportAction[]
): ReplayInfo {
  if (!languages[report.language]) {
    return {
      result: { failedAt: -1, problem: `unknown language ${report.language}` },
      mode: "state",
      notes: [],
    };
  }
  if (!list.some(isEvent)) {
    return {
      result: runStates(report, list),
      mode: "state",
      notes: ["no events were recorded: replaying the states"],
    };
  }
  const notes: string[] = [];
  const result = runEvents(report, list, notes);
  if (result || !notes.length) return { result, mode: "events", notes };
  // nothing broke, but some events could not be driven, so the run may not
  // have been the person's: the states are the other thing we have
  notes.push("falling back to replaying the states");
  return { result: runStates(report, list), mode: "state", notes };
}

/** Everything a replay needs around it: an editor, a clipboard, silence from console.error */
function withEditor<T>(
  report: Pick<BugReport, "language" | "startCode">,
  body: (env: Env, errors: jest.SpyInstance) => T
): T {
  const language = languages[report.language];
  const mounted = mountCMB(language);
  const clipboard = installFakeClipboard();
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  // (jsdom has no scrollIntoView, which the editor calls to keep a block in view)
  const proto = Element.prototype as { scrollIntoView?: () => void };
  proto.scrollIntoView ??= () => {};
  try {
    if (report.startCode) mounted.cmb.setValue(report.startCode);
    mounted.cmb.clearHistory();
    return body({ ...mounted, language, clipboard }, errors);
  } finally {
    errors.mockRestore();
    clipboard.restore();
    teardown();
  }
}

/** The verdict after one entry: what is wrong now, if anything */
const check = (errors: jest.SpyInstance): string | undefined => {
  if (errors.mock.calls.length) {
    return `console.error: ${errors.mock.calls[0].map(String).join(" ")}`;
  }
  const violations = findInvariantViolations();
  return violations.length ? violations.join("\n") : undefined;
};

function runStates(
  report: Pick<BugReport, "language" | "startCode">,
  list: readonly ReportAction[]
): ReplayResult {
  return withEditor(report, (env, errors) => {
    for (const [i, a] of list.entries()) {
      if (isEvent(a)) continue;
      try {
        applyState(env, a);
      } catch (e) {
        return { failedAt: i, problem: `threw ${String(e)}` };
      }
      const problem = check(errors);
      if (problem) return { failedAt: i, problem };
    }
    return undefined;
  });
}

function runEvents(
  report: Pick<BugReport, "language" | "startCode"> &
    Partial<Pick<BugReport, "userAgent">>,
  list: readonly ReportAction[],
  notes: string[]
): ReplayResult {
  const firstEvent = list.findIndex(isEvent);
  const steps = plan(list, firstEvent);
  return withEditor(report, (env, errors) => {
    // how the editor was set up (before the person did anything)
    for (const [i, a] of list.slice(0, firstEvent).entries()) {
      try {
        applyState(env, a as Exclude<ReportAction, UIEvent>);
      } catch (e) {
        return { failedAt: i, problem: `threw ${String(e)}` };
      }
    }
    const reportMac = /Mac/.test(report.userAgent ?? "");
    for (const step of steps) {
      try {
        if ("settext" in step) setEditableText(escapeHtml(step.settext));
        else drive(env, step.event, reportMac);
      } catch (e) {
        if (e instanceof CannotDrive) {
          notes.push(`event ${step.index} (${e.message}) was skipped`);
          continue;
        }
        return { failedAt: step.index, problem: `threw ${String(e)}` };
      }
      const problem = check(errors);
      if (problem) return { failedAt: step.index, problem };
    }
    return undefined;
  });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The order to drive the events in. Two kinds of entry are recorded *after*
 * the event that caused them but have to happen *before* it: the clipboard text
 * read once a paste key has been pressed, and the text of an edit box that
 * was saved because the person clicked (or pressed a key) elsewhere.
 */
function plan(list: readonly ReportAction[], from: number): Step[] {
  const steps: Step[] = [];
  const driving = (s: Step) =>
    "settext" in s || (s.event.type !== "CLIP" && s.event.type !== "EDIT");
  for (let index = from; index < list.length; index++) {
    const a = list[index];
    if (!isEvent(a)) continue;
    let step: Step = { index, event: a };
    if (a.type === "EDIT" && a.how === "blur") {
      step = { index, settext: a.text };
    }
    const moves =
      "settext" in step || (step.event.type === "CLIP" && steps.length > 0);
    if (moves) {
      // before the closest earlier entry that is a doing
      let at = steps.length;
      while (at > 0 && !driving(steps[at - 1])) at--;
      if (at > 0) at--;
      steps.splice(at, 0, step);
    } else {
      steps.push(step);
    }
  }
  return steps;
}

const blockEl = (env: Env, nid: number) => {
  const node = selectors.getAST(env.store.getState()).nodeNIdMap.get(nid);
  const el = node && document.getElementById(`block-node-${node.id}`);
  if (!el) throw new CannotDrive(`block ${nid} is not on the page`);
  return el;
};

const dragSource = (
  env: Env,
  from: Extract<UIEvent, { type: "DRAG" }>["from"]
) => {
  if ("nid" in from) return blockEl(env, from.nid);
  const entry = [...document.querySelectorAll(".Primitive")].find(
    (el) => el.textContent === from.tool
  );
  if (!entry) throw new CannotDrive(`toolbar entry ${from.tool} is not there`);
  return entry;
};

/** Do what the person did */
function drive(env: Env, ev: UIEvent, reportMac: boolean) {
  const { cmb } = env;
  switch (ev.type) {
    case "KEY": {
      let mods = ev.mods ?? "";
      // (the shortcut's modifier is Cmd on a Mac and Ctrl elsewhere)
      if (reportMac !== mac && /^([A-Z]|Enter)$/.test(ev.key)) {
        mods = mods.replace(/[CM]/g, (m) => (m === "C" ? "M" : "C"));
      }
      const props = {
        ctrlKey: mods.includes("C"),
        metaKey: mods.includes("M"),
        shiftKey: mods.includes("S"),
        altKey: mods.includes("A"),
      };
      const target =
        ev.nid === null
          ? (document.activeElement ?? cmb.getCM().getInputField())
          : blockEl(env, ev.nid);
      return keyDown(ev.key, props, target);
    }
    case "MOUSE": {
      const el = blockEl(env, ev.nid);
      if (fireEvent.mouseDown(el)) pressFocus(el);
      return;
    }
    case "DRAG": {
      const src = dragSource(env, ev.from);
      const mode = ev.touch ? "touch" : "mouse";
      const to = ev.to;
      if (!to) return drag(src, mode).cancel();
      if ("nid" in to)
        return dragOnto(src, blockEl(env, to.nid), undefined, mode);
      if ("trash" in to) {
        const trash = document.querySelector(".TrashCan");
        if (!trash) throw new CannotDrive("no trash can");
        return dragOnto(src, trash, undefined, mode);
      }
      if ("gap" in to) {
        const gap = dropTargets(cmb.getWrapperElement())[to.gap];
        if (!gap) throw new CannotDrive(`gap ${to.gap} is not there`);
        return dragOnto(src, gap, undefined, mode);
      }
      return dropOnWhitespace(cmb, src, to.ws, mode);
    }
    case "EDIT": {
      // (jsdom does not compute isContentEditable: look at the attribute)
      if (document.activeElement?.getAttribute("contenteditable") !== "true") {
        throw new CannotDrive("no edit box is open");
      }
      setEditableText(escapeHtml(ev.text));
      return keyDown("Enter", {}, document.activeElement!);
    }
    case "EDIT_CANCEL": {
      const box = document.activeElement;
      if (box?.getAttribute("contenteditable") !== "true") {
        throw new CannotDrive("no edit box is open");
      }
      return keyDown("Escape", {}, box);
    }
    case "TYPE":
    case "PASTE": {
      act(() => {
        cmb.getCM().focus();
        cmb.getCM().setSelection(ev.sel.from, ev.sel.to);
      });
      return ev.type === "TYPE"
        ? typeChar(cmb, ev.char)
        : pasteAtCursor(cmb, ev.text);
    }
    case "CLIP":
      env.clipboard.text = ev.text;
      return;
    case "MODE":
      return act(() => {
        env.store.dispatch(
          actions.setBlockMode(ev.blocks, cmb.getValue(), env.language)
        );
      });
    case "SEARCH":
      throw new CannotDrive("the search dialog cannot be driven");
  }
}

function applyState(env: Env, a: Exclude<ReportAction, UIEvent>) {
  const { cmb, store, language } = env;
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
  report: Pick<BugReport, "language" | "startCode"> &
    Partial<Pick<BugReport, "userAgent">>,
  list: readonly ReportAction[],
  first: NonNullable<ReplayResult>
) {
  const kind = (r: ReplayResult) => r?.problem.split("\n")[0].slice(0, 40);
  return minimise(list.slice(0, first.failedAt + 1), (candidate) => {
    const again = replay(report, candidate);
    return !!again && kind(again) === kind(first);
  });
}
