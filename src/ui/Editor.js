import React, {Component} from 'react';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import classNames from 'classnames';
import CodeMirrorBlocks from '../blocks';
import {EVENT_DRAG_START, EVENT_DRAG_END} from '../blocks';
import Toolbar from './Toolbar';
import TrashCan from './TrashCan';
import PropTypes from 'prop-types';
import Search from './Search';
import ByString from './searchers/ByString';
import ByBlock from './searchers/ByBlock';
import './Editor.less';

export default class Editor extends Component {
  static propTypes = {
    options: PropTypes.object,
    cmOptions: PropTypes.object,
    language: PropTypes.string.isRequired,
    value: PropTypes.string,
  }

  static defaultProps = {
    options: {},
    cmOptions: {},
    value: '',
  }

  state = {
    showTrashCan: false,
    blockMode: false,
  }

  componentDidMount() {
    this.blocks = new CodeMirrorBlocks(
      this.getCodeMirror(),
      this.props.language,
      this.props.options
    );
    this.blocks.setBlockMode(this.state.blockMode);
    this.blocks.on(EVENT_DRAG_START, this.showTrashCan);
    this.blocks.on(EVENT_DRAG_END, this.hideTrashCan);
    // hrm, the code mirror instance is only available after
    // this gets rendered the first time, but we need
    // the codemirror instance in order to render...
    // so render again!
    this.forceUpdate();
  }

  componentWillUnmount() {
    this.blocks.off(EVENT_DRAG_START, this.showTrashCan);
    this.blocks.off(EVENT_DRAG_END, this.hideTrashCan);
  }

  getCodeMirror() {
    return this.cm;
  }

  getCodeMirrorBlocks() {
    return this.blocks;
  }

  showTrashCan = () => {
    this.setState({showTrashCan:true});
  }

  hideTrashCan = () => {
    this.setState({showTrashCan:false});
  }

  toggleBlocks = () => {
    this.blocks.toggleBlockMode();
    this.forceUpdate();
  }

  dropNodeOnTrash = (nodeId) => {
    this.blocks.deleteNodeWithId(nodeId);
    this.hideTrashCan();
  }

  render() {
    const blocks = this.blocks || {parser:{}};
    const glyphClass = classNames('glyphicon', {
      'glyphicon-pencil': blocks.blockMode,
      'glyphicon-align-left': !blocks.blockMode
    });
    const editorClass = classNames('Editor', {
      'blocks': blocks.blockMode,
      'text': !blocks.blockMode
    });
    const toolbarPaneClasses = classNames(
      "col-xs-3 toolbar-pane",
      {'show-trashcan':this.state.showTrashCan}
    );
    const buttonAria = "Switch to "+ ((this.blocks && this.blocks.blockMode)? "text" : "blocks") + " mode";
    const extras = this.blocks ? (
      <React.Fragment>
        <div className={toolbarPaneClasses} aria-hidden={!blocks.blockMode} tabIndex="-1">
          <Toolbar primitives={this.blocks.parser.primitives}
                   renderer={this.blocks.renderer}
                   languageId={this.blocks.language.id} />
          <TrashCan onDrop={this.dropNodeOnTrash} />
        </div>
        <Search searchModes={[ByString, ByBlock]} blocks={this.blocks} />
      </React.Fragment>
    ) : null;
    

    return (
      <div className={editorClass}>
        <button className="blocks-toggle-btn btn btn-default btn-sm"
                aria-label={buttonAria}
                onClick={this.toggleBlocks}
                tabIndex="0">
            <span className={glyphClass}></span>
        </button>
        {extras}
        <div className="col-xs-9 codemirror-pane">
        <CodeMirror options={this.props.cmOptions}
                    value={this.props.value}
                    editorDidMount={editor => this.cm = editor} />
        </div>
      </div>
    );
  }
}
