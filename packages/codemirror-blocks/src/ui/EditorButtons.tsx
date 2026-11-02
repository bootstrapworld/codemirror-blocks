import React from "react";
import {
  getActivityBase,
  getLastError,
  getReducerActivities,
} from "../state/activityLog";
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
export const BugButton = (props: BugButtonProps) => {
  const openBugWindow = () => {
    const { dropped, baseCode } = getActivityBase();
    const report: BugReport = {
      format: 1,
      version: VERSION,
      language: props.language,
      blockMode: props.blockMode,
      userAgent: navigator.userAgent,
      code: props.code,
      startCode: baseCode,
      actions: toReportActions(getReducerActivities()),
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
  return (
    <button
      className="bug-btn btn btn-default btn-sm"
      onClick={openBugWindow}
      tabIndex={0}
    >
      <span aria-hidden="true">&#128030;</span>
      <span className="btn-title screenreader-only">Report a Bug</span>
    </button>
  );
};
