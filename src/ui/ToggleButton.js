import React, {Component} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';


export default class ToggleButton extends Component {
  static propTypes = {
    onToggle: PropTypes.func.isRequired
  }

  state = {
    blockMode: false
  }

  handleToggle = () => {
    this.setState((state, props) => {
      let newBlockMode = !state.blockMode;
      props.onToggle(newBlockMode);
      return {blockMode: newBlockMode};
    });
  }

  render() {
    const glyphClass = this.state.blockMode
      ? 'glyphicon glyphicon-pencil'
      : 'glyphicon glyphicon-align-left';
    const modeName = this.state.blockMode ? "text" : "blocks";
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
