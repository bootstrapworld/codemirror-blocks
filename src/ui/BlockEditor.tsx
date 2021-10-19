import React, { Component } from "react";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import "./Editor.less";
import { connect, ConnectedProps } from "react-redux";
import {
  activateByNid,
  getCursor,
  setCursor,
  setSelections,
  extendSelections,
  replaceSelections,
  listSelections,
  markText,
  buildAPI,
} from "../actions";
import type { BuiltAPI } from "../actions";
import { commitChanges, FocusHint } from "../edits/commitChanges";
import { speculateChanges } from "../edits/speculateChanges";
import DragAndDropEditor from "./DragAndDropEditor";
import {
  minpos,
  maxpos,
  validateRanges,
  BlockError,
  setAfterDOMUpdate,
  cancelAfterDOMUpdate,
  getTempCM,
} from "../utils";
import type { afterDOMUpdateHandle } from "../utils";
import { keyDown } from "../keymap";
import { ASTNode, Pos } from "../ast";
import type { AST } from "../ast";
import CodeMirror, { SelectionOptions } from "codemirror";
import type { Options, API, Language } from "../CodeMirrorBlocks";
import type { AppDispatch, AppThunk } from "../store";
import type { Activity, AppAction, RootState } from "../reducers";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext, LanguageContext } from "../components/Context";
import { CodeMirrorFacade, CMBEditor, ReadonlyCMBEditor } from "../editor";
import ToplevelBlockEditable from "./ToplevelBlockEditable";
import { isChangeObject, makeChangeObject } from "../edits/performEdits";
import ToplevelBlock from "./ToplevelBlock";
import { AppHelpers } from "../components/Context";

const mapStateToProps = ({ ast, cur, quarantine }: RootState) => ({
  ast,
  cur,
  hasQuarantine: !!quarantine,
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
});

const blockEditorConnector = connect(mapStateToProps, mapDispatchToProps);
type $TSFixMe = any;

export type Search = {
  search: (
    forward: boolean,
    cmbState: RootState,
    overrideCur?: null | Pos
  ) => ASTNode | null;
  onSearch: (done: () => void, searchForward: () => void) => void;
  setCursor: (cursor: Pos) => void;
  setCM: (editor: ReadonlyCMBEditor) => void;
};

export type BlockEditorProps = typeof BlockEditor.defaultProps &
  ConnectedProps<typeof blockEditorConnector> & {
    value: string;
    options?: Options;
    codemirrorOptions?: CodeMirror.EditorConfiguration;
    /**
     * language being used
     */
    language: Language;
    search?: Search;
    keyDownHelpers: AppHelpers;
    onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
    onMount: (editor: CodeMirrorFacade, api: BuiltAPI, passedAST: AST) => void;
    passedAST: AST;
    ast: AST;
  };

type BlockEditorState = {
  editor: CMBEditor | null;
};

class BlockEditor extends Component<BlockEditorProps> {
  mouseUsed: boolean;
  newAST: AST;
  pendingTimeout: afterDOMUpdateHandle;
  state: BlockEditorState = { editor: null };

  constructor(props: BlockEditorProps) {
    super(props);
    this.mouseUsed = false;

    // NOTE(Emmanuel): we shouldn't have to dispatch this in the constructor
    // just for tests to pass! Figure out how to reset the store manually
    props.dispatch({ type: "RESET_STORE_FOR_TESTING" });
  }

  static defaultProps = {
    search: {
      search: () => null,
      onSearch: () => {},
      setCursor: () => {},
      setCM: () => {},
    } as Search,
    options: {} as Options,
  };

  /**
   * @internal
   * Used for reproducing/debugging (see ToggleEditor::loadLoggedActions)
   * Filter/Tweak logged history actions before dispatching them to
   * be executed.
   */
  private executeAction(activity: Activity) {
    // ignore certain logged actions that are already
    // handled by the BlockEditor constructor
    const ignoreActions = ["RESET_STORE_FOR_TESTING"];
    if (ignoreActions.includes(activity.type)) {
      return;
    }

    let action: AppAction;
    // SET_AST actions have been serialized to printed code
    // set the value of the editor to that code, reconstruct
    // the action to use the resulting AST, and delete code
    if (activity.type == "SET_AST") {
      this.getEditorOrThrow().setValue(activity.code);
      const { code, ...toCopy } = activity;
      action = { ...toCopy, ast: this.props.ast };
    }
    // convert nid to node id, and use activate to generate the action
    else if (activity.type == "SET_FOCUS") {
      this.props.dispatch(
        activateByNid(
          this.getEditorOrThrow(),
          this.props.search,
          activity.nid,
          {
            allowMove: true,
          }
        )
      );
      return;
    } else {
      action = activity;
    }
    this.props.dispatch(action);
  }

