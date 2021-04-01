import {UnControlled as CodeMirror} from 'react-codemirror2';
import React, {Component}  from 'react';
import PropTypes from 'prop-types/prop-types';
import {DropNodeTarget} from '../dnd';
import {drop, OverwriteTarget} from '../actions';
import {connect} from 'react-redux';
import SHARED from '../shared';
import {playSound, BEEP} from '../utils';

export default

@connect(null, dispatch => ({dispatch}))

@DropNodeTarget(function(monitor) {
  const roots = SHARED.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID);
  const {x:left, y:top} = monitor.getClientOffset();

  // Did we get proper coordinate information from react DND?
  let droppedOn = false;
  if (left && top) {
    droppedOn = document.elementFromPoint(left, top);
  }
  
  // Do those coordinates land outside all roots, but still in CM whitespace?
  let isDroppedOnWhitespace = false;
  if (droppedOn) {
    isDroppedOnWhitespace = !roots.some(r => r.replacedWith.contains(droppedOn));
  }

  // If it's in a valid part of CM whitespace, translate to "insert at loc" edit
  if (isDroppedOnWhitespace) {
    const loc = SHARED.cm.coordsChar({left, top});
    drop(monitor.getItem(), new OverwriteTarget(loc, loc));
  // Or else beep and make it a no-op
  } else {
    playSound(BEEP);
  }
})

class WrappedCodeMirror extends Component {

  static propTypes = {
    connectDropTarget: PropTypes.func.isRequired,
  }

  handleDragOver = (ed, e) => {
    if (!e.target.classList.contains('CodeMirror-line')) {
      e.preventDefault();
    }
  }

  handleDrop = _ => {
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
          {/* 
            Invisible form for error logging
            NOTE(Emmanuel) we should re-evaluate this when dealing 
            with pages that have multiple block editors 
          */ }
          <iframe name="hidden_iframe" id="hidden_iframe" style={{display:'none'}}></iframe>
          <form method="post"
                action="https://docs.google.com/forms/d/e/1FAIpQLScJMw-00Kl3bxqp9NhCjijn0I8okCtVeX3VrwT7M1uTsYqBkw/formResponse"
                name="theForm" 
                id="errorLogForm" 
                target="hidden_iframe" 
                style={{display:'none'}}>
                <textarea name="entry.1311696515" id="description" defaultValue="Auto-Generated Crash Log"/>
                <textarea name="entry.1568521986" id="history"     defaultValue="default_history"/>
                <textarea name="entry.785063835"  id="exception"   defaultValue="default_exception"/>
                <input type="button" value="Submit" className="submit"/>
          </form>
      </div>
    );
  }
}
