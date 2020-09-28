import React from 'react';

const ToggleButton = props => {
  // call setBlockMode on the opposite of the current mode
  const handleToggle = () => {
    props.setBlockMode(!props.blockMode);
  }

  const glyphClass = props.blockMode
      ? 'glyphicon glyphicon-pencil'
      : 'glyphicon glyphicon-align-left';
  const modeName = props.blockMode ? "text" : "blocks";
  const buttonAria = "Switch to " + modeName + " mode";
  return (
    <button className="blocks-toggle-btn btn btn-default btn-sm"
            aria-label={buttonAria}
            onClick={handleToggle}
            tabIndex="0">
      <span className={glyphClass}></span>
    </button>
  );
};

export default ToggleButton