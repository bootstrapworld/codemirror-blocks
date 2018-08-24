import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';

export default class DropTarget extends Component {

  static propTypes = {
    location: PropTypes.instanceOf(Object).isRequired
  }

  render() {
    const {location} = this.props;
    return (
      <span
        className="blocks-drop-target blocks-white-space"
        data-line={location.line}
        data-ch={location.ch} />
    );
  }
}
