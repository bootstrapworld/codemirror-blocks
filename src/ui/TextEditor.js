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
    setAnnouncer: PropTypes.func.isRequired
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
  }

  componentDidMount() {
    const {
      parser
    } = this.props;

    SHARED.parser = parser;
  }

  render() {
    return (
      <div className="col-xs-9 codemirror-pane">
        <CodeMirror
          value={this.props.code}
          onBeforeChange={this.props.onBeforeChange}
          cmOptions={this.props.cmOptions}
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
