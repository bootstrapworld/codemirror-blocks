import React, {Component} from 'react';
import PropTypes from 'prop-types/prop-types';
import {connect} from 'react-redux';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import SHARED from '../shared';
import {say} from '../utils';

// CodeMirror APIs that we need to disallow
// NOTE(Emmanuel): we should probably block 'on' and 'off'...
const unsupportedAPIs = ['startOperation', 'endOperation', 'operation'];

class TextEditor extends Component {
  static propTypes = {
    cmOptions: PropTypes.object,
    parser: PropTypes.object.isRequired,
    initialCode: PropTypes.string.isRequired,
    onBeforeChange: PropTypes.func,
    onMount:PropTypes.func.isRequired,
    setAnnouncer: PropTypes.func.isRequired,
    api: PropTypes.object,
    events: PropTypes.object.isRequired,
  }

  static defaultProps = {
    events: {}
  }

  handleEditorDidMount = ed => {
    const wrapper = ed.getWrapperElement();
    wrapper.setAttribute('aria-label', 'Text Editor');

    const scroller = ed.getScrollerElement();
    scroller.setAttribute('role', 'presentation');

    const announcements = document.createElement('span');
    announcements.setAttribute('role', 'log');
    announcements.setAttribute('aria-live', 'assertive');
    wrapper.appendChild(announcements);
    this.props.setAnnouncer(announcements);
    say("Text Mode Enabled", 500);
    
    SHARED.cm = ed;

    // reconstitute any marks and render them
    setTimeout( () => {
      SHARED.recordedMarks.forEach(m => SHARED.cm.markText(m.from, m.to, m.options));
    }, 250);

    this.props.onMount(ed);

    // export methods to the object interface
    Object.assign(this.props.api, this.buildAPI(ed));
  }

  // override default CM methods, or add our own
  buildAPI() {
    const api = {};
    // show which APIs are unsupported
     // show which APIs are unsupported
    unsupportedAPIs.forEach(f =>
      api[f] = () => {
        throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
      });
    return api;
  }

  componentDidMount() {
    SHARED.parser = this.props.parser;
  }

  render() {
    return (
      // we add a wrapper div to maintain a consistent DOM with BlockEditor
      // see DragAndDropEditor.js for why the DND context needs a wrapper
      <div> 
        <CodeMirror
          value={this.props.initialCode}
          onBeforeChange={this.props.onBeforeChange}
          options={this.props.cmOptions}
          editorDidMount={this.handleEditorDidMount} />
      </div>
    );
  }
}

const mapStateToProps = _state => ({});
const mapDispatchToProps = dispatch => ({
  dispatch,
  setAnnouncer: announcer => dispatch({type: 'SET_ANNOUNCER', announcer}),
});

export default connect(mapStateToProps, mapDispatchToProps)(TextEditor);
