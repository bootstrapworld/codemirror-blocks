import React from 'react';
import CodeMirror from 'react-codemirror';
import CodeMirrorBlocks from '../blocks';
import {Toolbar} from './toolbar';

export var Editor = React.createClass({
  getDefaultProps() {
    return {
      options: {},
      cmOptions: {},
      parser: {}
    };
  },

  componentDidMount() {
    console.log("did mount with", this.props.parser);
    this.blocks = new CodeMirrorBlocks(
      this.getCodeMirror(),
      this.props.parser,
      this.props.options
    );
    // hrm, the code mirror instance is only available after
    // this gets rendered the first time, but we need
    // the codemirror instance in order to render...
    // so render again!
    this.forceUpdate();
  },

  getCodeMirror() {
    return this.refs.cm.getCodeMirror();
  },

  getCodeMirrorBlocks() {
    return this.blocks;
  },

  render() {
    return (
      <div className="Editor">
        <div className="row">
          <div className="col-xs-3">
            <Toolbar blocks={this.blocks || {parser:{}}}/>
          </div>
          <div className="col-xs-9">
            <CodeMirror ref="cm" options={this.props.cmOptions}/>
          </div>
        </div>
      </div>
    );
  }
});
