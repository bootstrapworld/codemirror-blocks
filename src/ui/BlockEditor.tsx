import React, { Component, useEffect } from "react";
import ReactDOM from "react-dom";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import classNames from "classnames";
import "./Editor.less";
import { useDispatch, useSelector } from "react-redux";
import { connect, ConnectedProps } from "react-redux";
import SHARED from "../shared";
import NodeEditable from "../components/NodeEditable";
import { activateByNid, setCursor, OverwriteTarget } from "../actions";
import { commitChanges, FocusHint } from "../edits/commitChanges";
import { speculateChanges } from "../edits/speculateChanges";
import DragAndDropEditor from "./DragAndDropEditor";
import {
  poscmp,
  minpos,
  maxpos,
  validateRanges,
  BlockError,
  setAfterDOMUpdate,
  cancelAfterDOMUpdate,
} from "../utils";
import type { afterDOMUpdateHandle } from "../utils";
import BlockComponent from "../components/BlockComponent";
import { keyDown } from "../keymap";
import { ASTNode, Pos } from "../ast";
import type { AST } from "../ast";
import CodeMirror, { Editor, SelectionOptions } from "codemirror";
import type { Options, API } from "../CodeMirrorBlocks";
import type { AppDispatch } from "../store";
import type { Activity, AppAction, Quarantine, RootState } from "../reducers";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext } from "../components/Context";
import {
  CodeMirrorFacade,
  CMBEditor,
  ReadonlyCMBEditor,
  isBlockNodeMarker,
} from "../editor";

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
  executeAction(activity: Activity): void;
};

export type BuiltAPI = BlockEditorAPI & Partial<CodeMirrorAPI>;

// TODO(Oak): this should really be a new file, but for convenience we will put it
// here for now

type ToplevelBlockProps = {
  incrementalRendering: boolean;
  node: ASTNode;
  editor: CMBEditor;
};

type ToplevelBlockState = {
  renderPlaceholder: boolean;
};

class ToplevelBlock extends BlockComponent<
  ToplevelBlockProps,
  ToplevelBlockState