  componentWillUnmount() {
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  componentDidMount() {
    this.refreshCM();
  }

  componentDidUpdate() {
    this.refreshCM();
  }

  /**
   * @internal
   * As long as there's no quarantine, refresh the editor to compute
   * possibly-changed node sizes
   */
  refreshCM() {
    this.props.dispatch((_, getState) => {
      if (!getState().quarantine) {
        this.state.editor?.refresh(); // don't refresh mid-quarantine
      }
    });
  }

  private getEditorOrThrow() {
    if (!this.state.editor) {
      throw new Error(`Expected codemirror to have mounted by now`);
    }
    return this.state.editor;
  }

  render() {
    const {
      codemirrorOptions,
      keyDownHelpers,
      language,
      dispatch,
      search,
      passedAST,
      options,
      value,
      onMount,
    } = this.props;

    /**
     * Anything that didn't come from CMB itself must be speculatively
     * checked. NOTE: this only checks the *first change* in a changeset!
     * This is hooked up to CodeMirror's onBeforeChange; event
     */
    const handleBeforeChange = (
      editor: CodeMirrorFacade,
      change: CodeMirror.EditorChangeCancellable
    ) => {
      if (!isChangeObject(change)) {
        const result = speculateChanges(
          [change],
          language.parse,
          editor.getValue()
        );
        // Successful! Let's save all the hard work we did to build the new AST
        if (result.successful) {
          this.newAST = result.value;
        }
        // Error! Cancel the change and report the error
        else {
          change.cancel();
          throw new BlockError(
            "An invalid change was rejected",
            "Invalid Edit",
            change
          );
        }
      }
    };

    /**
     * Given a CM Change Event, manually handle our own undo and focus stack
     */
    const handleChanges = (
      editor: ReadonlyCMBEditor,
      changes: CodeMirror.EditorChange[]
    ) => {
      dispatch((dispatch, getState) => {
        if (!changes.every(isChangeObject)) {
          // These changes did not originate from us. However, they've all
          // passed the `handleBeforeChange` function, so they must be valid edits.
          // (There's almost certainly just one edit here; I (Justin) am not
          // convinced this will always work if there is more than one edit here.)
          // Since the edit(s) is valid, commit it without calling speculateChanges.

          // Turn undo and redo into cmb actions, update the focusStack, and
          // provide a focusHint
          if (changes[0].origin === "undo") {
            const { actionFocus } = getState();
            if (actionFocus) {
              const focusHint: FocusHint = (newAST) =>
                actionFocus.oldFocusNId === null
                  ? null
                  : newAST.getNodeByNId(actionFocus.oldFocusNId);
              dispatch(
                commitChanges(
                  search,
                  changes.map(makeChangeObject),
                  language.parse,
                  editor,
                  true,
                  focusHint,
                  this.newAST
                )
              );
              dispatch({ type: "UNDO", editor: editor });
            }
          } else if (changes[0].origin === "redo") {
            const { actionFocus } = getState();
            if (actionFocus) {
              const { newFocusNId } = actionFocus;
              const focusHint = (newAST: AST) =>
                newFocusNId === null ? null : newAST.getNodeByNId(newFocusNId);
              dispatch(
                commitChanges(
                  search,
                  changes.map(makeChangeObject),
                  language.parse,
                  editor,
                  true,
                  focusHint,
                  this.newAST
                )
              );
              dispatch({ type: "REDO", editor });
            }
          } else {
            // This (valid) changeset is coming from outside of the editor, but we
            // don't know anything else about it. Apply the change, set the focusHint
            // to the top of the tree (-1), and provide an astHint so we don't need
            // to reparse and rebuild the tree
            let annt = "";
            for (let i = changes.length - 1; i >= 0; i--) {
              annt = annt + changes[i].origin;
              if (i !== 0) {
                annt = " and " + annt;
              }
            }
            if (annt === "") {
              annt = "change";
            }
            getState().undoableAction = annt; //?
            dispatch(
              commitChanges(
                search,
                changes.map(makeChangeObject),
                language.parse,
                editor,
                false,
                -1,
                this.newAST
              )
            );
          }
        }
      });
    };

    /**
     * When the editor mounts, (1) set change event handlers and AST,
     * (2) set the focus, (3) set aria attributes, and (4) build the API
     */
    const handleEditorDidMount = (editor: CodeMirrorFacade) => {
      this.setState({ editor });
      // TODO(Emmanuel): are these needed?
      // can't we set them in the component constructor?
      editor.codemirror.on("beforeChange", (ed, change) =>
        handleBeforeChange(editor, change)
      );
      editor.codemirror.on("changes", (ed, changes) =>
        handleChanges(editor, changes)
      );

      // set AST and search properties and collapse preferences
      dispatch({ type: "SET_AST", ast: passedAST });
      search.setCM(editor);
      if (options.collapseAll) {
        dispatch({ type: "COLLAPSE_ALL" });
      }

      // When the editor receives focus, select the first root (if it exists)
      const firstRoot = passedAST.getFirstRootNode();
      if (firstRoot) {
        dispatch({ type: "SET_FOCUS", focusId: firstRoot.id });
      }

      // Set extra aria attributes
      const wrapper = editor.codemirror.getWrapperElement();
      wrapper.setAttribute("role", "tree");
      wrapper.setAttribute("aria-multiselectable", "true");
      wrapper.setAttribute("tabIndex", "-1");

      // pass the block-mode CM editor, API, and current AST
      onMount(editor, buildAPI(editor, dispatch, search), passedAST);
    };

    /**
     * When the CM instance receives focus...
     * If we have a CM cursor, let CM handle it (no-op)
     * Otherwise grab the focusId, compute NId, and activate
     */
    const handleTopLevelFocus = (editor: CodeMirrorFacade) => {
      cancelAfterDOMUpdate(this.pendingTimeout);
      this.pendingTimeout = setAfterDOMUpdate(() => {
        dispatch((_, getState) => {
          const { cur, focusId, ast } = getState();
          if (cur != null) return; // if we already have a cursor, bail
          const node = focusId
            ? ast.getNodeByIdOrThrow(focusId)
            : ast.getFirstRootNode();
          activateByNid(editor, search, node && node.nid, {
            allowMove: true,
          });
        });
      });
    };

    /**
     * When the CM instance receives a keypress...start a quarantine if it's
     * not a modifier
     */
    const handleTopLevelKeyPress = (
      ed: CodeMirror.Editor,
      e: React.KeyboardEvent
    ) => {
      const text = e.key;
      // let CM handle kbd shortcuts or whitespace insertion
      if (e.ctrlKey || e.metaKey || text.match(/\s+/)) return;
      e.preventDefault();
      const start = ed.getCursor("from");
      const end = ed.getCursor("to");
      this.props.dispatch({
        type: "SET_QUARANTINE",
        start: start,
        end: end,
        text: text,
      });
    };

    /**
     * When the CM instance receives a paste event...start a quarantine
     */
    const handleTopLevelPaste = (
      editor: CodeMirrorFacade,
      e: ClipboardEvent
    ) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        const start = editor.codemirror.getCursor(true as $TSFixMe);
        const end = editor.codemirror.getCursor(false as $TSFixMe);
        this.props.dispatch({
          type: "SET_QUARANTINE",
          start: start,
          end: end,
          text: text,
        });
      }
    };

