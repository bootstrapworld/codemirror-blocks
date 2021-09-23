import React, { Component } from "react";
import PropTypes from "prop-types";
import { logResults } from "../utils";

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
      <span className="btn-title">{buttonAria}</span>
    </button>
  );
};

// TODO(pcardune): putting things on window is generally a bad idea
export const BugButton = () => {
  const handleBugReport = () => {
    const history = JSON.stringify((window as any).reducerActivities);
    const description = prompt("Briefly describe what happened");
    logResults(history, "user-generated bug report", description);
  };

  return (
    <button
      className="bug-btn btn btn-default btn-sm"
      onClick={handleBugReport}
      tabIndex={0}
    >
      <span aria-hidden="true">&#128030;</span>
      <span className="btn-title">Report a Bug</span>
    </button>
  );
};
