import React from "react";

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

export const BugButton = () => {
  const openBugWindow = () => {
    const url = new URL(
      "https://github.com/bootstrapworld/codemirror-blocks/issues/new"
    );
    url.searchParams.set("labels", "bug, User Submitted");
    url.searchParams.set("template", "bug_report.md");
    url.searchParams.set("title", "[BUG]");

    url.searchParams.set(
      "body",
      `**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

Collapsing or uncollapsing a node, changing focus, selecting and
unselecting may not seem like actions worth reporting,
but they all affect the state of the app and may be important when
trying to reproduce the bug.
Please be as detailed as you can!

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Additional context**
Add any other context about the problem here.

<details>

<summary>Additional information for developers</summary>

userAgent: ${navigator.userAgent}

</details>

`
    );

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