    /**
     * When the CM instance receives cursor activity...
     * If there are selections, pass null. Otherwise pass the cursor.
     */
    const handleTopLevelCursorActivity = (editor: CodeMirrorFacade) => {
      let cur =
        editor.codemirror.getSelection().length > 0
          ? null
          : editor.codemirror.getCursor();
      dispatch(setCursor(editor, cur, search));
    };

    return (
      <LanguageContext.Provider value={language}>
        <DragAndDropEditor
          options={codemirrorOptions}
          className={`blocks-language-${language.id}`}
          value={value}
          onKeyPress={handleTopLevelKeyPress}
          onFocus={handleTopLevelFocus}
          onPaste={handleTopLevelPaste}
          onKeyDown={(editor, e) => {
            dispatch(
              keyDown(e, {
                search: search,
                language: language,
                editor,
                isNodeEnv: false,
                appHelpers: keyDownHelpers,
              })
            );
          }}
          onCursorActivity={handleTopLevelCursorActivity}
          editorDidMount={handleEditorDidMount}
        />
        {this.renderPortals()}
      </LanguageContext.Provider>
    );
  }

  private renderPortals = () => {
    const incrementalRendering =
      this.props.options.incrementalRendering ?? false;
    let portals;
    const { editor } = this.state;
    if (editor && this.props.ast) {
      // Render all the top-level nodes
      portals = [...this.props.ast.children()].map((r) => (
        <EditorContext.Provider value={editor} key={r.id}>
          <ToplevelBlock
            node={r}
            incrementalRendering={incrementalRendering}
            editor={editor}
          />
        </EditorContext.Provider>
      ));
      if (this.props.hasQuarantine) {
        portals.push(<ToplevelBlockEditable editor={editor} key="-1" />);
      }
    }
    return portals;
  };
}
export type { BlockEditor };
const ConnectedBlockEditor = blockEditorConnector(BlockEditor);
export type BlockEditorComponentClass = typeof ConnectedBlockEditor;
export default ConnectedBlockEditor;
