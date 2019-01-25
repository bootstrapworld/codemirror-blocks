import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {Controlled as CodeMirror} from 'react-codemirror2';
import SHARED from '../shared';


class TextEditor extends Component {
  static propTypes = {
    cmOptions: PropTypes.object,
    parser: PropTypes.object.isRequired,
    code: PropTypes.string.isRequired,
    onBeforeChange: PropTypes.func.isRequired,
    setAnnouncer: PropTypes.func.isRequired,
    external: PropTypes.object,
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
    this.setExternalMethods(ed, this.props.external);
  }

  // attach all the CM methods to the external object, and 
  // add/override with CMB-specific methods
  setExternalMethods(ed, ext) {
    let protoChain = Object.getPrototypeOf(ed);
    Object.getOwnPropertyNames(protoChain).forEach(m => 
      ext[m] = (...args) => ed[m](...args));
    // attach a getState method for debugging
    ext.getState = () => this.props.dispatch((_, getState) => getState());
  }

  componentDidMount() {
    const {
      parser
    } = this.props;

    SHARED.parser = parser;
  }

  render() {
    return (
      <CodeMirror
        value={this.props.code}
        onBeforeChange={this.props.onBeforeChange}
        cmOptions={this.props.cmOptions}
        editorDidMount={this.handleEditorDidMount} />
    );
  }
}

const mapStateToProps = _state => ({});
const mapDispatchToProps = dispatch => ({
  dispatch,
  setAnnouncer: announcer => dispatch({type: 'SET_ANNOUNCER', announcer}),
});

export default connect(mapStateToProps, mapDispatchToProps)(TextEditor);
