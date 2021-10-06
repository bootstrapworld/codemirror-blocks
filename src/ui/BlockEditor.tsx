import React, { Component } from "react";
import ReactDOM from "react-dom";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import classNames from "classnames";
import "./Editor.less";
import { connect, ConnectedProps } from "react-redux";
import SHARED from "../shared";
import NodeEditable from "../components/NodeEditable";
import { activateByNid, setCursor, OverwriteTarget } from "../actions";
import { commitChanges } from "../edits/commitChanges";
import { speculateChanges, getTempCM } from "../edits/speculateChanges";
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
  cm: Editor;
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
    window.requestAnimationFrame(() => {
      const { from, to } = node.srcRange(); // includes the node's comment, if any
      this.props.cm
        .findMarks(from, to)
        .filter((m) => m.BLOCK_NODE_ID)
        .forEach((m) => m.clear());
      this.mark = this.props.cm.markText(from, to, {
        replacedWith: this.container,
      });
      this.mark.BLOCK_NODE_ID = node.id;
      node.mark = this.mark;
    });
    return ReactDOM.createPortal(elt, this.container);
  }
}

const mapStateToProps2 = ({ quarantine }: RootState) => ({ quarantine });
const mapDispatchToProps2 = (dispatch: AppDispatch) => ({
  onDisableEditable: () => dispatch({ type: "DISABLE_QUARANTINE" }),
  onChange: (text: string) => dispatch({ type: "CHANGE_QUARANTINE", text }),
});
type ToplevelBlockEditableCoreProps = {
  quarantine: Quarantine;
  onDisableEditable: () => void;
  onChange: (text: string) => void;
  cm: Editor;
};
class ToplevelBlockEditableCore extends Component<ToplevelBlockEditableCoreProps> {
  container: HTMLElement;
  marker?: CodeMirror.TextMarker;

  constructor(props: ToplevelBlockEditableCoreProps) {
    super(props);
    this.container = document.createElement("span");
    this.container.classList.add("react-container");
  }

  componentWillUnmount() {
    this.marker?.clear();
  }

  render() {
    const { onDisableEditable, onChange, quarantine } = this.props;
    const [start, end, value] = quarantine;
    const props = {
      tabIndex: "-1",
      role: "text box",
      "aria-setsize": "1",
      "aria-posinset": "1",
      "aria-level": "1",
    };

    // IF NO MARKER IS DEFINED, WAIT UNTIL THE REACT RENDER
    // CYCLE IS OVER and make a new block marker
    if (!this.marker)
      window.requestAnimationFrame(() => {
        // CM treats 0-width ranges differently than other ranges, so check
        if (poscmp(start, end) === 0) {
          this.marker = this.props.cm.setBookmark(start, {
            widget: this.container,
          });
        } else {
          this.marker = this.props.cm.markText(start, end, {
            replacedWith: this.container,
          });
        }
      });

    return ReactDOM.createPortal(
      <NodeEditable
        target={new OverwriteTarget(start, end)}
        value={value}
        onChange={onChange}
        contentEditableProps={props}
        isInsertion={true}
        extraClasses={[]}
        onDisableEditable={onDisableEditable}
      />,
      this.container
    );
  }
}

const ToplevelBlockEditable = connect(
  mapStateToProps2,
  mapDispatchToProps2
)(ToplevelBlockEditableCore);

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
  setCM: (cm: CodeMirror.Editor) => void;
};

export type BlockEditorProps = typeof BlockEditor.defaultProps &
  ConnectedProps<typeof blockEditorConnector> & {
    value: string;
    options?: Options;
    cmOptions?: CodeMirror.EditorConfiguration;
    /**
     * id of the language being used
     */
    languageId: string;
    search?: Search;
    onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
    onMount: Function;
    api?: API;
    passedAST?: AST;
    ast: AST;
  };

type BlockEditorState = {
  cm: Editor;
};

