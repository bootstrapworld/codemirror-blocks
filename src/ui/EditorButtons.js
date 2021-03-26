import React, {Component} from 'react';
import PropTypes from 'prop-types/prop-types';
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
    const glyphClass = this.props.blockMode
      ? 'glyphicon glyphicon-pencil'
      : 'glyphicon glyphicon-align-left';
    const modeName = this.props.blockMode ? "text" : "blocks";
    const buttonAria = "Switch to " + modeName + " mode";
    return (
      <button className="blocks-toggle-btn btn btn-default btn-sm"
              aria-label={buttonAria}
              onClick={this.handleToggle}
              tabIndex="0">
        <span className={glyphClass}></span>
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
    const glyphClass = 'glyphicon glyphicon-warning-sign';
    return (
      <button className="bug-btn btn btn-default btn-sm"
              aria-label="Report a bug" 
              onClick={this.handleBugReport}
              tabIndex="0">
        <span className={glyphClass}></span>
      </button>
    );
  }
}
