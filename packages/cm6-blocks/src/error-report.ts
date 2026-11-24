/**
 * The error notice's report, and the watcher of uncaught errors (forty-fourth round). The old editor (`ui/ErrorNotice.tsx`, `ui/bugReport.ts`) listened for
 * `error` and `unhandledrejection` on the window, counted one only if a person had used the editor in the last 2 seconds, showed "Something went wrong"
 * with a "Report this problem" button, and that button opened a new GitHub issue (a URL of the project, the report in its body) in a new tab.
 *
 * Here NOTHING is sent by the editor. The report is a value (`ErrorReport`) and a text (`reportText`) that the form shows for the person to copy;
 * a page that has somewhere to send it passes `onReport(report)` (the form then also has a "Send" button that calls it), and `onError(error, report)`
 * (called as soon as the notice is raised, without the person's say: it is how a page logs; the old editor's `setLogReporter`).
 */
import type { ActivityExport } from "./activity";

/** what a report holds: the document, what was done to it (the activity log; see activity.ts for what a keystroke does and does not record), the error */
export interface ErrorReport {
  format: 1;
  /** the grammar's name (the table's `lang`), or "" */
  language: string;
  mode: "blocks" | "text";
  userAgent: string;
  /** the document when the report was made */
  code: string;
  /** the log of what was done (the same as `ed.exportActivity()`) */
  activity: ActivityExport;
  error: { message: string; stack?: string };
  /** how the error came to the editor: an action of the editor caught it ("action"), or nobody did ("uncaught" / "unhandledrejection") */
  source: "action" | "uncaught" | "unhandledrejection";
}

export const REPORT_FENCE = "cmb-report";

export const errorOf = (e: unknown): ErrorReport["error"] =>
  e instanceof Error
    ? { message: e.message, stack: e.stack }
    : { message: String(e) };

/**
 * The report as the text the form shows. It says what is in it, then holds it as JSON in a fenced block tagged `cmb-report` (as the old
 * editor's issue body did, so a script that reads those can read these: `JSON.parse` of the block is an `ErrorReport`).
 */
export function reportText(report: ErrorReport): string {
  return `What went wrong: ${report.error.message}

This is everything the report holds: the program text, the recent actions in the editor (the keys you pressed in it, which blocks you clicked or
dragged, and the text you committed, pasted or searched for), the error, and your browser. Look through it, and delete anything you would rather not
share. Nothing is sent by the editor: copy this text to where it should go.

\`\`\`json ${REPORT_FENCE}
${JSON.stringify(report, null, 1)}
\`\`\`
`;
}

/** the report back from the text of `reportText` (null if it holds none) */
export function parseReportText(text: string): ErrorReport | null {
  const m = new RegExp(
    "```json " + REPORT_FENCE + "\\n([\\s\\S]*?)\\n```"
  ).exec(text);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as ErrorReport;
  } catch {
    return null;
  }
}

/** an error nobody caught, within this many milliseconds of something done to the editor, is taken for the editor's (the old editor's 2 seconds) */
export const RECENT_MS = 2000;

/**
 * Watch `win` for uncaught errors and unhandled rejections. `recent()` says whether the editor was used just now (errors that have nothing to do with
 * the editor are none of its business). Nothing is swallowed: the listeners only look (no `preventDefault`), so the browser reports the error as it
 * would have. Returns how to stop.
 */
export function watchUncaught(
  win: Window,
  recent: () => boolean,
  found: (error: unknown, source: "uncaught" | "unhandledrejection") => void
): () => void {
  const seen = new WeakSet<object>();
  const once = (e: unknown, source: "uncaught" | "unhandledrejection") => {
    // (the same error object reaches both a handler's catch and the window: once)
    if (typeof e === "object" && e) {
      if (seen.has(e)) return;
      seen.add(e);
    }
    found(e, source);
  };
  const onError = (e: ErrorEvent): void => {
    if (recent()) once(e.error ?? e.message, "uncaught");
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    if (recent()) once(e.reason, "unhandledrejection");
  };
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onRejection);
  return () => {
    win.removeEventListener("error", onError);
    win.removeEventListener("unhandledrejection", onRejection);
  };
}
