import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import merge from '../merge';
import SHARED from '../shared';


class TextEditor extends Component {
  static propTypes = {
    cmOptions: PropTypes.object,
    parser: PropTypes.object.isRequired,
    initialCode: PropTypes.string.isRequired,
    onBeforeChange: PropTypes.func,
    setAnnouncer: PropTypes.func.isRequired,
    api: PropTypes.object,
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
    
    SHARED.cm = ed;

    // export methods to the object interface
    merge(this.props.api, this.buildAPI(ed));
  }

  buildAPI(ed) {
    return {
      'cm': {
        'markText': (from, to, opts) => ed.markText(from, to, opts),
        'getValue': (sep) => ed.getValue(sep),
        'setValue': (value) => ed.setValue(value),
        'getScrollerElement': () => ed.getScrollerElement(),
        'getCursor': (start) => ed.getCursor(start),
        'setCursor': (pos) => ed.setCursor(pos),
      }
    };
  }

  componentDidMount() {
    const {
      parser
    } = this.props;

    SHARED.parser = parser;
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
