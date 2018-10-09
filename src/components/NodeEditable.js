import React, {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {ESC, ENTER} from '../keycode';
import ContentEditable from './ContentEditable';
import {commitChanges} from '../codeMirror';
import global from '../global';
import classNames from 'classnames';
import {focusSelf} from '../actions';

class NodeEditable extends Component {
  static defaultProps = {
    children: null,
    willInsertNode: v => v,
    initialSelection: 'all'
  }

  static propTypes = {
    // NOTE: the presence of this Node means ast is not null
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node,

    willInsertNode: PropTypes.func,
    initialSelection: PropTypes.oneOf(['all', 'end']),
  }

  handleKeyDown = e => {
    switch (e.keyCode) {
    case ENTER: {
      this.ignoreBlur = true;
      e.stopPropagation();
      const {node, setErrorId, onDisableEditable} = this.props;

      const value = this.props.willInsertNode(this.props.value, this.props.node);

      commitChanges(
        cm => () => {
          cm.replaceRange(value, node.from, node.to);
        },
        () => {
          onDisableEditable(false);
          setErrorId('');
          setTimeout(() => this.props.focusSelf(), 200);
        },
        () => {
          e.preventDefault();
          setErrorId(node.id);
          this.setSelection('all');
        }
      );
      return;
    }
    case ESC:
      this.ignoreBlur = true;
      e.stopPropagation();
      this.props.onChange(null);
      this.props.onDisableEditable(false);
      this.props.setErrorId('');
      return;
    }
  }

  handleClick = e => {
    e.stopPropagation();
  }

  componentDidUpdate(prevProps) {
    if (this.element && this.props.isErrored) {
      this.focusSelf();
      if (!prevProps.isErrored) this.setSelection();
    }
  }

  componentDidMount() {
    this.focusSelf(true);

    // NOTE(Oak): the presence of NodeEditable means that selections should be
    // disabled
    this.props.clearSelections();
  }

  focusSelf(noRefresh=false) {
    // NOTE(Oak): the noRefresh parameter is to circumvent
    // https:bugzilla.mozilla.org/show_bug.cgi?id=1317098
    const scroll = global.cm.getScrollInfo();
    let {top, bottom, left, right} = this.element.getBoundingClientRect();
    const offset = global.cm.getWrapperElement().getBoundingClientRect();
    top    += scroll.top  - offset.top;
    bottom += scroll.top  - offset.top;
    left   += scroll.left - offset.left;
    right  += scroll.left - offset.left;
    global.cm.scrollIntoView({top, bottom, left, right}, 100);
    this.element.focus();
    if (!noRefresh) global.cm.refresh();
    // TODO: we need refreshing to make focusing right, but where should we put it?
  }

  /*
   * No need to reset text because we assign new key (via the parser + patching)
   * to changed nodes, so they will be completely unmounted and mounted back
   * with correct values.
   */

  handleBlur = e => {
    e.stopPropagation();
    if (this.ignoreBlur) return;
    const {node, setErrorId, onDisableEditable} = this.props;

    const value = this.props.willInsertNode(this.props.value, this.props.node);
    commitChanges(
      cm => () => {
        cm.replaceRange(value, node.from, node.to);
      },
      () => {
        onDisableEditable(false);
        setErrorId('');
      },
      () => {
        e.preventDefault();
        setErrorId(node.id);
        this.setSelection('all');
      }
    );
  }

  setSelection = mode => {
    setTimeout(() => {
      const range = document.createRange();
      range.selectNodeContents(this.element);
      if (mode === 'end') range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }, 0);
  }

  contentEditableDidMount = el => {
    this.element = el;
    this.setSelection(this.props.initialSelection);
  }

  render() {
    const {
      contentEditableProps,
      extraClasses,
      value,
      onChange,
    } = this.props;


    const classes = [
      'blocks-literal',
      'quarantine',
      'blocks-editing',
      {'blocks-error': this.props.isErrored},
    ].concat(extraClasses);

    return (
      <ContentEditable
        {...contentEditableProps}
        className  = {classNames(classes)}
        role       = "textbox"
        itDidMount = {this.contentEditableDidMount}
        onChange   = {onChange}
        onBlur     = {this.handleBlur}
        onKeyDown  = {this.handleKeyDown}
        onClick    = {this.handleClick}
        value      = {value} />
    );
  }
}

const mapStateToProps = ({cm, errorId}, {node}) => {
  const isErrored = errorId == node.id;
  return {cm, isErrored};
};

const mapDispatchToProps = dispatch => ({
  setErrorId: errorId => dispatch({type: 'SET_ERROR_ID', errorId}),
  focusSelf: () => dispatch(focusSelf()),
  clearSelections: () => dispatch({type: 'SET_SELECTIONS', selections: []})
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
