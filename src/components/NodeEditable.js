import React, {Component} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {ASTNode} from '../ast';
import ContentEditable from './ContentEditable';
import SHARED from '../shared';
import classNames from 'classnames';
import {insert, activate, Targets} from '../actions';
import {say, warn} from '../utils';


class NodeEditable extends Component {
  static defaultProps = {
    children: null,
  }

  static propTypes = {
    target: PropTypes.instanceOf(Targets.Target),
    children: PropTypes.node,
    isInsertion: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);
    const {target, value, dispatch} = this.props
    if (value === null) {
      dispatch((_, getState) => {
        const {ast} = getState();
        const {target} = this.props;
        this.cachedValue = target.getText(ast);
      });
    }
  }

  saveEdit = e => {
    e.stopPropagation();
    const {target, setErrorId, onChange, onDisableEditable, dispatch} = this.props;
    dispatch((dispatch, getState) => {
      const {ast, focusId} = getState();

      if (this.props.value === null || this.props.value === this.cachedValue) {
        this.props.onDisableEditable(false);
        dispatch(activate(focusId, true));
        return;
      }

      const value = this.props.value;
      const onSuccess = ({firstNewId}) => {
        if (firstNewId !== null) {
          dispatch(activate(firstNewId, {allowMove: true}));
        } else {
          dispatch(activate(null, {allowMove: false}));
        }
        onChange(null);
        onDisableEditable(false);
        setErrorId('');
        say(`${this.props.isInsertion ? 'inserted' : 'changed'} ${value}`);
      };
      const onError = e => {
        const errorText = SHARED.parser.getExceptionMessage(e);
        console.log(errorText);
        this.ignoreBlur = false;
        setErrorId(target.node ? target.node.id : 'editing');
        this.setSelection(false);
      };
      insert(value, target, onSuccess, onError);
    });
  }

  handleKeyDown = e => {
    switch (SHARED.keyName(e)) {
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

  handleClick = e => {
    e.stopPropagation();
  }

  componentDidMount() {
    const text = this.props.value !== null ? this.props.value : this.cachedValue;
    say(`${this.props.isInsertion ? 'inserting' : 'editing'} ${text}. Use Enter to save, and Alt-Q to cancel`);
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
      const range = document.createRange();
      range.selectNodeContents(this.element);
      if (isCollapsed) range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }, 10);
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
        onClick    = {this.handleClick}
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
  focusSelf: () => dispatch(activate(null, {allowMove: false})),
  clearSelections: () => dispatch({type: 'SET_SELECTIONS', selections: []}),
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
