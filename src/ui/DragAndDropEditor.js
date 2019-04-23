import {UnControlled as CodeMirror} from 'react-codemirror2';
import React  from 'react';
import {DropNodeTarget} from '../dnd';
import {dropNode} from '../actions';
import {connect} from 'react-redux';
import SHARED from '../shared';
import {playSound, BEEP} from '../sound';

export default

@connect(null, dispatch => ({dispatch}))

@DropNodeTarget(function(monitor) {
  let roots = SHARED.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID);
  const {x: left, y: top} = monitor.getClientOffset();
  let notDroppedOnRootNode = !roots.some(root => {
    // CM will keep the longest line in the DOM for scrollbar purposes, but use visibility:hidden
    // if that line is outside of the viewport so that it doesn't show up. We need to check for
    // this, since getBoundingClientRect() ignores whether an elt is hidden. 
    if(window.getComputedStyle(root.replacedWith).visibility == "hidden") return false;
    // for visible nodes, see if the drop location falls within the root's ClientRect
    let r = root.replacedWith.firstChild.getBoundingClientRect();
    return (r.left<left) && (left<r.right) && (r.top<top) && (top<r.bottom);
  });

  if (notDroppedOnRootNode) {
    let loc = SHARED.cm.coordsChar({left, top});
    let dest = {from: loc, to: loc, isDropTarget: true};
    return this.props.dispatch(dropNode(monitor.getItem(), dest));
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
