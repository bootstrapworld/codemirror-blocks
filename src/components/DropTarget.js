import React, {PureComponent, PropTypes} from 'react';

export default class DropTarget extends PureComponent {
  static propTypes = {
    location: PropTypes.shape({
      line: PropTypes.number.isRequired,
      ch: PropTypes.number.isRequired,
    }).isRequired,
  };

  render() {
    const {location} = this.props;
    return (
      <span
        className="blocks-drop-target blocks-white-space"
        data-line={location.line}
        data-ch={location.ch}
      />
    );
  }
}
