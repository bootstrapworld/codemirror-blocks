import React, {PureComponent} from 'react';

export default class DropTarget extends PureComponent {

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
