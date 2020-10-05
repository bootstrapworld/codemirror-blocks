import React, {Component} from 'react';
import PropTypes from 'prop-types';


export default class ToggleButton extends Component {
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
