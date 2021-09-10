import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect, ConnectedProps } from "react-redux";
import {
  IUnControlledCodeMirror,
  UnControlled as CodeMirror,
} from "react-codemirror2";
import SHARED from "../shared";
import { API } from "./ToggleEditor";
import { AST } from "../ast";
import { Editor } from "codemirror";
import { AppDispatch } from "../store";

// CodeMirror APIs that we need to disallow
// NOTE(Emmanuel): we should probably block 'on' and 'off'...
const unsupportedAPIs = ["startOperation", "endOperation", "operation"];

const mapStateToProps = () => ({});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
  setAnnouncer: (announcer: HTMLElement) =>
    dispatch({ type: "SET_ANNOUNCER", announcer }),
});
const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector> & {
  cmOptions?: {};
  parse: Function;
  value: string;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (ed: Editor, api: API, ast: AST) => void;
  setAnnouncer: Function;
  api?: API;
  passedAST?: AST;
};

class TextEditor extends Component<Props> {
  /**
   * @internal
   * When the editor mounts, build the API
   */
  handleEditorDidMount = (ed: Editor) => {
    this.props.onMount(ed, this.buildAPI(), this.props.passedAST);
  };

  /**
   * @internal
   * Build the API for a text editor, restricting APIs that are
   * incompatible with our toggleable block editor
   */
  buildAPI() {
    const api = {};
    // show which APIs are unsupported
    unsupportedAPIs.forEach(
      (f) =>
        ((api as any)[f] = () => {
          throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
        })
    );
    return api as API;
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
          editorDidMount={this.handleEditorDidMount}
        />
      </div>
    );
  }
}

export default connector(TextEditor);
