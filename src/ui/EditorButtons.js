import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {logResults} from '../utils';

export class ToggleButton extends Component {
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
              aria-label={buttonAria}
              title={buttonAria}
              onClick={this.handleToggle}
              tabIndex="0">
        <span>{buttonIcon}</span>
      </button>
    );
  }
}

export class BugButton extends Component {

  handleBugReport = () => {
    const history = JSON.stringify(window.reducerActivities);
    const description = prompt("Briefly describe what happened");
    logResults(history, "user-generated bug report", description);
  }

  render() {
    return (
      <button className="bug-btn btn btn-default btn-sm"
              aria-label="Report a bug"
              title="Report a bug"
              onClick={this.handleBugReport}
              tabIndex="0">
        <span>&#128030;</span>
      </button>
    );
  }
}
