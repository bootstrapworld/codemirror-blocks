import React, {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {ESC, ENTER} from '../keycode';
import ContentEditable from './ContentEditable';
import {OptionsContext} from '../ui/Context';
import {commitChanges} from '../codeMirror';
import global from '../global';

class NodeEditable extends Component {
  static defaultProps = {
    children: null,
    willInsertNode: (_, x) => x,
  }

  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node,

    dropTarget: PropTypes.bool.isRequired,

    parser: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
    // NOTE: the presence of this Node means ast is not null
  }

  state = {
    value: null, // use this value lazily (since it's pretty expensive)
  }

  handleKeyDown = e => {
    switch (e.keyCode) {
    case ENTER:
    case ESC:
      e.stopPropagation();
      this.handleBlur(e);
      return;
    }
  }

  handleClick = e => {
    e.stopPropagation();
  }

  componentDidUpdate() {
    if (this.element && this.props.isErrored) {
      this.focusSelf();
    }
  }

  focusSelf(noRefresh=false) {
    // NOTE(Oak): the noRefresh parameter is to circumvent
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1317098
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

  handleChange = (_, value) => {
    this.setState({value});
  }

  /*
   * No need to reset text because we assign new key (via the parser + patching)
   * to changed nodes, so they will be completely unmounted and mounted back
   * with correct values.
   */

  handleBlur = e => {
    e.stopPropagation();
    if (e.relatedTarget === null) {
      // In Chrome, somehow onBlur happens several times, but the subsequent
      // event has relatedTarget === null, so we add this to bail out.
      return;
    }
    const {node, cm, parser, setErrorId, onEditableChange} = this.props;
    // NOTE: e comes from either click or keydown event
    if (e.keyCode && e.keyCode === ESC) {
      this.setState({value: null});
      onEditableChange(false);
      setErrorId('');
      return;
    }

    let value = null;

    if (this.props.dropTarget && this.props.options.willInsertNode) {
      value = this.props.options.willInsertNode(
        global.cm,
        this.state.value,
        undefined, // TODO(Oak): just only for the sake of backward compat. Get rid if possible
        this.props.node.from,
      );
    } else {
      value = this.state.value;
    }

    commitChanges(
      cm => () => cm.replaceRange(value, node.from, node.to),
      () => {
        onEditableChange(false);
        setErrorId('');
      },
      () => {
        e.preventDefault();
        setErrorId(node.id);
      }
    );
  }

  contentEditableDidMount = el => this.element = el;

  static getDerivedStateFromProps(props, state) {
    if (!state.value) {
      return {value: global.cm.getRange(props.node.from, props.node.to)};
    }
    return null;
  }


  render() {
    const {
      contentEditableProps,
      children,
      extraClasses,
    } = this.props;


    const classes = [
      'blocks-literal',
      'quarantine',
      'blocks-editing',
      this.props.isErrored ? 'blocks-error' : '',
    ].concat(extraClasses);

    return (
      <ContentEditable
        {...contentEditableProps}
        className  = {classes.join(' ')}
        role       = "textbox"
        itDidMount = {this.contentEditableDidMount}
        onChange   = {this.handleChange}
        onBlur     = {this.handleBlur}
        onKeyDown  = {this.handleKeyDown}
        onClick    = {this.handleClick}
        value      = {this.state.value} />
    );
  }
}

function WrappedNodeEditable(props) {
  return (
    <OptionsContext.Consumer>
      {
        ({parser, options}) =>
          <NodeEditable {...props} parser={parser} options={options} />
      }
    </OptionsContext.Consumer>
  );
}

const mapStateToProps = ({cm, errorId}, {node}) => {
  const isErrored = errorId == node.id;
  return {cm, isErrored};
};

const mapDispatchToProps = dispatch => ({
  setErrorId: errorId => dispatch({type: 'SET_ERROR_ID', errorId}),
});

export default connect(mapStateToProps, mapDispatchToProps)(WrappedNodeEditable);
