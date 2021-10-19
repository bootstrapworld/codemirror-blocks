import React, { Component } from "react";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import "./Editor.less";
import { connect, ConnectedProps } from "react-redux";
import { activateByNid, setCursor } from "../actions";
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
} from "../utils";
import type { afterDOMUpdateHandle } from "../utils";
import { keyDown } from "../keymap";
import { ASTNode, Pos } from "../ast";
import type { AST } from "../ast";
import CodeMirror, { SelectionOptions } from "codemirror";
import type { Options, API, Language } from "../CodeMirrorBlocks";
import type { AppDispatch, AppThunk } from "../store";
import type { Activity, AppAction, Quarantine, RootState } from "../reducers";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext, LanguageContext } from "../components/Context";
import {
  CodeMirrorFacade,
  CMBEditor,
  ReadonlyCMBEditor,
  isBlockNodeMarker,
} from "../editor";
import ToplevelBlockEditable from "./ToplevelBlockEditable";
import { isChangeObject, makeChangeObject } from "../edits/performEdits";
import ToplevelBlock from "./ToplevelBlock";
import { AppHelpers } from "../components/Context";

const tmpDiv = document.createElement("div");
function getTempCM(editor: CodeMirrorFacade) {
  const tmpCM = CodeMirror(tmpDiv, { value: editor.getValue() });
  tmpCM.setCursor(editor.codemirror.getCursor());
  return tmpCM;
}

// CodeMirror APIs that we need to disallow
const unsupportedAPIs = [
  "indentLine",
  "toggleOverwrite",
  "setExtending",
  "getExtending",
  "findPosH",
  "findPosV",
  "setOption",
  "addOverlay",
  "removeOverlay",
  "undoSelection",
  "redoSelection",
  "charCoords",
  "coordsChar",
  "cursorCoords",
  "startOperation",
  "endOperation",
  "operation",
  "addKeyMap",
  "removeKeyMap",
  //'on', 'off',
  //'extendSelection',
  //'extendSelections',
  //'extendSelectionsBy'
] as const;

/**
 * Override CM's native getCursor method, restricting it to the semantics
 * that make sense in a block editor
 */
const getCursor = (
  ed: CodeMirrorFacade,
  where = "from",
  dispatch: AppDispatch
) => {
  const { focusId, ast } = dispatch((_, getState) => getState());
  if (focusId && document.activeElement?.id.match(/block-node/)) {
    const node = ast.getNodeByIdOrThrow(focusId);
    if (where == "from") return node.from;
    if (where == "to") return node.to;
    else
      throw new BlockError(
        `getCursor() with ${where} is not supported on a focused block`,
        `API Error`
      );
  } else {
    return ed.codemirror.getCursor(where);
  }
};

/**
 * Override CM's native markText method, restricting it to the semantics
 * that make sense in a block editor (fewer options, restricted to node
 * boundaries)
 */
const markText = (
  ed: CodeMirrorFacade,
  from: CodeMirror.Position,
  to: CodeMirror.Position,
  options: CodeMirror.TextMarkerOptions = {},
  dispatch: AppDispatch
) => {
  const { ast } = dispatch((_, getState) => getState());
  const node = ast.getNodeAt(from, to);
  if (!node) {
    throw new BlockError(
      `Could not create TextMarker: there is no AST node at [${from}, ${to},]`,
      "API Error"
    );
  }
  let supportedOptions = ["css", "className", "title"];
  for (let opt in options) {
    if (!supportedOptions.includes(opt))
      throw new BlockError(
        `markText: option "${opt}" is not supported in block mode`,
        `API Error`
      );
  }
  let mark = ed.codemirror.markText(from, to, options); // keep CM in sync
  const _clear = mark.clear.bind(mark);
  mark.clear = () => {
    _clear();
    dispatch({ type: "CLEAR_MARK", id: node.id });
  };
  mark.find = () => {
    let { from, to } = ast.getNodeByIdOrThrow(node.id);
    return { from, to };
  };
  mark.options = options;
  dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
  return mark;
};

/**
 * Override CM's native listSelections method, using the selection
 * state from the block editor
 */
const listSelections = (ed: CodeMirrorFacade, dispatch: AppDispatch) => {
  const { selections, ast } = dispatch((_, getState) => getState());
  let tmpCM = getTempCM(ed);
  // write all the ranges for all selected nodes
  selections.forEach((id) => {
    const node = ast.getNodeByIdOrThrow(id);
    tmpCM.addSelection(node.from, node.to);
  });
  // write all the existing selection ranges
  ed.codemirror
    .listSelections()
    .map((s) => tmpCM.addSelection(s.anchor, s.head));
  // return all the selections
  return tmpCM.listSelections();
};

