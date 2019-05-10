import {UnControlled as CodeMirror} from 'react-codemirror2';
import React  from 'react';
import {DropNodeTarget} from '../dnd';
import * as Targets from '../targets';
import {drop} from '../actions';
import {connect} from 'react-redux';
import SHARED from '../shared';
import {playSound, BEEP} from '../sound';

export default

@connect(null, dispatch => ({dispatch}))

@DropNodeTarget(function(monitor) {
  const roots = SHARED.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID);
  const {x:left, y:top} = monitor.getClientOffset();
  const droppedOn = document.elementFromPoint(left, top);
  const isDroppedOnWhitespace = !roots.some(r => r.replacedWith.contains(droppedOn));

  if (isDroppedOnWhitespace) {
    const loc = SHARED.cm.coordsChar({left, top});
    const target = Targets.topLevel(loc, loc);
    drop(monitor.getItem(), target);
  } else { // beep and make it a no-op
    playSound(BEEP);
  }
})

class WrappedCodeMirror extends React.Component {

  handleDragOver = (ed, e) => {
    if (!e.target.classList.contains('CodeMirror-line')) {
      e.preventDefault();
    }
  }

  handleDrop = (ed, e) => {
    // :( this never fire because of the other onDrop, although this onDrop
    // has the access to the information whether we drop at the right place :(
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
