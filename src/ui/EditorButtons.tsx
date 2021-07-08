import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {logResults} from '../utils';

type ToggleButtonProps = {
  setBlockMode: (blockMode: boolean) => void;
  blockMode: boolean;
}
export class ToggleButton extends Component<ToggleButtonProps> {
  static propTypes = {
    setBlockMode: PropTypes.func.isRequired,
    blockMode: PropTypes.bool.isRequired
  }

  // call setBlockMode on the opposite of the current mode
  handleToggle = () => {
    this.props.setBlockMode(!this.props.blockMode);
  }

  render() {
    const modeName   = this.props.blockMode ? "text" : "blocks";
    const buttonAria = "Switch to " + modeName + " mode";
    const buttonIcon = this.props.blockMode? "✏️" : "🧱";
    return (
      <button className="blocks-toggle-btn btn btn-default btn-sm"
              onClick={this.handleToggle}
              tabIndex={0}>
        <span aria-hidden="true">{buttonIcon}</span>
        <span className="btn-title">{buttonAria}</span>
      </button>
    );
  }
}

export class BugButton extends Component {

  handleBugReport = () => {
    // TODO(pcardune): putting things on window is generally a bad idea
    const history = JSON.stringify((window as any).reducerActivities);
    const description = prompt("Briefly describe what happened");
    logResults(history, "user-generated bug report", description);
  }

  render() {
    return (
      <button className="bug-btn btn btn-default btn-sm"
              onClick={this.handleBugReport}
              tabIndex={0}>
        <span aria-hidden="true">&#128030;</span>
        <span className="btn-title">Report a Bug</span>
      </button>
    );
  }
}