/**
 * Override CM's native setSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
const setSelections =
  (
    ed: CodeMirrorFacade,
    ranges: Array<{ anchor: CodeMirror.Position; head: CodeMirror.Position }>,
    primary?: number,
    options?: { bias?: number; origin?: string; scroll?: boolean },
    replace = true
  ): AppThunk =>
  (dispatch, getState) => {
    const { ast } = getState();
    let tmpCM = getTempCM(ed);
    tmpCM.setSelections(ranges, primary, options);
    const textRanges: {
      anchor: CodeMirror.Position;
      head: CodeMirror.Position;
    }[] = [];
    const nodes: string[] = [];
    try {
      validateRanges(ranges, ast);
    } catch (e) {
      throw new BlockError(e, "API Error");
    }
    // process the selection ranges into an array of ranges and nodes
    tmpCM.listSelections().forEach(({ anchor, head }) => {
      const c1 = minpos(anchor, head);
      const c2 = maxpos(anchor, head);
      const node = ast.getNodeAt(c1, c2);
      if (node) {
        nodes.push(node.id);
      } else textRanges.push({ anchor: anchor, head: head });
    });
    if (textRanges.length) {
      if (replace) {
        ed.codemirror.setSelections(textRanges, primary, options);
      } else {
        ed.codemirror.addSelection(textRanges[0].anchor, textRanges[0].head);
      }
    }
    dispatch({ type: "SET_SELECTIONS", selections: nodes });
  };

/**
 * Override CM's native extendSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
const extendSelections =
  (
    ed: CodeMirrorFacade,
    heads: CodeMirror.Position[],
    opts?: SelectionOptions,
    to?: CodeMirror.Position
  ): AppThunk =>
  (dispatch, getState) => {
    let tmpCM: CodeMirror.Editor = getTempCM(ed);
    tmpCM.setSelections(listSelections(ed, dispatch));
    if (to) {
      tmpCM.extendSelections(heads, opts);
    } else {
      tmpCM.extendSelection(heads[0], to, opts);
    }
    // if one of the ranges is invalid, setSelections will raise an error
    dispatch(setSelections(ed, tmpCM.listSelections(), undefined, opts));
  };

/**
 * Override CM's native replaceSelections method, restricting it to the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
const replaceSelections =
  (
    ed: CodeMirrorFacade,
    replacements: string[],
    search: Search,
    select?: "around" | "start"
  ): AppThunk =>
  (dispatch, getState) => {
    let tmpCM: CodeMirror.Editor = getTempCM(ed);
    tmpCM.setSelections(listSelections(ed, dispatch));
    tmpCM.replaceSelections(replacements, select);
    ed.setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if (select == "around") {
      setSelections(ed, tmpCM.listSelections(), undefined, undefined);
    }
    const cur =
      select == "start"
        ? tmpCM.listSelections().pop()?.head
        : tmpCM.listSelections().pop()?.anchor;
    setCursor(ed, cur ?? null, search);
  };

/**
 * Build the API for a block editor, restricting or modifying APIs
 * that are incompatible with our toggleable block editor
 */
