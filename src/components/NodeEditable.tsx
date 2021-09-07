import React, {Component, ReactElement} from 'react';
import {connect} from 'react-redux';
import ContentEditable, { ContentEditableProps } from './ContentEditable';
import SHARED from '../shared';
import classNames, {Argument as ClassNamesArgument} from 'classnames';
import {insert, activateByNid, Target} from '../actions';
import { say } from "../announcer";
import CodeMirror from 'codemirror';
import { AppDispatch } from '../store';
import { RootState } from '../reducers';
import { AST } from '../ast';

type Props = ContentEditableProps & {
    target?: Target,
    children?: ReactElement,
    isInsertion: boolean,
    value?: string,
    dispatch?: Function,
    setErrorId?: Function,
    onChange?: (e:string)=>void,
    onDisableEditable?: Function,
    clearSelections?: Function,
    focusSelf?: Function,
    isErrored?: boolean,
    contentEditableProps?: {},
    extraClasses?: ClassNamesArgument,
};

class NodeEditable extends Component<Props> {

  cachedValue: string;
  ignoreBlur: boolean;
  element: HTMLElement;

  constructor(props: Props) {
    super(props);
    const {value, dispatch} = this.props;
    this.cachedValue = "";
    if (value === null) {
      dispatch((_:any, getState:()=>RootState) => {
        const {ast} = getState();
        const {target} = this.props;
        this.cachedValue = target.getText(ast);
      });
    }
  }

  saveEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const {target, setErrorId, onChange, onDisableEditable, dispatch} = this.props;
    dispatch((dispatch: AppDispatch, getState:()=>RootState) => {
      const {focusId, ast} = getState();
      // if there's no insertion value, or the new value is the same as the
      // old one, preserve focus on original node and return silently
      if (this.props.value === this.cachedValue || !this.props.value) {
        this.props.onDisableEditable(false);
        const focusNode = ast.getNodeById(focusId);
        const nid = focusNode && focusNode.nid;
        dispatch(activateByNid(nid));
        return;
      }

      const value = this.props.value;
      let annt = `${this.props.isInsertion ? 'inserted' : 'changed'} ${value}`;


      const onSuccess = ({firstNewId}:{newAST:AST, focusId:string, firstNewId?:number}) => {
        // BUG? onSuccess never gets called with firstNewId, and it doesn't look
        // like it has been passed in for at least two years.
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
      const onError = (e: any) => {
        const errorText = SHARED.getExceptionMessage(e);
        console.log(errorText);
        this.ignoreBlur = false;
        setErrorId(target.node ? target.node.id : 'editing');
        this.setSelection(false);
      };
      insert(value, target, onSuccess, onError, annt);
    });
  }

  handleKeyDown = (e: React.KeyboardEvent) => {
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

  suppressEvent = (e:React.SyntheticEvent) => {
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

  handleBlur = (e:React.FocusEvent) => {
    if (this.ignoreBlur) return;
    this.saveEdit(e);
  }

  setSelection = (isCollapsed: boolean) => {
    window.requestAnimationFrame(() => setTimeout(() => {
      const range = document.createRange();
      range.selectNodeContents(this.element);
      if (isCollapsed) range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      this.element.focus();
    }, 0));
  }

  contentEditableDidMount = (el:HTMLElement) => {
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

    const classes = ([
      'blocks-literal',
      'quarantine',
      'blocks-editing',
      'blocks-node',
      {'blocks-error': this.props.isErrored},
    ] as ClassNamesArgument[]).concat(extraClasses);

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

const mapStateToProps = ({errorId}: RootState, {target}: {target:Target}) => {
  const nodeId = target.node ? target.node.id : 'editing';
  const isErrored = errorId == nodeId;
  return {isErrored};
};

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
  setErrorId: (errorId: string) => dispatch({type: 'SET_ERROR_ID', errorId}),
  focusSelf: () => dispatch(activateByNid(null, {allowMove: false})),
  clearSelections: () => dispatch({type: 'SET_SELECTIONS', selections: []}),
});

export default connect(mapStateToProps, mapDispatchToProps)(NodeEditable);
