import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import SHARED from '../shared';

// CodeMirror APIs that we need to disallow
// NOTE(Emmanuel): we should probably block 'on' and 'off'...
const unsupportedAPIs = ['startOperation', 'endOperation', 'operation'];

class TextEditor extends Component {
  static propTypes = {
    cmOptions: PropTypes.object,
    parse: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
    onBeforeChange: PropTypes.func,
    onMount:PropTypes.func.isRequired,
    setAnnouncer: PropTypes.func.isRequired,
    api: PropTypes.object,
    passedAST: PropTypes.object,
  }

  /**
   * @internal
   * When the editor mounts, build the API
   */
    handleEditorDidMount = ed => {
    this.props.onMount(ed, this.buildAPI(ed), this.props.passedAST);
  }

  /**
   * @internal
   * Build the API for a text editor, restricting APIs that are
   * incompatible with our toggleable block editor
   */
  buildAPI() {
    const api = {};
    // show which APIs are unsupported
    unsupportedAPIs.forEach(f =>
      api[f] = () => {
        throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
      });
    return api;
  }

  componentDidMount() {
    SHARED.parse = this.props.parse;
  }

  render() {
    return (
      // we add a wrapper div to maintain a consistent DOM with BlockEditor
      // see DragAndDropEditor.js for why the DND context needs a wrapper
      <div> 
        <CodeMirror
          value={this.props.value}
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
