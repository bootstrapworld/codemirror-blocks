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

    // reconstitute any marks and render them
    setTimeout( () => {
      SHARED.recordedMarks.forEach(m => SHARED.cm.markText(m.from, m.to, m.options));
    }, 250);

    // export methods to the object interface
    merge(this.props.api, this.buildAPI(ed));
  }

  buildAPI(ed) {
    return {
      'markText': (from, to, opts) => ed.markText(from, to, opts),
      'getAllMarks': () => ed.getAllMarks(),
      'findMarks': (from, to) => ed.findMarks(from, to),
      'findMarksAt': (pos) => ed.findMarksAt(pos),
      'getValue': (sep) => ed.getValue(sep),
      'setValue': (value) => ed.setValue(value),
      'getScrollerElement': () => ed.getScrollerElement(),
      'getCursor': (start) => ed.getCursor(start),
      'setCursor': (pos) => ed.setCursor(pos),
      'runMode': (src, lang, container) => ed.runMode(src, lang, container),
      'refresh': () => ed.refresh(),
      'defineOption': (name, _default, updateFunc) => ed.defineOption(name, _default, updateFunc),
      'Pos': (line, ch, sticky) => ed.Pos(line, ch, sticky),
      'Doc': (text, mode, firstLineNumber, lineSeparator) => ed.Doc(text, mode, firstLineNumber, lineSeparator),
      'swapDoc': (doc) => ed.swapDoc(doc),
      'getDoc': () => ed.getDoc(),
      'charCoords': (pos, mode) => ed.charCoords(pos, mode),
      'getScrollInfo': () => ed.getScrollInfo(),
      'getWrapperElement': () => ed.getWrapperElement(),
      'scrollIntoView': (what, margin) => ed.scrollIntoView(what, margin),
      'addLineClass': (line, where, _class) => ed.addLineClass(line, where, _class),
      'on': (type, func) => ed.on(type, func), // another on(obj, type, func) version...
      'off': (type, func) => ed.off(type, func),
      'removeLineClass': (line, where, _class) => ed.removeLineClass(line, where, _class),
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
