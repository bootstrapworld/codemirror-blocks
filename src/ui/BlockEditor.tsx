import React, { Component, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import classNames from "classnames";
import "./Editor.less";
import { connect, ConnectedProps } from "react-redux";
import { useDispatch, useSelector } from "react-redux";
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
import { defaultKeyMap, keyDown } from "../keymap";
import { AppStore, store } from "../store";
import { ASTNode, Pos } from "../ast";
import type { AST } from "../ast";
import CodeMirror, { Editor, SelectionOptions } from "codemirror";
import type { Options, API } from "../CodeMirrorBlocks";
import type { AppDispatch } from "../store";
import Toolbar from "./Toolbar";
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
      SHARED.cm
        .findMarks(from, to)
        .filter((m) => m.BLOCK_NODE_ID)
        .forEach((m) => m.clear());
      this.mark = SHARED.cm.markText(from, to, {
        replacedWith: this.container,
      });
      this.mark.BLOCK_NODE_ID = node.id;
      node.mark = this.mark;
    });
    return ReactDOM.createPortal(elt, this.container);
  }
}

const ToplevelBlockEditable = () => {
  const dispatch: AppDispatch = useDispatch();
  const onDisableEditable = () => dispatch({ type: "DISABLE_QUARANTINE" });
  const onChange = (text: string) =>
    dispatch({ type: "CHANGE_QUARANTINE", text });
  const [start, end, value] = useSelector(
    ({ quarantine }: RootState) => quarantine
  );

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
  let marker: CodeMirror.TextMarker;
  const container = document.createElement("span");
  container.classList.add("react-container");

  // IF NO MARKER IS DEFINED, WAIT UNTIL THE REACT RENDER
  // CYCLE IS OVER and make a new block marker
  if (!marker)
    window.requestAnimationFrame(() => {
      // CM treats 0-width ranges differently than other ranges, so check
      if (poscmp(start, end) === 0) {
        marker = SHARED.cm.setBookmark(start, {
          widget: container,
        });
      } else {
        marker = SHARED.cm.markText(start, end, {
          replacedWith: container,
        });
      }
    });

  return ReactDOM.createPortal(
    <NodeEditable
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

export type BlockEditorProps = {
  value: string;
  options?: Options;
  cmOptions?: CodeMirror.EditorConfiguration;
  keyMap?: { [index: string]: string };
  /**
   * id of the language being used
   */
  languageId: string;
  search?: Search;
  toolbarRef?: React.RefObject<HTMLInputElement>;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: Function;
  api?: API;
  passedAST?: AST; // not used?
  showDialog: Function;
};

const BlockEditor = (props: BlockEditorProps) => {
  const mounted = useRef(); // from https://stackoverflow.com/a/53406363/12026982
  const dispatch: AppDispatch = useDispatch();
  // grab some properties from state
  const { ast, cur, hasQuarantine } = useSelector((state: RootState) => {
    console.log("@@@@@@@@@@@@@@@@", state);
    return {
      ast: state.ast,
      cur: state.cur,
      hasQuarantine: !!state.quarantine,
    };
  });
  // NOTE(Emmanuel): this was in matchDispatchToProps, but appears unused
  const clearFocus = () => dispatch({ type: "SET_FOCUS", focusId: null });

  const {
    options,
    keyMap = defaultKeyMap,
    search = {
      search: () => null,
      onSearch: () => {},
      setCursor: () => {},
      setCM: () => {},
    } as Search,
  } = props;

  let mouseUsed: boolean = false;
  let newAST: AST = null;
  let pendingTimeout: afterDOMUpdateHandle;

  useEffect(() => {
    if (!mounted.current) {
      // Initial mount: create a buffer for use with copy/cut/paste
      const clipboardBuffer = document.createElement("textarea");
      (clipboardBuffer as $TSFixMe).ariaHidden = true;
      clipboardBuffer.tabIndex = -1;
      clipboardBuffer.style.opacity = "0";
      clipboardBuffer.style.height = "1px";
      document.body.appendChild(SHARED.buffer);

      // TODO (Emmanuel): pass SHARED fields below inside a React
      // Context, instead of storing them in a junk drawer
      SHARED.options = options;
      SHARED.search = search;
      SHARED.buffer = clipboardBuffer;
    }
    // refresh() after component is mounted or updated
    pendingTimeout = setAfterDOMUpdate(refreshCM() as $TSFixMe);

    // return our cleanup function
    return () => {
      SHARED.buffer.remove();
      cancelAfterDOMUpdate(pendingTimeout);
    };
  }, []);

  // NOTE(Emmanuel): we shouldn't have to dispatch this in the constructor
  // just for tests to pass! Figure out how to reset the store manually
  dispatch({ type: "RESET_STORE_FOR_TESTING" });

  /**
   * @internal
   * Anything that didn't come from CMB itself must be speculatively
   * checked. NOTE: this only checks the *first change* in a changeset!
   * This is hooked up to CodeMirror's onBeforeChange event
   */
  const handleBeforeChange = (
    cm: Editor,
    change: CodeMirror.EditorChangeCancellable
  ) => {
    if (!change.origin?.startsWith("cmb:")) {
      let { successful, newAST: nextAST } = speculateChanges(
        [change],
        SHARED.parse
      );
      // Successful! Let's save all the hard work we did to build the new AST
      if (successful) {
        newAST = nextAST;
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
  const handleChanges = (cm: Editor, changes: CodeMirror.EditorChange[]) => {
    dispatch((dispatch, getState) => {
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
            commitChanges(changes, SHARED.parse, true, focusHint, newAST);
            dispatch({ type: "UNDO" });
          }
        } else if (changes[0].origin === "redo") {
          for (let c of changes) c.origin = "cmb:redo";
          const { actionFocus } = getState();
          if (actionFocus) {
            const { newFocusNId } = actionFocus;
            const focusHint = (newAST: AST) => newAST.getNodeByNId(newFocusNId);
            commitChanges(changes, SHARED.parse, true, focusHint, newAST);
            dispatch({ type: "REDO" });
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
          commitChanges(changes, SHARED.parse, false, -1, newAST);
        }
      }
    });
  };

  /**
   * @internal
   * When the editor mounts, (1) set change event handlers and AST,
   * (2) set the focus, (3) set aria attributes, and (4) build the API
   */
  const handleEditorDidMount = (ed: Editor) => {
    ed.on("beforeChange", handleBeforeChange);
    ed.on("changes", handleChanges);

    // set AST and searchg properties and collapse preferences
    dispatch({ type: "SET_AST", ast });
    search.setCM(ed);
    if (options.collapseAll) {
      dispatch({ type: "COLLAPSE_ALL" });
    }

    // When the editor receives focus, select the first root (if it exists)
    if (ast.rootNodes.length > 0) {
      dispatch({ type: "SET_FOCUS", focusId: ast.rootNodes[0].id });
    }
    // Set extra aria attributes
    const wrapper = ed.getWrapperElement();
    wrapper.setAttribute("role", "tree");
    wrapper.setAttribute("aria-multiselectable", "true");
    wrapper.setAttribute("tabIndex", "-1");

    // pass the block-mode CM editor, API, and current AST
    props.onMount(ed, buildAPI(ed), ast);
  };

  /**
   * @internal
   * Used for reproducing/debugging (see ToggleEditor::loadLoggedActions)
   * Filter/Tweak logged history actions before dispatching them to
   * be executed.
   */
  const executeAction = (activity: Activity) => {
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
      SHARED.cm.setValue(activity.code);
      const { code, ...toCopy } = activity;
      action = { ...toCopy, ast: ast };
    }
    // convert nid to node id, and use activate to generate the action
    if (activity.type == "SET_FOCUS") {
      dispatch(activateByNid(activity.nid, { allowMove: true }));
      return;
    }
    dispatch(action);
  };

  /**
   * @internal
   * Build the API for a block editor, restricting or modifying APIs
   * that are incompatible with our toggleable block editor
   */
  const buildAPI = (ed: Editor): BuiltAPI => {
    const withState = <F extends (state: RootState) => any>(func: F) =>
      dispatch((_, getState) => func(getState()));

    // let withState = (func:(state: RootState)=>any) => this.props.dispatch((_, getState) => func(getState()));
    const cm = SHARED.cm;
    const api: BuiltAPI = {
      /*****************************************************************
       * CM APIs WE WANT TO OVERRIDE
       */
      findMarks: (from, to) =>
        SHARED.cm.findMarks(from, to).filter((m) => !m.BLOCK_NODE_ID),
      findMarksAt: (pos) =>
        SHARED.cm.findMarksAt(pos).filter((m) => !m.BLOCK_NODE_ID),
      getAllMarks: () =>
        SHARED.cm.getAllMarks().filter((m) => !m.BLOCK_NODE_ID),
      markText: (from, to, opts) => markText(from, to, opts),
      // Something is selected if CM has a selection OR a block is selected
      somethingSelected: () =>
        withState(({ selections }) =>
          Boolean(SHARED.cm.somethingSelected() || selections.length)
        ),
      // CMB has focus if CM has focus OR a block is active
      hasFocus: () =>
        cm.hasFocus() || Boolean(document.activeElement.id.match(/block-node/)),
      extendSelection: (
        from: CodeMirror.Position,
        to: CodeMirror.Position,
        opts?: SelectionOptions
      ) => extendSelections([from], opts, to),
      extendSelections: (heads, opts) => extendSelections(heads, opts),
      extendSelectionsBy: (
        f: (range: CodeMirror.Range) => CodeMirror.Position,
        opts?: SelectionOptions
      ) => extendSelections(listSelections().map(f), opts),
      getSelections: (sep?: string) =>
        listSelections().map((s) => SHARED.cm.getRange(s.anchor, s.head, sep)),
      getSelection: (sep?: string) =>
        listSelections()
          .map((s) => SHARED.cm.getRange(s.anchor, s.head, sep))
          .join(sep),
      listSelections: () => listSelections(),
      replaceRange: (text, from, to, origin) =>
        withState(({ ast }) => {
          validateRanges([{ anchor: from, head: to }], ast);
          SHARED.cm.replaceRange(text, from, to, origin);
        }),
      setSelections: (ranges, primary, opts) =>
        setSelections(ranges, primary, opts),
      setSelection: (anchor, head = anchor, opts) =>
        setSelections([{ anchor: anchor, head: head }], null, opts),
      addSelection: (anchor, head) =>
        setSelections([{ anchor: anchor, head: head }], null, null, false),
      replaceSelections: (rStrings, select?: "around" | "start") =>
        replaceSelections(rStrings, select),
      replaceSelection: (rString, select?: "around" | "start") =>
        replaceSelections(Array(listSelections().length).fill(rString), select),
      // If a node is active, return the start. Otherwise return the cursor as-is
      getCursor: (where) => getCursor(where),
      // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
      setCursor: (curOrLine, ch, options) =>
        withState(({ ast }) => {
          let cur =
            typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
          const node = ast.getNodeContaining(cur);
          if (node) {
            dispatch(
              activateByNid(node.nid, {
                record: false,
                allowMove: true,
              })
            );
          }
          dispatch({ type: "SET_CURSOR", cur: cur });
        }),
      // As long as widget isn't defined, we're good to go
      setBookmark: (pos, opts) => {
        if (opts.widget) {
          throw new BlockError(
            "setBookmark() with a widget is not supported in Block Mode",
            "API Error"
          );
        }
        return SHARED.cm.setBookmark(pos, opts);
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
        dispatch({ type: "SET_QUARANTINE", start, end, text }),
      executeAction: (action) => executeAction(action),
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

  /**
   * Override CM's native markText method, restricting it to the semantics
   * that make sense in a block editor (fewer options, restricted to node
   * boundaries)
   */
  const markText = (
    from: CodeMirror.Position,
    to: CodeMirror.Position,
    options: CodeMirror.TextMarkerOptions
  ) => {
    let node = ast.getNodeAt(from, to);
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
    let mark = SHARED.cm.markText(from, to, options); // keep CM in sync
    const _clear = mark.clear.bind(mark);
    mark.clear = () => {
      _clear();
      dispatch({ type: "CLEAR_MARK", id: node.id });
    };
    mark.find = () => {
      let { from, to } = ast.getNodeById(node.id);
      return { from, to };
    };
    mark.options = options;
    dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
    return mark;
  };

  /**
   * Override CM's native setBookmark method, restricting it to the semantics
   * that make sense in a block editor (no widgets)
   */
  const setBookmark: Editor["setBookmark"] = (pos, options) => {
    if (options.widget) {
      throw new BlockError(
        `setBookmark: option 'widget' is not supported in block mode`,
        `API Error`
      );
    }
    return SHARED.cm.setBookmark(pos, options);
  };
  /**
   * Override CM's native getCursor method, restricting it to the semantics
   * that make sense in a block editor
   */
  const getCursor = (where = "from") => {
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
      return SHARED.cm.getCursor(where);
    }
  };
  /**
   * Override CM's native listSelections method, using the selection
   * state from the block editor
   */
  const listSelections = () => {
    const { selections, ast } = dispatch((_, getState) => getState());
    let tmpCM = getTempCM();
    // write all the ranges for all selected nodes
    selections.forEach((id: string) => {
      const node = ast.getNodeById(id);
      tmpCM.addSelection(node.from, node.to);
    });
    // write all the existing selection ranges
    SHARED.cm.listSelections().map((s) => tmpCM.addSelection(s.anchor, s.head));
    // return all the selections
    return tmpCM.listSelections();
  };
  /**
   * Override CM's native setSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  const setSelections = (
    ranges: Array<{ anchor: CodeMirror.Position; head: CodeMirror.Position }>,
    primary?: number,
    options?: { bias?: number; origin?: string; scroll?: boolean },
    replace = true
  ) => {
    const { ast } = dispatch((_, getState) => getState());
    let tmpCM = getTempCM();
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
      if (replace) SHARED.cm.setSelections(textRanges, primary, options);
      else SHARED.cm.addSelection(textRanges[0].anchor, textRanges[0].head);
    }
    dispatch({ type: "SET_SELECTIONS", selections: nodes });
  };
  /**
   * Override CM's native extendSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  const extendSelections = (
    heads: CodeMirror.Position[],
    opts: SelectionOptions,
    to?: CodeMirror.Position
  ) => {
    let tmpCM: CodeMirror.Editor = getTempCM();
    tmpCM.setSelections(listSelections());
    if (to) {
      tmpCM.extendSelections(heads, opts);
    } else {
      tmpCM.extendSelection(heads[0], to, opts);
    }
    // if one of the ranges is invalid, setSelections will raise an error
    setSelections(tmpCM.listSelections(), null, opts);
  };
  /**
   * Override CM's native replaceSelections method, restricting it to the semantics
   * that make sense in a block editor (must include only valid node ranges)
   */
  const replaceSelections = (
    replacements: string[],
    select?: "around" | "start"
  ) => {
    let tmpCM: CodeMirror.Editor = getTempCM();
    tmpCM.setSelections(listSelections());
    tmpCM.replaceSelections(replacements, select);
    SHARED.cm.setValue(tmpCM.getValue());
    // if one of the ranges is invalid, setSelections will raise an error
    if (select == "around") {
      setSelections(tmpCM.listSelections());
    }
    if (select == "start") {
      dispatch({ type: "SET_CURSOR", cur: tmpCM.listSelections().pop().head });
    } else {
      dispatch({
        type: "SET_CURSOR",
        cur: tmpCM.listSelections().pop().anchor,
      });
    }
  };

  /**
   * @internal
   * Remove change handlers
   */
  const handleEditorWillUnmount = (ed: Editor) => {
    ed.off("beforeChange", handleBeforeChange);
    ed.off("changes", handleChanges);
  };

  /**
   * @internal
   * When the CM instance receives focus...
   * If the mouse wasn't used and there's no cursor set, focus on the first root
   * If the mouse WAS used there's no cursor set, get the cursor from CM
   * Otherwise ignore
   */
  const handleTopLevelFocus = (ed: Editor) => {
    dispatch((_, getState) => {
      const { cur } = getState();
      if (!mouseUsed && cur === null) {
        // NOTE(Emmanuel): setAfterDOMUpdate so that the CM cursor will not blink
        cancelAfterDOMUpdate(pendingTimeout);
        pendingTimeout = setAfterDOMUpdate(() =>
          dispatch(activateByNid(null, { allowMove: true }))
        );
        mouseUsed = false;
      } else if (mouseUsed && cur === null) {
        // if it was a click, get the cursor from CM
        cancelAfterDOMUpdate(pendingTimeout);
        pendingTimeout = setAfterDOMUpdate(() =>
          dispatch({ type: "SET_CURSOR", cur: ed.getCursor() })
        );
        mouseUsed = false;
      }
    });
  };

  /**
   * @internal
   * When the CM instance receives a click, give CM 100ms to fire a
   * handleTopLevelFocus event before another one is processed
   */
  const handleTopLevelMouseDown = () => {
    mouseUsed = true;
    pendingTimeout = setAfterDOMUpdate(() => (mouseUsed = false), 100);
  };

  /**
   * @internal
   * When the CM instance receives a keypress...start a quarantine if it's
   * not a modifier
   */
  const handleTopLevelKeyPress = (ed: Editor, e: React.KeyboardEvent) => {
    const text = e.key;
    // let CM handle kbd shortcuts or whitespace insertion
    if (e.ctrlKey || e.metaKey || text.match(/\s+/)) return;
    e.preventDefault();
    const start = SHARED.cm.getCursor(true as $TSFixMe);
    const end = SHARED.cm.getCursor(false as $TSFixMe);
    dispatch({ type: "SET_QUARANTINE", start, end, text });
  };

  /**
   * @internal
   * When the CM instance receives a keydown event...construct the environment
   * NOTE: This is called from both CM *and* Node components. Each is responsible
   * for passing 'this' as the environment. Be sure to add showDialog and toolbarRef!
   */
  const handleKeyDown: AppStore["onKeyDown"] = (e, env) => {
    env.showDialog = props.showDialog;
    env.toolbarRef = props.toolbarRef;
    return keyDown(e, env, keyMap);
  };
  // stick the keyDown handler in the store
  store.onKeyDown = handleKeyDown;

  /**
   * @internal
   * When the CM instance receives a paste event...start a quarantine
   */
  const handleTopLevelPaste = (ed: Editor, e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const start = SHARED.cm.getCursor(true as $TSFixMe);
    const end = SHARED.cm.getCursor(false as $TSFixMe);
    dispatch({ type: "SET_QUARANTINE", start, end, text });
  };

  /**
   * @internal
   * When the CM instance receives cursor activity...
   * If there are selections, pass null. Otherwise pass the cursor.
   */
  const handleTopLevelCursorActivity = (ed: Editor) => {
    let cur = ed.getSelection().length > 0 ? null : ed.getCursor();
    dispatch({ type: "SET_CURSOR", cur: cur });
  };

  /**
   * @internal
   * As long as there's no quarantine, refresh the editor to compute
   * possibly-changed node sizes
   */
  const refreshCM = () => {
    dispatch((_, getState) => {
      if (!getState().quarantine) SHARED.cm.refresh(); // don't refresh mid-quarantine
    });
  };

  const renderPortals = () => {
    const incrementalRendering = options.incrementalRendering;
    let portals;
    if (SHARED.cm && ast) {
      // Render all the top-level nodes
      portals = ast.rootNodes.map((r: ASTNode) => (
        <ToplevelBlock
          key={r.id}
          node={r}
          incrementalRendering={incrementalRendering}
        />
      ));
      if (hasQuarantine) portals.push(<ToplevelBlockEditable key="-1" />);
    }
    return portals;
  };

  const classes = [];
  if (props.languageId) {
    classes.push(`blocks-language-${props.languageId}`);
  }
  return (
    <>
      <DragAndDropEditor
        options={props.cmOptions}
        className={classNames(classes)}
        value={props.value}
        onBeforeChange={props.onBeforeChange}
        onKeyPress={handleTopLevelKeyPress}
        onMouseDown={handleTopLevelMouseDown}
        onFocus={handleTopLevelFocus}
        onPaste={handleTopLevelPaste}
        onKeyDown={(_, e) => handleKeyDown(e, this)}
        onCursorActivity={handleTopLevelCursorActivity}
        editorDidMount={handleEditorDidMount}
      />
      {renderPortals()}
    </>
  );
};

export default BlockEditor;