class BlockEditor extends Component<BlockEditorProps> {
  mouseUsed: boolean;
  newAST: AST;
  pendingTimeout: afterDOMUpdateHandle;
  state: BlockEditorState = { cm: null };

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
  };

  /**
   * @internal
   * Anything that didn't come from CMB itself must be speculatively
   * checked. NOTE: this only checks the *first change* in a changeset!
   * This is hooked up to CodeMirror's onBeforeChange event
   */
  private handleBeforeChange = (
    cm: Editor,
    change: CodeMirror.EditorChangeCancellable
  ) => {
    if (!change.origin?.startsWith("cmb:")) {
      let { successful, newAST } = speculateChanges(
        [change],
        SHARED.parse,
        this.state.cm
      );
      // Successful! Let's save all the hard work we did to build the new AST
      if (successful) {
        this.newAST = newAST;
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
  private handleChanges = (cm: Editor, changes: CodeMirror.EditorChange[]) => {
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
            const { oldFocusNId } = actionFocus;
            const focusHint = (newAST: AST) => newAST.getNodeByNId(oldFocusNId);
            commitChanges(
              changes,
              SHARED.parse,
              this.state.cm,
              true,
              focusHint,
              this.newAST
            );
            dispatch({ type: "UNDO", cm: this.state.cm });
          }
        } else if (changes[0].origin === "redo") {
          for (let c of changes) c.origin = "cmb:redo";
          const { actionFocus } = getState();
          if (actionFocus) {
            const { newFocusNId } = actionFocus;
            const focusHint = (newAST: AST) => newAST.getNodeByNId(newFocusNId);
            commitChanges(
              changes,
              SHARED.parse,
              this.state.cm,
              true,
              focusHint,
              this.newAST
            );
            dispatch({ type: "REDO", cm: this.state.cm });
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
            changes,
            SHARED.parse,
            this.state.cm,
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
  private handleEditorDidMount = (ed: Editor) => {
    this.setState({ cm: ed });
    const { passedAST: ast, setAST, search, options, onMount } = this.props;
    ed.on("beforeChange", this.handleBeforeChange);
    ed.on("changes", this.handleChanges);

    // set AST and searchg properties and collapse preferences
    setAST(ast);
    search.setCM(ed);
    if (options.collapseAll) {
      this.props.dispatch({ type: "COLLAPSE_ALL" });
    }

    // When the editor receives focus, select the first root (if it exists)
    if (ast.rootNodes.length > 0) {
      this.props.dispatch({ type: "SET_FOCUS", focusId: ast.rootNodes[0].id });
    }
    // Set extra aria attributes
    const wrapper = ed.getWrapperElement();
    wrapper.setAttribute("role", "tree");
    wrapper.setAttribute("aria-multiselectable", "true");
    wrapper.setAttribute("tabIndex", "-1");

    // pass the block-mode CM editor, API, and current AST
    onMount(ed, this.buildAPI(ed), ast);
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
    const ignoreActions = ["SET_ANNOUNCER", "RESET_STORE_FOR_TESTING"];
    if (ignoreActions.includes(activity.type)) {
      return;
    }

    let action: AppAction;
    // SET_AST actions have been serialized to printed code
    // set the value of the editor to that code, reconstruct
    // the action to use the resulting AST, and delete code
    if (activity.type == "SET_AST") {
      this.state.cm.setValue(activity.code);
      const { code, ...toCopy } = activity;
      action = { ...toCopy, ast: this.props.ast };
    }
    // convert nid to node id, and use activate to generate the action
    if (activity.type == "SET_FOCUS") {
      this.props.activateByNid(this.state.cm, activity.nid, {
        allowMove: true,
      });
      return;
    }
    this.props.dispatch(action);
  }

  /**
   * @internal
   * Build the API for a block editor, restricting or modifying APIs
   * that are incompatible with our toggleable block editor
   */
  private buildAPI(ed: Editor): BuiltAPI {
    const withState = <F extends (state: RootState) => any>(func: F) =>
      this.props.dispatch((_, getState) => func(getState()));

    const api: BuiltAPI = {
      /*****************************************************************
       * CM APIs WE WANT TO OVERRIDE
       */
      findMarks: (from, to) =>
        this.state.cm.findMarks(from, to).filter((m) => !m.BLOCK_NODE_ID),
      findMarksAt: (pos) =>
        this.state.cm.findMarksAt(pos).filter((m) => !m.BLOCK_NODE_ID),
      getAllMarks: () =>
        this.state.cm.getAllMarks().filter((m) => !m.BLOCK_NODE_ID),
      markText: (from, to, opts) => this.markText(from, to, opts),
      // Something is selected if CM has a selection OR a block is selected
      somethingSelected: () =>
        withState(({ selections }) =>
          Boolean(this.state.cm.somethingSelected() || selections.length)
        ),
      // CMB has focus if CM has focus OR a block is active
      hasFocus: () =>
        this.state.cm.hasFocus() ||
        Boolean(document.activeElement.id.match(/block-node/)),
      extendSelection: (
        from: CodeMirror.Position,
        to: CodeMirror.Position,
        opts?: SelectionOptions
      ) => this.extendSelections([from], opts, to),
      extendSelections: (heads, opts) => this.extendSelections(heads, opts),
      extendSelectionsBy: (
        f: (range: CodeMirror.Range) => CodeMirror.Position,
        opts?: SelectionOptions
      ) => this.extendSelections(this.listSelections().map(f), opts),
      getSelections: (sep?: string) =>
        this.listSelections().map((s) =>
          this.state.cm.getRange(s.anchor, s.head, sep)
        ),
      getSelection: (sep?: string) =>
        this.listSelections()
          .map((s) => this.state.cm.getRange(s.anchor, s.head, sep))
          .join(sep),
      listSelections: () => this.listSelections(),
      replaceRange: (text, from, to, origin) =>
        withState(({ ast }) => {
          validateRanges([{ anchor: from, head: to }], ast);
          this.state.cm.replaceRange(text, from, to, origin);
        }),
      setSelections: (ranges, primary, opts) =>
        this.setSelections(ranges, primary, opts),
      setSelection: (anchor, head = anchor, opts) =>
        this.setSelections([{ anchor: anchor, head: head }], null, opts),
      addSelection: (anchor, head) =>
        this.setSelections([{ anchor: anchor, head: head }], null, null, false),
      replaceSelections: (rStrings, select?: "around" | "start") =>
        this.replaceSelections(rStrings, select),
      replaceSelection: (rString, select?: "around" | "start") =>
        this.replaceSelections(
          Array(this.listSelections().length).fill(rString),
          select
        ),
      // If a node is active, return the start. Otherwise return the cursor as-is
      getCursor: (where) => this.getCursor(where),
      // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
      setCursor: (curOrLine, ch, options) =>
        withState(({ ast }) => {
          let cur =
            typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
          const node = ast.getNodeContaining(cur);
          if (node) {
            this.props.activateByNid(this.state.cm, node.nid, {
              record: false,
              allowMove: true,
            });
          }
          this.props.dispatch(setCursor(this.state.cm, cur));
        }),
      // As long as widget isn't defined, we're good to go
      setBookmark: (pos, opts) => {
        if (opts.widget) {
          throw new BlockError(
            "setBookmark() with a widget is not supported in Block Mode",
            "API Error"
          );
        }
        return this.state.cm.setBookmark(pos, opts);
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
    from: CodeMirror.Position,
    to: CodeMirror.Position,
    options: CodeMirror.TextMarkerOptions
  ) {
    let node = this.props.ast.getNodeAt(from, to);
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
    let mark = this.state.cm.markText(from, to, options); // keep CM in sync
    const _clear = mark.clear.bind(mark);
    mark.clear = () => {
      _clear();
      this.props.dispatch({ type: "CLEAR_MARK", id: node.id });
    };
    mark.find = () => {
      let { from, to } = this.props.ast.getNodeById(node.id);
      return { from, to };
    };
    mark.options = options;
    this.props.dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
    return mark;
  }

  /**
   * Override CM's native setBookmark method, restricting it to the semantics
   * that make sense in a block editor (no widgets)
   */
  private setBookmark: Editor["setBookmark"] = (pos, options) => {
    if (options.widget) {
      throw new BlockError(
        `setBookmark: option 'widget' is not supported in block mode`,
        `API Error`
      );
    }
    return this.state.cm.setBookmark(pos, options);
  };
  /**
   * Override CM's native getCursor method, restricting it to the semantics
   * that make sense in a block editor
   */
  private getCursor(where = "from") {
    const dispatch = this.props.dispatch;
    const { focusId, ast } = dispatch((_, getState) => getState());
    if (focusId && document.activeElement.id.match(/block-node/)) {
      const node = ast.getNodeById(focusId);
      if (where == "from") return node.from;
      if (where == "to") return node.to;
      else
        throw new BlockError(
          `getCursor() with ${where} is not supported on a focused block`,
          `API Error`
        );
    } else {
      return this.state.cm.getCursor(where);
    }
  }
  /**
   * Override CM's native listSelections method, using the selection
   * state from the block editor
   */
  private listSelections() {
    const dispatch = this.props.dispatch;
    const { selections, ast } = dispatch((_, getState) => getState());
    let tmpCM = getTempCM(this.state.cm);
    // write all the ranges for all selected nodes
    selections.forEach((id) => {
      const node = ast.getNodeById(id);
      tmpCM.addSelection(node.from, node.to);
    });
    // write all the existing selection ranges
    this.state.cm
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
    ranges: Array<{ anchor: CodeMirror.Position; head: CodeMirror.Position }>,
    primary?: number,
    options?: { bias?: number; origin?: string; scroll?: boolean },
    replace = true
  ) {
    const dispatch = this.props.dispatch;
    const { ast } = dispatch((_, getState) => getState());
    let tmpCM = getTempCM(this.state.cm);
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
      if (replace) this.state.cm.setSelections(textRanges, primary, options);
      else this.state.cm.addSelection(textRanges[0].anchor, textRanges[0].head);
    }
    dispatch({ type: "SET_SELECTIONS", selections: nodes });
  }
  /**
   * Override CM's native extendSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  private extendSelections(
    heads: CodeMirror.Position[],
    opts: SelectionOptions,
    to?: CodeMirror.Position
  ) {
    let tmpCM: CodeMirror.Editor = getTempCM(this.state.cm);
    tmpCM.setSelections(this.listSelections());
    if (to) {
      tmpCM.extendSelections(heads, opts);
    } else {
      tmpCM.extendSelection(heads[0], to, opts);
    }
    // if one of the ranges is invalid, setSelections will raise an error
    this.setSelections(tmpCM.listSelections(), null, opts);
  }
  /**
   * Override CM's native replaceSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  private replaceSelections(
    replacements: string[],
    select?: "around" | "start"
  ) {
    let tmpCM: CodeMirror.Editor = getTempCM(this.state.cm);
    tmpCM.setSelections(this.listSelections());
    tmpCM.replaceSelections(replacements, select);
    this.state.cm.setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if (select == "around") {
      this.setSelections(tmpCM.listSelections());
    }
    if (select == "start") {
      this.props.dispatch(
        setCursor(this.state.cm, tmpCM.listSelections().pop().head)
      );
    } else {
      this.props.dispatch(
        setCursor(this.state.cm, tmpCM.listSelections().pop().anchor)
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
  private handleTopLevelFocus = (ed: Editor) => {
    const { dispatch } = this.props;
    dispatch((_, getState) => {
      const { cur } = getState();
      if (!this.mouseUsed && cur === null) {
        // NOTE(Emmanuel): setAfterDOMUpdate so that the CM cursor will not blink
        cancelAfterDOMUpdate(this.pendingTimeout);
        this.pendingTimeout = setAfterDOMUpdate(() =>
          this.props.activateByNid(this.state.cm, null, { allowMove: true })
        );
        this.mouseUsed = false;
      } else if (this.mouseUsed && cur === null) {
        // if it was a click, get the cursor from CM
        cancelAfterDOMUpdate(this.pendingTimeout);
        this.pendingTimeout = setAfterDOMUpdate(() =>
          this.props.dispatch(setCursor(this.state.cm, ed.getCursor()))
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
    const start = this.state.cm.getCursor(true as $TSFixMe);
    const end = this.state.cm.getCursor(false as $TSFixMe);
    this.props.setQuarantine(start, end, text);
  };

  /**
   * @internal
   * When the CM instance receives a paste event...start a quarantine
   */
  private handleTopLevelPaste = (ed: Editor, e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const start = this.state.cm.getCursor(true as $TSFixMe);
    const end = this.state.cm.getCursor(false as $TSFixMe);
    this.props.setQuarantine(start, end, text);
  };

  /**
   * @internal
   * When the CM instance receives cursor activity...
   * If there are selections, pass null. Otherwise pass the cursor.
   */
  private handleTopLevelCursorActivity = (ed: Editor) => {
    let cur = ed.getSelection().length > 0 ? null : ed.getCursor();
    this.props.dispatch(setCursor(this.state.cm, cur));
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
        SHARED.cm.refresh(); // don't refresh mid-quarantine
      }
    });
  }

  render() {
    const classes = [];
    if (this.props.languageId) {
      classes.push(`blocks-language-${this.props.languageId}`);
    }

    return (
      <>
        <DragAndDropEditor
          options={this.props.cmOptions}
          className={classNames(classes)}
          value={this.props.value}
          onBeforeChange={this.props.onBeforeChange}
          onKeyPress={this.handleTopLevelKeyPress}
          onMouseDown={this.handleTopLevelMouseDown}
          onFocus={this.handleTopLevelFocus}
          onPaste={this.handleTopLevelPaste}
          onKeyDown={(_, e) =>
            keyDown(e, {
              cm: this.state.cm,
              isNodeEnv: false,
              dispatch: this.props.dispatch,
            })
          }
          onCursorActivity={this.handleTopLevelCursorActivity}
          editorDidMount={this.handleEditorDidMount}
        />
        {this.renderPortals()}
      </>
    );
  }

  private renderPortals = () => {
    const incrementalRendering = this.props.options.incrementalRendering;
    let portals;
    if (this.state.cm && this.props.ast) {
      // Render all the top-level nodes
      portals = this.props.ast.rootNodes.map((r) => (
        <ToplevelBlock
          key={r.id}
          node={r}
          incrementalRendering={incrementalRendering}
          // TODO(pcardune): figure out why passing this.state.cm
          // instead of SHARED.cm breaks tests.
          cm={SHARED.cm}
        />
      ));
      if (this.props.hasQuarantine) {
        // TODO(pcardune): figure out why passing this.state.cm
        // instead of SHARED.cm breaks tests
        portals.push(<ToplevelBlockEditable cm={SHARED.cm} key="-1" />);
      }
    }
    return portals;
  };
}
export type { BlockEditor };
const ConnectedBlockEditor = blockEditorConnector(BlockEditor);
export type BlockEditorComponentClass = typeof ConnectedBlockEditor;
export default ConnectedBlockEditor;
