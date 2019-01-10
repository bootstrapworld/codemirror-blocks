import {Controlled as CodeMirror} from 'react-codemirror2';
import React  from 'react';
import {DropNodeTarget} from '../dnd';
import {dropNode} from '../actions';
import {connect} from 'react-redux';

const mapDispatchToProps = dispatch => ({
  onDrop: (src, dest) => dispatch(dropNode(src, {...dest, isDropTarget: true})),
});

export default
@connect(null, mapDispatchToProps)
@DropNodeTarget(({location}) => ({from: location, to: location}))
class WrappedCodeMirror extends React.Component {

  handleDragOver = (ed, e) => {
    if (!e.target.classList.contains('CodeMirror-line')) {
      e.preventDefault();
    }
  }

  handleDrop = (ed, e) => {
    // :( this never fire because of the other onDrop, although this onDrop
    // has the access to the information whether we drop at the right place :(
    console.log(e);
  }

  render() {
    return this.props.connectDropTarget(
      <div>
        <CodeMirror
          onDrop={this.handleDrop}
          onDragOver={this.handleDragOver}
          {...this.props} />
      </div>
    );
  }
}