> {
  container: HTMLElement;
  mark?: CodeMirror.TextMarker;
  pendingTimeout?: afterDOMUpdateHandle;

  constructor(props: ToplevelBlockProps) {
    super(props);
    this.container = document.createElement("span");
    this.container.classList.add("react-container");
    // by default, let's render a placeholder
    this.state = { renderPlaceholder: props.incrementalRendering };
  }

  // we need to trigger a render if the node was moved or resized at the
  // top-level, in order to re-mark the node and put the DOM in the new marker
  shouldComponentUpdate(
    nextProps: ToplevelBlockProps,
    nextState: ToplevelBlockState
  ) {
    return (
      poscmp(this.props.node.from, nextProps.node.from) !== 0 || // moved
      poscmp(this.props.node.to, nextProps.node.to) !== 0 || // resized
      super.shouldComponentUpdate(nextProps, nextState) || // changed
      !document.contains(this.mark?.replacedWith || null)
    ); // removed from DOM
  }

  // When unmounting, clean up the TextMarker and any lingering timeouts
  componentWillUnmount() {
    this.mark?.clear();
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  // once the placeholder has mounted, wait 250ms and render
  // save both the timeout *and* requestAnimationFrame (RAF)
  // in case someone unmounts before all the root components
  // have even rendered
  componentDidMount() {
    if (!this.props.incrementalRendering) return; // bail if incremental is off
    this.pendingTimeout = setAfterDOMUpdate(
      () => this.setState({ renderPlaceholder: false }),
      250
    );
  }

  render() {
    const { node } = this.props;

    // set elt to a cheap placeholder, OR render the entire rootNode
    const elt = this.state.renderPlaceholder ? <div /> : node.reactElement();

    // AFTER THE REACT RENDER CYCLE IS OVER:
    // if any prior block markers are in this range, clear them
    // make a new block marker, and fill it with the portal
    setAfterDOMUpdate(() => {
      const { from, to } = node.srcRange(); // includes the node's comment, if any
      this.mark = this.props.editor.replaceMarkerWidget(
        from,
        to,
        this.container
      );
      node.mark = this.mark;
    });
    return ReactDOM.createPortal(elt, this.container);
  }
}

type ToplevelBlockEditableProps = {
  editor: CMBEditor;
};
const ToplevelBlockEditable = (props: ToplevelBlockEditableProps) => {
  const dispatch: AppDispatch = useDispatch();
  const onDisableEditable = () => dispatch({ type: "DISABLE_QUARANTINE" });
  const onChange = (text: string) =>
    dispatch({ type: "CHANGE_QUARANTINE", text });
  const [start, end, value] = useSelector(({ quarantine }: RootState) => {
    if (!quarantine) {
      throw new Error(
        "ToplevelBlockEditable should only be rendered when there's a quarantine"
      );
    }
    return quarantine;
  });

  // if there's a marker when the component unmounts, clear it
  useEffect(() => {
    return () => marker?.clear();
  }, []);

  const contentEditableProps = {
    tabIndex: "-1",
    role: "text box",
    "aria-setsize": "1",
    "aria-posinset": "1",
    "aria-level": "1",
  };

  // CM marker for the rootNode, and its DOM container
  let marker: CodeMirror.TextMarker | undefined = undefined;
  const container = document.createElement("span");
  container.classList.add("react-container");

  // IF NO MARKER IS DEFINED, WAIT UNTIL THE REACT RENDER
  // CYCLE IS OVER and make a new block marker
  if (!marker)
    window.requestAnimationFrame(() => {
      SHARED.editor.replaceMarkerWidget(start, end, container);
    });

  return ReactDOM.createPortal(
    <NodeEditable
      editor={props.editor}
      target={new OverwriteTarget(start, end)}
      value={value}
      onChange={onChange}
      contentEditableProps={contentEditableProps}
      isInsertion={true}
      extraClasses={[]}
      onDisableEditable={onDisableEditable}
    />,
    container
  );
};

const mapStateToProps = ({ ast, cur, quarantine }: RootState) => ({
  ast,
  cur,
  hasQuarantine: !!quarantine,
});
const mapDispatchToProps = (dispatch: AppDispatch) => ({
  dispatch,
  setAST: (ast: AST) => dispatch({ type: "SET_AST", ast }),
  clearFocus: () => {
    return dispatch({ type: "SET_FOCUS", focusId: null });
  },
  setQuarantine: (
    start: CodeMirror.Position,
    end: CodeMirror.Position,
    text: string
  ) => dispatch({ type: "SET_QUARANTINE", start, end, text }),
  activateByNid: (...args: Parameters<typeof activateByNid>) =>
    dispatch(activateByNid(...args)),
});

const blockEditorConnector = connect(mapStateToProps, mapDispatchToProps);
type $TSFixMe = any;

export type Search = {
  search: (
    forward: boolean,
    cmbState: RootState,
    overrideCur: null | Pos
  ) => ASTNode | null;
  onSearch: (state: null, done: () => void, searchForward: () => void) => void;
  setCursor: (cursor: Pos) => void;
  setCM: (editor: ReadonlyCMBEditor) => void;
};

export type BlockEditorProps = typeof BlockEditor.defaultProps &
  ConnectedProps<typeof blockEditorConnector> & {
    value: string;
    options?: Options;
    codemirrorOptions?: CodeMirror.EditorConfiguration;
    /**
     * id of the language being used
     */
    languageId: string;
    search?: Search;
    onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
    onMount: (editor: CodeMirrorFacade, api: BuiltAPI, passedAST: AST) => void;
    api?: API;
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
   * Anything that didn't come from CMB itself must be speculatively
   * checked. NOTE: this only checks the *first change* in a changeset!
   * This is hooked up to CodeMirror's onBeforeChange event
   */
  private handleBeforeChange = (
    editor: CodeMirrorFacade,
    change: CodeMirror.EditorChangeCancellable
  ) => {
    if (!change.origin?.startsWith("cmb:")) {
      const result = speculateChanges([change], SHARED.parse, editor);
      // Successful! Let's save all the hard work we did to build the new AST
      if (result.successful) {
        this.newAST = result.newAST;
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
   * @internal
   * Given a CM Change Event, manually handle our own undo and focus stack
   */
  private handleChanges = (
    editor: CMBEditor,
    changes: CodeMirror.EditorChange[]
  ) => {
    this.props.dispatch((dispatch, getState) => {
      if (!changes.every((c) => c.origin?.startsWith("cmb:"))) {
        // These changes did not originate from us. However, they've all
        // passed the `handleBeforeChange` function, so they must be valid edits.
        // (There's almost certainly just one edit here; I (Justin) am not
        // convinced this will always work if there is more than one edit here.)
        // Since the edit(s) is valid, commit it without calling speculateChanges.

        // Turn undo and redo into cmb actions, update the focusStack, and
        // provide a focusHint
        if (changes[0].origin === "undo") {
          for (let c of changes) c.origin = "cmb:undo";
          const { actionFocus } = getState();
          if (actionFocus) {
            const focusHint: FocusHint = (newAST) =>
              actionFocus.oldFocusNId === null
                ? null
                : newAST.getNodeByNId(actionFocus.oldFocusNId);
            commitChanges(
              getState(),
              dispatch,
              changes,
              SHARED.parse,
              editor,
              true,
              focusHint,
              this.newAST
            );
            dispatch({ type: "UNDO", editor: editor });
          }
        } else if (changes[0].origin === "redo") {
          for (let c of changes) c.origin = "cmb:redo";
          const { actionFocus } = getState();
          if (actionFocus) {
            const { newFocusNId } = actionFocus;
            const focusHint = (newAST: AST) =>
              newFocusNId === null ? null : newAST.getNodeByNId(newFocusNId);
            commitChanges(
              getState(),
              dispatch,
              changes,
              SHARED.parse,
              editor,
              true,
              focusHint,
              this.newAST
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
            if (i !== 0) annt = " and " + annt;
          }
          if (annt === "") annt = "change";
          getState().undoableAction = annt; //?
          commitChanges(
            getState(),
            dispatch,
            changes,
            SHARED.parse,
            editor,
            false,
            -1,
            this.newAST
          );
        }
      }
    });
  };

  /**
   * @internal
   * When the editor mounts, (1) set change event handlers and AST,
   * (2) set the focus, (3) set aria attributes, and (4) build the API
   */
  private handleEditorDidMount = (editor: CodeMirrorFacade) => {
    this.setState({ editor });
    const { passedAST: ast, setAST, search, options, onMount } = this.props;
    editor.codemirror.on("beforeChange", (ed, change) =>
      this.handleBeforeChange(editor, change)
    );
    editor.codemirror.on("changes", (ed, changes) =>
      this.handleChanges(editor, changes)
    );

    // set AST and searchg properties and collapse preferences
    setAST(ast);
    search.setCM(editor);
    if (options.collapseAll) {
      this.props.dispatch({ type: "COLLAPSE_ALL" });
    }

    // When the editor receives focus, select the first root (if it exists)
    if (ast.rootNodes.length > 0) {
      this.props.dispatch({ type: "SET_FOCUS", focusId: ast.rootNodes[0].id });
    }
    // Set extra aria attributes
    const wrapper = editor.codemirror.getWrapperElement();
    wrapper.setAttribute("role", "tree");
    wrapper.setAttribute("aria-multiselectable", "true");
    wrapper.setAttribute("tabIndex", "-1");

    // pass the block-mode CM editor, API, and current AST
    onMount(editor, this.buildAPI(editor), ast);
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
      this.props.activateByNid(this.getEditorOrThrow(), activity.nid, {
        allowMove: true,
      });
      return;
    } else {
      action = activity;
    }
    this.props.dispatch(action);
  }

  /**
   * @internal
   * Build the API for a block editor, restricting or modifying APIs
   * that are incompatible with our toggleable block editor
   */
  private buildAPI(editor: CodeMirrorFacade): BuiltAPI {
    const withState = <F extends (state: RootState) => any>(func: F) =>
      this.props.dispatch((_, getState) => func(getState()));

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
      markText: (from, to, opts) => this.markText(editor, from, to, opts),
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
      ) => this.extendSelections(editor, [from], opts, to),
      extendSelections: (heads, opts) =>
        this.extendSelections(editor, heads, opts),
      extendSelectionsBy: (
        f: (range: CodeMirror.Range) => CodeMirror.Position,
        opts?: SelectionOptions
      ) =>
        this.extendSelections(editor, this.listSelections(editor).map(f), opts),
      getSelections: (sep?: string) =>
        this.listSelections(editor).map((s) =>
          editor.codemirror.getRange(s.anchor, s.head, sep)
        ),
      getSelection: (sep?: string) =>
        this.listSelections(editor)
          .map((s) => editor.codemirror.getRange(s.anchor, s.head, sep))
          .join(sep),
      listSelections: () => this.listSelections(editor),
      replaceRange: (text, from, to, origin) =>
        withState(({ ast }) => {
          validateRanges([{ anchor: from, head: to }], ast);
          editor.codemirror.replaceRange(text, from, to, origin);
        }),
      setSelections: (ranges, primary, opts) =>
        this.setSelections(editor, ranges, primary, opts),
      setSelection: (anchor, head = anchor, opts) =>
        this.setSelections(
          editor,
          [{ anchor: anchor, head: head }],
          undefined,
          opts
        ),
      addSelection: (anchor, head) =>
        this.setSelections(
          editor,
          [{ anchor: anchor, head: head }],
          undefined,
          undefined,
          false
        ),
      replaceSelections: (rStrings, select?: "around" | "start") =>
        this.replaceSelections(editor, rStrings, select),
      replaceSelection: (rString, select?: "around" | "start") =>
        this.replaceSelections(
          editor,
          Array(this.listSelections(editor).length).fill(rString),
          select
        ),
      // If a node is active, return the start. Otherwise return the cursor as-is
      getCursor: (where) => this.getCursor(editor, where),
      // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
      setCursor: (curOrLine, ch, options) =>
        withState(({ ast }) => {
          ch = ch ?? 0;
          let cur =
            typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
          const node = ast.getNodeContaining(cur);
          if (node) {
            this.props.activateByNid(editor, node.nid, {
              record: false,
              allowMove: true,
            });
          }
          this.props.dispatch(setCursor(editor, cur));
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
      setQuarantine: (start, end, txt) =>
        this.props.setQuarantine(start, end, txt),
      executeAction: (action) => this.executeAction(action),
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
  }

  /**
   * Override CM's native markText method, restricting it to the semantics
   * that make sense in a block editor (fewer options, restricted to node
   * boundaries)
   */
  private markText(
    ed: CodeMirrorFacade,
    from: CodeMirror.Position,
    to: CodeMirror.Position,
    options: CodeMirror.TextMarkerOptions = {}
  ) {
    const node = this.props.ast.getNodeAt(from, to);
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
      this.props.dispatch({ type: "CLEAR_MARK", id: node.id });
    };
    mark.find = () => {
      let { from, to } = this.props.ast.getNodeByIdOrThrow(node.id);
      return { from, to };
    };
    mark.options = options;
    this.props.dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
    return mark;
  }

  /**
   * Override CM's native getCursor method, restricting it to the semantics
   * that make sense in a block editor
   */
  private getCursor(editor: CodeMirrorFacade, where = "from") {
    const dispatch = this.props.dispatch;
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
      return editor.codemirror.getCursor(where);
    }
  }
  /**
   * Override CM's native listSelections method, using the selection
   * state from the block editor
   */
  private listSelections(editor: CodeMirrorFacade) {
    const dispatch = this.props.dispatch;
    const { selections, ast } = dispatch((_, getState) => getState());
    let tmpCM = getTempCM(editor);
    // write all the ranges for all selected nodes
    selections.forEach((id) => {
      const node = ast.getNodeByIdOrThrow(id);
      tmpCM.addSelection(node.from, node.to);
    });
    // write all the existing selection ranges
    editor.codemirror
      .listSelections()
      .map((s) => tmpCM.addSelection(s.anchor, s.head));
    // return all the selections
    return tmpCM.listSelections();
  }
  /**
   * Override CM's native setSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  private setSelections(
    ed: CodeMirrorFacade,
    ranges: Array<{ anchor: CodeMirror.Position; head?: CodeMirror.Position }>,
    primary?: number,
    options?: { bias?: number; origin?: string; scroll?: boolean },
    replace = true
  ) {
    const dispatch = this.props.dispatch;
    const { ast } = dispatch((_, getState) => getState());
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
  }
  /**
   * Override CM's native extendSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  private extendSelections(
    ed: CodeMirrorFacade,
    heads: CodeMirror.Position[],
    opts?: SelectionOptions,
    to?: CodeMirror.Position
  ) {
    let tmpCM: CodeMirror.Editor = getTempCM(ed);
    tmpCM.setSelections(this.listSelections(ed));
    if (to) {
      tmpCM.extendSelections(heads, opts);
    } else {
      tmpCM.extendSelection(heads[0], to, opts);
    }
    // if one of the ranges is invalid, setSelections will raise an error
    this.setSelections(ed, tmpCM.listSelections(), undefined, opts);
  }
  /**
   * Override CM's native replaceSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  private replaceSelections(
    editor: CodeMirrorFacade,
    replacements: string[],
    select?: "around" | "start"
  ) {
    let tmpCM: CodeMirror.Editor = getTempCM(editor);
    tmpCM.setSelections(this.listSelections(editor));
    tmpCM.replaceSelections(replacements, select);
    this.getEditorOrThrow().setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if (select == "around") {
      this.setSelections(editor, tmpCM.listSelections());
    }
    if (select == "start") {
      this.props.dispatch(
        setCursor(editor, tmpCM.listSelections().pop()?.head ?? null)
      );
    } else {
      this.props.dispatch(
        setCursor(editor, tmpCM.listSelections().pop()?.anchor ?? null)
      );
    }
  }

  /**
   * @internal
   * When the CM instance receives focus...
   * If the mouse wasn't used and there's no cursor set, focus on the first root
   * If the mouse WAS used there's no cursor set, get the cursor from CM
   * Otherwise ignore
   */
  private handleTopLevelFocus = (editor: CodeMirrorFacade) => {
    const { dispatch } = this.props;
    dispatch((_, getState) => {
      const { cur } = getState();
      if (!this.mouseUsed && cur === null) {
        // NOTE(Emmanuel): setAfterDOMUpdate so that the CM cursor will not blink
        cancelAfterDOMUpdate(this.pendingTimeout);
        this.pendingTimeout = setAfterDOMUpdate(() =>
          this.props.activateByNid(editor, null, {
            allowMove: true,
          })
        );
        this.mouseUsed = false;
      } else if (this.mouseUsed && cur === null) {
        // if it was a click, get the cursor from CM
        cancelAfterDOMUpdate(this.pendingTimeout);
        this.pendingTimeout = setAfterDOMUpdate(() =>
          this.props.dispatch(setCursor(editor, editor.codemirror.getCursor()))
        );
        this.mouseUsed = false;
      }
    });
  };

  /**
   * @internal
   * When the CM instance receives a click, give CM 100ms to fire a
   * handleTopLevelFocus event before another one is processed
   */
  private handleTopLevelMouseDown = () => {
    this.mouseUsed = true;
    this.pendingTimeout = setAfterDOMUpdate(
      () => (this.mouseUsed = false),
      100
    );
  };

  /**
   * @internal
   * When the CM instance receives a keypress...start a quarantine if it's
   * not a modifier
   */
  private handleTopLevelKeyPress = (ed: Editor, e: React.KeyboardEvent) => {
    const text = e.key;
    // let CM handle kbd shortcuts or whitespace insertion
    if (e.ctrlKey || e.metaKey || text.match(/\s+/)) return;
    e.preventDefault();
    const start = ed.getCursor(true as $TSFixMe);
    const end = ed.getCursor(false as $TSFixMe);
    this.props.setQuarantine(start, end, text);
  };

  /**
   * @internal
   * When the CM instance receives a paste event...start a quarantine
   */
  private handleTopLevelPaste = (
    editor: CodeMirrorFacade,
    e: ClipboardEvent
  ) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain");
    if (text) {
      const start = editor.codemirror.getCursor(true as $TSFixMe);
      const end = editor.codemirror.getCursor(false as $TSFixMe);
      this.props.setQuarantine(start, end, text);
    }
  };

  /**
   * @internal
   * When the CM instance receives cursor activity...
   * If there are selections, pass null. Otherwise pass the cursor.
   */
  private handleTopLevelCursorActivity = (editor: CodeMirrorFacade) => {
    let cur =
      editor.codemirror.getSelection().length > 0
        ? null
        : editor.codemirror.getCursor();
    this.props.dispatch(setCursor(editor, cur));
  };

  componentWillUnmount() {
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  componentDidMount() {
    const { options, search } = this.props;

    // TODO: pass these with a React Context or something sensible like that.
    SHARED.options = options;
    SHARED.search = search;

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
        SHARED.editor.refresh(); // don't refresh mid-quarantine
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
    const classes = [];
    if (this.props.languageId) {
      classes.push(`blocks-language-${this.props.languageId}`);
    }

    return (
      <>
        <DragAndDropEditor
          options={this.props.codemirrorOptions}
          className={classNames(classes)}
          value={this.props.value}
          onBeforeChange={this.props.onBeforeChange}
          onKeyPress={this.handleTopLevelKeyPress}
          onMouseDown={this.handleTopLevelMouseDown}
          onFocus={this.handleTopLevelFocus}
          onPaste={this.handleTopLevelPaste}
          onKeyDown={(editor, e) => {
            keyDown(e, {
              editor,
              isNodeEnv: false,
              dispatch: this.props.dispatch,
            });
          }}
          onCursorActivity={this.handleTopLevelCursorActivity}
          editorDidMount={this.handleEditorDidMount}
        />
        {this.renderPortals()}
      </>
    );
  }

  private renderPortals = () => {
    const incrementalRendering =
      this.props.options.incrementalRendering ?? false;
    let portals;
    const { editor } = this.state;
    if (editor && this.props.ast) {
      // Render all the top-level nodes
      portals = this.props.ast.rootNodes.map((r) => (
        <EditorContext.Provider value={editor} key={r.id}>
          <ToplevelBlock
            node={r}
            incrementalRendering={incrementalRendering}
            // TODO(pcardune): figure out why passing this.state.cm
            // instead of SHARED.editor breaks tests.
            editor={SHARED.editor}
          />
        </EditorContext.Provider>
      ));
      if (this.props.hasQuarantine) {
        // TODO(pcardune): figure out why passing this.state.cm
        // instead of SHARED.editor breaks tests
        portals.push(<ToplevelBlockEditable editor={SHARED.editor} key="-1" />);
      }
    }
    return portals;
  };
}
export type { BlockEditor };
const ConnectedBlockEditor = blockEditorConnector(BlockEditor);
export type BlockEditorComponentClass = typeof ConnectedBlockEditor;
export default ConnectedBlockEditor;
