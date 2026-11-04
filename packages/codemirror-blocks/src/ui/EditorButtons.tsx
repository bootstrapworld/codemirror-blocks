import React from "react";
import { getActivityBase, getLastError, getLog } from "../state/activityLog";
import { BugReport, buildIssue, fence, toReportActions } from "./bugReport";

// kept in step with package.json by hand; it only labels reports
const VERSION = "0.9.0";

type ToggleButtonProps = {
  setBlockMode: (blockMode: boolean) => void;
  blockMode: boolean;
};
export const ToggleButton = (props: ToggleButtonProps) => {
  // call setBlockMode on the opposite of the current mode
  const handleToggle = () => props.setBlockMode(!props.blockMode);

  // build strings for the DOM
  const modeName = props.blockMode ? "text" : "blocks";
  const buttonAria = "Switch to " + modeName + " mode";
  const buttonIcon = props.blockMode ? "✏️" : "🧱";

  return (
    <button
      className="blocks-toggle-btn btn btn-default btn-sm"
      onClick={handleToggle}
      tabIndex={0}
    >
      <span aria-hidden="true">{buttonIcon}</span>
      <span className="btn-title screenreader-only">{buttonAria}</span>
    </button>
  );
};

type BugButtonProps = {
  language: string;
  blockMode: boolean;
  /** the document, as it is now */
  code: string;
};
/** Open a pre-filled GitHub issue with everything needed to replay what happened. */
export const openBugReport = (props: BugButtonProps) => {
  const { dropped, baseCode } = getActivityBase();
  const report: BugReport = {
    format: 2,
    version: VERSION,
    language: props.language,
    blockMode: props.blockMode,
    userAgent: navigator.userAgent,
    code: props.code,
    startCode: baseCode,
    actions: toReportActions(getLog()),
    droppedActions: dropped,
    error: getLastError(),
  };
  const { url, trimmed } = buildIssue(report);
  if (trimmed) {
    // (a failure to copy is not worth stopping for)
    navigator.clipboard?.writeText(fence(report)).catch(() => {});
  }
  window.open(url, "_blank");
};

export const BugButton = (props: BugButtonProps) => (
  <button
    className="bug-btn btn btn-default btn-sm"
    onClick={() => openBugReport(props)}
    tabIndex={0}
  >
    <span aria-hidden="true">&#128030;</span>
    <span className="btn-title screenreader-only">Report a Bug</span>
  </button>
);
