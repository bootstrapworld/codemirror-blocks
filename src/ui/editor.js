import React from 'react';
import CodeMirror from 'react-codemirror';
import classNames from 'classnames';
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
    this.blocks = new CodeMirrorBlocks(
      this.getCodeMirror(),
      this.props.parser,
      this.props.options
    );
    this.blocks.setBlockMode(true);
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

  toggleBlocks() {
    this.blocks.toggleBlockMode();
    this.forceUpdate();
  },

  render() {
    let blocks = this.blocks || {parser:{}};
    let glyphClass = classNames('glyphicon', {
      'glyphicon-pencil': blocks.blockMode,
      'glyphicon-align-left': !blocks.blockMode
    });
    return (
      <div className="Editor">
        <div className="row">
          <div className="col-xs-3 toolbar-pane">
            <Toolbar blocks={blocks}/>
          </div>
          <div className="col-xs-9 codemirror-pane">
            <CodeMirror ref="cm" options={this.props.cmOptions}/>
            <button className="blocks-toggle-btn btn btn-default btn-sm"
                    onClick={this.toggleBlocks}>
              <span className={glyphClass}></span>
            </button>
          </div>
        </div>
      </div>
    );
  }
});
