import React from 'react';
import PropTypes from 'prop-types';
import Component from './BlockComponent';
import NodeEditable from './NodeEditable';
import {connect} from 'react-redux';
import global from '../global';

class DropTarget extends Component {

  static propTypes = {
    location: PropTypes.instanceOf(Object).isRequired
  }

  state = {editable: false}

  handleEditableChange = editable => {
    this.setState({editable});
  }

  handleDoubleClick = e => {
    e.stopPropagation();
    this.handleMakeEditable();
  }

  handleMakeEditable = () => {
    if (this.props.globalHasError) return;
    this.setState({editable: true});
    global.cm.refresh(); // is this needed?
  }

  render() {
    // TODO: take a look at this and make sure props is right
    const props = {
      tabIndex          : "-1",
      role              : 'textbox',
      'aria-setsize'    : '1',
      'aria-posinset'   : '1',
      'aria-level'      : '1',
    };
    const {location} = this.props;
    const node = {
      from: location,
      to: location,
      id: 'editing',
    };
    if (this.state.editable) {
      return (
        <NodeEditable node={node}
                      dropTarget={true}
                      contentEditableProps={props}
                      extraClasses={['blocks-node', 'blocks-white-space']}
                      onEditableChange={this.handleEditableChange} />
      );
    }
    return (
      <span
        className="blocks-drop-target blocks-white-space"
        onDoubleClick = {this.handleDoubleClick}
        data-line={location.line}
        data-ch={location.ch} />
    );
  }
}


const mapStateToProps = ({cm, errorId}) => {
  return {
    cm,
    globalHasError: errorId !== '',
  };
};

const mapDispatchToProps = dispatch => ({
});

export default connect(mapStateToProps, mapDispatchToProps)(DropTarget);
