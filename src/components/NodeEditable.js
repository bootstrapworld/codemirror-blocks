import React, {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import {ESC, ENTER} from '../keycode';
import ContentEditable from './ContentEditable';
import CodeMirror from 'codemirror';
import {setAST} from '../actions';

class NodeEditable extends Component {
  static defaultProps = {
    children: null,
  }

  static propTypes = {
    node: PropTypes.instanceOf(ASTNode),
    children: PropTypes.node,

    cm: PropTypes.object.isRequired,
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
    const scroll = this.props.cm.getScrollInfo();
    let {top, bottom, left, right} = this.element.getBoundingClientRect();
    const offset = this.props.cm.getWrapperElement().getBoundingClientRect();
    top    += scroll.top  - offset.top;
    bottom += scroll.top  - offset.top;
    left   += scroll.left - offset.left;
    right  += scroll.left - offset.left;
    this.props.cm.scrollIntoView({top, bottom, left, right}, 100);
    this.element.focus();
    if (!noRefresh) this.props.cm.refresh();
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
    const {node, cm, parser, setAST, setErrorId} = this.props;
    // NOTE: e comes from either click or keydown event
    if (e.keyCode && e.keyCode === ESC) {
      this.setState({value: null});
      this.props.onEditableChange(false);
      this.props.setErrorId('');
      return;
    }

    const tmpDiv = document.createElement('div');
    const tmpCM = CodeMirror(tmpDiv, {value: cm.getValue()});

    tmpCM.on('changes', (editor, changes) => {
      let newAST = null;
      try {
        newAST = parser.parse(editor.getValue());
      } catch (exception) {
        e.preventDefault();
        this.props.setErrorId(node.id);
        return;
      }
      setAST(newAST, changes, editor);
      this.props.onEditableChange(false);
      this.props.setErrorId('');
      cm.replaceRange(this.state.value, node.from, node.to);
    });

    tmpCM.replaceRange(this.state.value, node.from, node.to);
  }

  contentEditableDidMount = el => this.element = el;

  static getDerivedStateFromProps(props, state) {
    if (props.editable && !state.value) {
      return {value: props.cm.getRange(props.node.from, props.node.to)};
    }
    return null;
  }


  render() {
    const {
      contentEditableProps,
      children,
      extraClasses,
    } = this.props;


    if (this.props.editable) {
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
          itDidMount = {this.contentEditableDidMount}
          onChange   = {this.handleChange}
          onBlur     = {this.handleBlur}
          onKeyDown  = {this.handleKeyDown}
          onClick    = {this.handleClick}
          value      = {this.state.value} />
      );
    }
    return (
      <React.Fragment>
        {children}
      </React.Fragment>
    );
  }
}

const mapStateToProps = ({cm, errorId, parser}, {node}) => {
  const isErrored = errorId == node.id;
  return {cm, parser, isErrored};
};

const mapDispatchToProps = dispatch => ({
  setAST: (ast, changes, cm) => dispatch(setAST(ast, changes, cm)),
  setErrorId: errorId => dispatch({type: 'SET_ERROR_ID', errorId}),
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