const buildAPI = (
  editor: CodeMirrorFacade,
  dispatch: AppDispatch,
  search: Search
): BuiltAPI => {
  const withState = <F extends (state: RootState) => any>(func: F) =>
    dispatch((_, getState) => func(getState()));

  const api: BuiltAPI = {
    /*****************************************************************
     * CM APIs WE WANT TO OVERRIDE
     */
    findMarks: (from, to) =>
      editor.codemirror
        .findMarks(from, to)
        .filter((m) => !isBlockNodeMarker(m)),
    findMarksAt: (pos) =>
      editor.codemirror.findMarksAt(pos).filter((m) => !isBlockNodeMarker(m)),
    getAllMarks: () =>
      editor.codemirror.getAllMarks().filter((m) => !isBlockNodeMarker(m)),
    markText: (from, to, opts) => markText(editor, from, to, opts, dispatch),
    // Something is selected if CM has a selection OR a block is selected
    somethingSelected: () =>
      withState(({ selections }) =>
        Boolean(editor.codemirror.somethingSelected() || selections.length)
      ),
    // CMB has focus if CM has focus OR a block is active
    hasFocus: () =>
      editor.codemirror.hasFocus() ||
      Boolean(document.activeElement?.id.match(/block-node/)),
    extendSelection: (
      from: CodeMirror.Position,
      to: CodeMirror.Position,
      opts?: SelectionOptions
    ) => dispatch(extendSelections(editor, [from], opts, to)),
    extendSelections: (heads, opts) =>
      dispatch(extendSelections(editor, heads, opts, undefined)),
    extendSelectionsBy: (
      f: (range: CodeMirror.Range) => CodeMirror.Position,
      opts?: SelectionOptions
    ) =>
      dispatch(extendSelections(
        editor,
        listSelections(editor, dispatch).map(f),
        opts,
        undefined
      )),
    getSelections: (sep?: string) =>
      listSelections(editor, dispatch).map((s) =>
        editor.codemirror.getRange(s.anchor, s.head, sep)
      ),
    getSelection: (sep?: string) =>
      listSelections(editor, dispatch)
        .map((s) => editor.codemirror.getRange(s.anchor, s.head, sep))
        .join(sep),
    listSelections: () => listSelections(editor, dispatch),
    replaceRange: (text, from, to, origin) =>
      withState(({ ast }) => {
        validateRanges([{ anchor: from, head: to }], ast);
        editor.codemirror.replaceRange(text, from, to, origin);
      }),
    setSelections: (ranges, primary, opts) =>
      dispatch(setSelections(editor, ranges, primary, opts)),
    setSelection: (anchor, head = anchor, opts) =>
      dispatch(setSelections(
        editor,
        [{ anchor: anchor, head: head }],
        undefined,
        opts
      )),
    addSelection: (anchor, head) =>
      dispatch(setSelections(
        editor,
        [{ anchor: anchor, head: head ?? anchor }],
        undefined,
        undefined,
        false
      )),
    replaceSelections: (rStrings, select?: "around" | "start") =>
      dispatch(replaceSelections(editor, rStrings, search, select)),
    replaceSelection: (rString, select?: "around" | "start") =>
      dispatch(replaceSelections(
        editor,
        Array(listSelections(editor, dispatch).length).fill(rString),
        search,
        select
      )),
    // If a node is active, return the start. Otherwise return the cursor as-is
    getCursor: (where) => getCursor(editor, where, dispatch),
    // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
    setCursor: (curOrLine, ch, options) =>
      withState(({ ast }) => {
        ch = ch ?? 0;
        let cur =
          typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
        const node = ast.getNodeContaining(cur);
        if (node) {
          dispatch(
            activateByNid(editor, search, node.nid, {
              record: false,
              allowMove: true,
            })
          );
        }
        dispatch(setCursor(editor, cur, search));
      }),
    // As long as widget isn't defined, we're good to go
    setBookmark: (pos, opts) => {
      if (opts?.widget) {
        throw new BlockError(
          "setBookmark() with a widget is not supported in Block Mode",
          "API Error"
        );
      }
      return editor.codemirror.setBookmark(pos, opts);
    },

    /*****************************************************************
     * APIs THAT ARE UNIQUE TO CODEMIRROR-BLOCKS
     */
    getAst: () => withState((state) => state.ast),
    // activation-test.js expects undefined
    getFocusedNode: () =>
      withState(({ focusId, ast }) =>
        focusId ? ast.getNodeById(focusId) : undefined
      ),
    getSelectedNodes: () =>
      withState(({ selections, ast }) =>
        selections.map((id) => ast.getNodeById(id))
      ),

    /*****************************************************************
     * APIs FOR TESTING
     */
    getQuarantine: () => withState(({ quarantine }) => quarantine),
    setQuarantine: (start, end, text) =>
      dispatch({
        type: "SET_QUARANTINE",
        start: start,
        end: end,
        text: text,
      }),
    // see https://github.com/bootstrapworld/codemirror-blocks/issues/488
    //    executeAction: (action) => executeAction(action),
  };
  // show which APIs are unsupported
  unsupportedAPIs.forEach(
    (f) =>
      ((api as any)[f] = () => {
        throw new BlockError(
          `The CM API '${f}' is not supported in the block editor`,
          "API Error"
        );
      })
  );
  return api;
};

type CodeMirrorAPI = Omit<CodeMirror.Editor, typeof unsupportedAPIs[number]>;

type BlockEditorAPI = {
  getAst(): RootState["ast"];
  getFocusedNode(): ASTNode | undefined;
  getSelectedNodes(): ASTNode[];

  /**
   * @internal
   */
  getQuarantine(): Quarantine;

  /**
   * @internal
   */
  setQuarantine(
    start: Quarantine[0],
    end: Quarantine[1],
    txt: Quarantine[2]
  ): void;

  /**
   * @internal
   */
  // see https://github.com/bootstrapworld/codemirror-blocks/issues/488
  //executeAction(activity: Activity): void;
};

export type BuiltAPI = BlockEditorAPI & Partial<CodeMirrorAPI>;

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
