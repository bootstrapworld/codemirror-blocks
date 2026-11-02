import type { LogEntry, UIEvent } from "../state/activityLog";

/**
 * The machine-readable part of a bug report. It travels in the body of the
 * GitHub issue, in a fenced block tagged `cmb-report`, and scripts/field-reports.js
 * turns it back into a failure that can be replayed (spec/field-replay-test.ts).
 * It holds the document, what was done to it, and what the person did (keys,
 * clicks, drags, and the text they typed or pasted): nothing else about them.
 *
 * Format 2 added the person's own events (`UIEvent`), which a replay can drive
 * again; format 1 had only the resulting states.
 */
export type ReportAction = StateAction | UIEvent;
export type StateAction =
  | { type: "SET_AST"; code: string }
  | { type: "SET_FOCUS"; nid: number | null }
  | { type: "SET_BLOCK_MODE"; enabled: boolean }
  | { type: "COLLAPSE" | "UNCOLLAPSE"; nid: number }
  | { type: "COLLAPSE_ALL" | "UNCOLLAPSE_ALL" | "UNDO" | "REDO" };

export type BugReport = {
  /** 2 added the person's events; 1 (states only) is still read */
  format: 1 | 2;
  /** package version of the editor */
  version: string;
  language: string;
  blockMode: boolean;
  userAgent: string;
  /** the document when the report was made */
  code: string;
  /** the document just before the first action in `actions` (when older ones were dropped) */
  startCode?: string;
  /** the most recent things that happened to the editor and that people did to it, oldest first */
  actions: ReportAction[];
  /** how many older actions are not included */
  droppedActions: number;
  error?: { message: string; stack?: string };
};

export const REPORT_FENCE = "cmb-report";

/** GitHub refuses very long URLs; this leaves room for the rest of the URL */
export const MAX_URL_LENGTH = 7500;

/** Keep what a replay can use, in a compact form; drop marks, ids and the like. */
export function toReportActions(
  activities: readonly LogEntry[]
): ReportAction[] {
  const out: ReportAction[] = [];
  for (const a of activities) {
    switch (a.type) {
      case "SET_AST":
        out.push({ type: a.type, code: a.code });
        break;
      case "SET_FOCUS":
        out.push({ type: a.type, nid: a.nid });
        break;
      case "SET_BLOCK_MODE":
        out.push({ type: a.type, enabled: a.enabled });
        break;
      case "COLLAPSE":
      case "UNCOLLAPSE": {
        const nid = (a as { nid?: number }).nid;
        if (nid !== undefined) out.push({ type: a.type, nid });
        break;
      }
      case "COLLAPSE_ALL":
      case "UNCOLLAPSE_ALL":
      case "UNDO":
      case "REDO":
        out.push({ type: a.type });
        break;
      case "KEY":
      case "MOUSE":
      case "DRAG":
      case "EDIT":
      case "EDIT_CANCEL":
      case "TYPE":
      case "PASTE":
      case "CLIP":
      case "MODE":
      case "SEARCH":
        out.push(a);
        break;
    }
  }
  return out;
}

export const fence = (report: BugReport) =>
  "```json " + REPORT_FENCE + "\n" + JSON.stringify(report) + "\n```";

const bodyFor = (report: BugReport, trimmed: boolean) =>
  `**Describe the bug**
What happened, and what did you expect to happen?

**Steps**
Anything that is not in the log below: what you clicked or typed just before.

<details>
<summary>Debug information (sent with this report)</summary>

This is exactly what is sent: the program text, the recent actions in the
editor, any error, the editor version and your browser. The actions include
the keys you pressed in the editor, which blocks you clicked or dragged, and
the text you typed into a block, pasted, or searched for, so that we can repeat
what you did. Look through the block below before you submit; delete anything
you would rather not share. Nothing else is sent.
${trimmed ? "\nThe full log was too long for this link, so the oldest actions were left out. It was copied to your clipboard: if you can, paste it over the block below.\n" : ""}
${fence(report)}

</details>
`;

/**
 * The URL that opens a new issue with the report in it, trimming the oldest
 * actions until it fits. `trimmed` says that some did not (copy `report`, the
 * full one, to the clipboard for the person to paste in).
 */
export function buildIssue(report: BugReport, maxLength = MAX_URL_LENGTH) {
  const make = (r: BugReport, trimmed: boolean) => {
    const url = new URL(
      "https://github.com/bootstrapworld/codemirror-blocks/issues/new"
    );
    url.searchParams.set("labels", "bug, User Submitted, bug-report");
    url.searchParams.set("template", "bug_report.md");
    url.searchParams.set("title", "[BUG]");
    url.searchParams.set("body", bodyFor(r, trimmed));
    return url;
  };
  let sent = report;
  let url = make(sent, false);
  let trimmed = false;
  while (url.toString().length > maxLength && sent.actions.length > 0) {
    // drop the oldest quarter at a time (at least one)
    const n = Math.max(1, Math.floor(sent.actions.length / 4));
    const dropped = sent.actions.slice(0, n);
    const lastCode = [...dropped]
      .reverse()
      .find((a): a is Extract<ReportAction, { type: "SET_AST" }> => {
        return a.type === "SET_AST";
      })?.code;
    sent = {
      ...sent,
      actions: sent.actions.slice(n),
      droppedActions: sent.droppedActions + n,
      startCode: lastCode ?? sent.startCode,
    };
    trimmed = true;
    url = make(sent, true);
  }
  if (url.toString().length > maxLength) {
    // even the document alone is too big: send the summary, and rely on the clipboard
    sent = { ...sent, code: "", startCode: undefined, actions: [] };
    trimmed = true;
    url = make(sent, true);
  }
  return { url, sent, trimmed };
}
