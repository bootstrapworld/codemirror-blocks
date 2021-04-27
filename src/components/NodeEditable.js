import React, {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import ContentEditable from './ContentEditable';
import SHARED from '../shared';
import classNames from 'classnames';
import {insert, activateByNid, Target} from '../actions';
import {say} from '../utils';
import CodeMirror from 'codemirror';

class NodeEditable extends Component {
  static defaultProps = {
    children: null,
  }

  static propTypes = {
    target: PropTypes.instanceOf(Target),
    children: PropTypes.node,
    isInsertion: PropTypes.bool.isRequired,
    value: PropTypes.string,
    dispatch: PropTypes.func,
    setErrorId: PropTypes.func,
    onChange: PropTypes.func,
    onDisableEditable: PropTypes.func,
    clearSelections: PropTypes.func,
    focusSelf: PropTypes.func,
    isErrored: PropTypes.bool,
    contentEditableProps: PropTypes.object,
    extraClasses: PropTypes.array,
  }

  constructor(props) {
    super(props);
    const {value, dispatch} = this.props;
    this.cachedValue = "";
    if (value === null) {
      dispatch((_, getState) => {
        const {ast} = getState();
        const {target} = this.props;
        console.log(target.getText(ast));
        this.cachedValue = target.getText(ast);
      });
    }
  }

  saveEdit = e => {
    e.stopPropagation();
    const {target, setErrorId, onChange, onDisableEditable, dispatch} = this.props;
    dispatch((dispatch, getState) => {
      const {focusId, ast} = getState();
      // if there's no insertion value, or the new value is the same as the
      // old one, preserve focus on original node and return silently
      if (this.props.value === this.cachedValue || !this.props.value) {
        this.props.onDisableEditable(false);
        const focusNode = ast.getNodeById(focusId);
        const nid = focusNode && focusNode.nid;
        dispatch(activateByNid(nid, true));
        return;
      }

      const value = this.props.value;
      let annt = `${this.props.isInsertion ? 'inserted' : 'changed'} ${value}`;

      const onSuccess = ({firstNewId}) => {
        if (firstNewId !== null && firstNewId !== undefined) {
          const {ast} = getState();
          const firstNewNid = ast.getNodeById(focusId).nid;
          dispatch(activateByNid(firstNewNid, {allowMove: true}));
        } else {
          dispatch(activateByNid(null, {allowMove: false}));
        }
        onChange(null);
        onDisableEditable(false);
        setErrorId('');
        say(annt);
      };
      const onError = e => {
        const errorText = SHARED.parser.getExceptionMessage(e);
        console.log(errorText);
        this.ignoreBlur = false;
        setErrorId(target.node ? target.node.id : 'editing');
        this.setSelection(false);
      };
      insert(value, target, onSuccess, onError, annt);
    });
  }

  handleKeyDown = e => {
    switch (CodeMirror.keyName(e)) {
    case 'Enter': {
      this.ignoreBlur = true;
      this.saveEdit(e);
      return;
    }
    case 'Alt-Q':
    case 'Esc':
      this.ignoreBlur = true;
      e.stopPropagation();
      this.props.onChange(null);
      this.props.onDisableEditable(false);
      this.props.setErrorId('');
      setTimeout(() => this.props.focusSelf(), 200);
      return;
    }
  }

  suppressEvent = e => {
    e.stopPropagation();
  }

  componentDidMount() {
    const text = this.props.value || this.cachedValue || "";
    const annt = (this.props.isInsertion ? 'inserting' : 'editing') + ` ${text}`;
    say(annt + `.  Use Enter to save, and Alt-Q to cancel`);
    this.props.clearSelections();
  }

  /*
   * No need to reset text because we assign new key (via the parser + patching)
   * to changed nodes, so they will be completely unmounted and mounted back
   * with correct values.
   */

  handleBlur = e => {
    if (this.ignoreBlur) return;
    this.saveEdit(e);
  }

  setSelection = isCollapsed => {
    setTimeout(() => {
      if(!document.body.contains(this.element)) {
        console.error("The quarantine element has not been added to the document!");
      }
      const range = document.createRange();
      range.selectNodeContents(this.element);
      if (isCollapsed) range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }, 20);
  }

  contentEditableDidMount = el => {
    this.element = el;
    this.setSelection(this.props.isInsertion);
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
      'blocks-node',
      {'blocks-error': this.props.isErrored},
    ].concat(extraClasses);

    const text = value !== null ? value : this.cachedValue;
    return (
      <ContentEditable
        {...contentEditableProps}
        className  = {classNames(classes)}
        role       = "textbox"
        itDidMount = {this.contentEditableDidMount}
        onChange   = {onChange}
        onBlur     = {this.handleBlur}
        onKeyDown  = {this.handleKeyDown}
        // trap mousedown, clicks and doubleclicks, to prevent focus change, or
        // parent nodes from toggling collapsed state
        onMouseDown= {this.suppressEvent}
        onClick    = {this.suppressEvent}
        onDoubleClick = {this.suppressEvent}
        aria-label = {text}
        value      = {text} />
    );
  }
}

const mapStateToProps = ({cm, errorId}, {target}) => {
  const nodeId = target.node ? target.node.id : 'editing';
  const isErrored = errorId == nodeId;
  return {cm, isErrored};
};

const mapDispatchToProps = dispatch => ({
  dispatch,
  setErrorId: errorId => dispatch({type: 'SET_ERROR_ID', errorId}),
  focusSelf: () => dispatch(activateByNid(null, {allowMove: false})),
  clearSelections: () => dispatch({type: 'SET_SELECTIONS', selections: []}),
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
