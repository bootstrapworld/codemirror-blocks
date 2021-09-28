import React, { Component, createRef, ReactElement } from "react";
import BlockEditor from "./BlockEditor";
import TextEditor from "./TextEditor";
import CMBContext from "../components/Context";
import Dialog from "../components/Dialog";
import ByString from "./searchers/ByString";
import ByBlock from "./searchers/ByBlock";
import attachSearch from "./Search";
import Toolbar from "./Toolbar";
import { ToggleButton, BugButton } from "./EditorButtons";
import { mountAnnouncer, say } from "../announcer";
import TrashCan from "./TrashCan";
import SHARED from "../shared";
import type { AST } from "../ast";
import type { Language, Options } from "../CodeMirrorBlocks";
import CodeMirror, { MarkerRange, Position, TextMarker } from "codemirror";
import type { ActionFocus } from "../reducers";
import { setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";
import type { afterDOMUpdateHandle } from "../utils";

/**
 * Additional declarations of codemirror apis that are not in @types/codemirror... yet.
 * TODO(pcardune): open a pull request on this file to add these changes:
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/codemirror/index.d.ts
 */
declare module "codemirror" {
  interface SelectionOptions {
    bias?: number;
    origin?: string;
    scroll?: boolean;
  }
  interface DocOrEditor {
    /**
     * Adds a new selection to the existing set of selections, and makes it the primary selection.
     */
    addSelection(anchor: CodeMirror.Position, head?: CodeMirror.Position): void;

    /**
     * Similar to setSelection , but will, if shift is held or the extending flag is set,
     * move the head of the selection while leaving the anchor at its current place.
     * pos2 is optional , and can be passed to ensure a region (for example a word or paragraph) will end up selected
     * (in addition to whatever lies between that region and the current anchor).
     */
    extendSelection(
      from: CodeMirror.Position,
      to?: CodeMirror.Position,
      options?: SelectionOptions
    ): void;

    /**
     * An equivalent of extendSelection that acts on all selections at once.
     */
    extendSelections(
      heads: CodeMirror.Position[],
      options?: SelectionOptions
    ): void;

    /**
     * Applies the given function to all existing selections, and calls extendSelections on the result.
     */
    extendSelectionsBy(
      f: (range: CodeMirror.Range) => CodeMirror.Position
    ): void;

    /**
     * Get the value of the 'extending' flag.
     */
    getExtending(): boolean;

    /**
     * Undo one edit or selection change.
     */
    undoSelection(): void;

    /**
     * Redo one undone edit or selection change.
     */
    redoSelection(): void;

    /**
     * This method can be used to implement search/replace functionality.
     *  `query`: This can be a regular * expression or a string (only strings will match across lines -
     *          if they contain newlines).
     *  `start`: This provides the starting position of the search. It can be a `{line, ch} object,
     *          or can be left off to default to the start of the document
     *  `options`: options is an optional object, which can contain the property `caseFold: false`
     *          to disable case folding when matching a string, or the property `multiline: disable`
     *          to disable multi-line matching for regular expressions (which may help performance)
     */
    getSearchCursor(
      query: string | RegExp,
      start?: CodeMirror.Position,
      options?: { caseFold?: boolean; multiline?: boolean }
    ): SearchCursor;
  }

  interface Editor {
    /**
     * Allow the given string to be translated with the phrases option.
     */
    phrase(text: string): string;
  }
}

/**
 * Extensions to the codemirror API that are internal to CMB or
 * not documented in the codemirror docs.
 */
declare module "codemirror" {
  /**
   * Get a human readable name for a given keyboard event key.
   *
   * @deprecated This appears in src/edit/legacy.js of the codemirror source, so
   * presumably that means it's deprecated. See
   * https://github.com/codemirror/CodeMirror/blob/49a7fc497c85e5b51801b3f439f4bb126e3f226b/src/edit/legacy.js#L47
   * @param event the keyboard event from which to calculate a human readable name
   */
  function keyName(event: KeyboardEvent | React.KeyboardEvent): string;

  interface DocOrEditor {
    /**
     * Get a (JSON - serializeable) representation of the undo history.
     *
     * @types/codemirror-blocks uses any as the return type. The codemirror docs
     * do not say anything about the return type, but through our own testing,
     * it appears to be the following.
     */
    getHistory(): { done: HistoryItem[]; undone: HistoryItem[] };
  }

  /**
   * The codemirror documentation does not specify the interface of objects
   * used to track edit history. But we monkey patch those objects anyway
   * to keep track of additional information.
   */
  interface HistoryItem {
    /**
     * This is set by codemirror on certain history items but not on others.
     * We only monkey patch the history items that *do not* contain this property.
     */
    ranges?: CodeMirror.Range[];

    /**
     * The below are custom additions we make to certain history items.
     * These are applied in the reducer.
     */
    undoableAction?: string;
    actionFocus?: ActionFocus | false;
  }

  interface TextMarker {
    /**
     * Specifies the type of text marker, either one made with markText,
     * or one made with setBookmark. Ones made with setBookmark have
     * type == "bookmark". This property is not documented in the codemirror
     * docs.
     */
    type: string;

    /**
     * Specified the options that were used when the marker was created.
     * This property is not documented in the codemirror docs but apparently
     * works.
     */
    options: CodeMirror.TextMarkerOptions;

    /**
     * Stores the ast node id associated with this text marker.
     */
    BLOCK_NODE_ID?: string;
  }
}

const UpgradedBlockEditor = attachSearch(BlockEditor, [ByString, ByBlock]);

const defaultCmOptions: CodeMirror.EditorConfiguration = {
  lineNumbers: true,
  viewportMargin: 10,
  extraKeys: { "Shift-Tab": false },
};

// This is the complete list of methods exposed by the CodeMirror object
// SOME of them we override, but many can be exposed directly
// See buildAPI() in the ToggleEditor component
const codeMirrorAPI = [
  "getValue",
  "setValue",
  "getRange",
  "replaceRange",
  "getLine",
  "lineCount",
  "firstLine",
  "lastLine",
  "getLineHandle",
  "getLineNumber",
  "eachLine",
  "markClean",
  "changeGeneration",
  "isClean",
  "getSelection",
  "getSelections",
  "replaceSelection",
  "replaceSelections",
  "getCursor",
  "listSelections",
  "somethingSelected",
  "setCursor",
  "setSelection",
  "setSelections",
  "addSelection",
  "extendSelection",
  "extendSelections",
  "extendSelectionsBy",
  "setExtending",
  "getExtending",
  "hasFocus",
  "findPosH",
  "findPosV",
  "findWordAt",
  "setOption",
  "getOption",
  "addKeyMap",
  "removeKeyMap",
  "addOverlay",
  "removeOverlay",
  "on",
  "off",
  "undo",
  "redo",
  "undoSelection",
  "redoSelection",
  "historySize",
  "clearHistory",
  "getHistory",
  "setHistory",
  "markText",
  "setBookmark",
  "findMarks",
  "findMarksAt",
  "getAllMarks",
  "setGutterMarker",
  "clearGutter",
  "addLineClass",
  "removeLineClass",
  "lineInfo",
  "addWidget",
  "addLineWidget",
  "setSize",
  "scrollTo",
  "getScrollInfo",
  "scrollIntoView",
  "cursorCoords",
  "charCoords",
  "coordsChar",
  "lineAtHeight",
  "heightAtLine",
  "defaultTextHeight",
  "defaultCharWidth",
  "getViewport",
  "refresh",
  "operation",
  "startOperation",
  "endOperation",
  "indentLine",
  "toggleOverwrite",
  "isReadOnly",
  "lineSeparator",
  "execCommand",
  "posFromIndex",
  "indexFromPos",
  "focus",
  "phrase",
  "getInputField",
  "getWrapperElement",
  "getScrollerElement",
  "getGutterElement",
] as const;

type CodeMirrorAPI = Pick<CodeMirror.Editor, typeof codeMirrorAPI[number]>;

type ToggleEditorAPI = {
  getBlockMode(): boolean;
  setBlockMode(blockMode: boolean): void;
  getCM(): CodeMirror.Editor;
  on: CodeMirror.Editor["on"];
  off: CodeMirror.Editor["off"];
  runMode(): never;
};

function isTextMarkerRange(
  marker: TextMarker<MarkerRange | Position>
): marker is TextMarker<MarkerRange> {
  return marker.type != "bookmark";
}

import type { BuiltAPI as BlockEditorAPIExtensions } from "./BlockEditor";
export type API = ToggleEditorAPI & CodeMirrorAPI & BlockEditorAPIExtensions;

export type ToggleEditorProps = {
  initialCode?: string;
  cmOptions?: CodeMirror.EditorConfiguration;
  language: Language;
  options?: Options;
  api?: API;
  appElement: HTMLElement;
  debuggingLog?: {
    history?: unknown;
  };
};

type ToggleEditorState = {
  blockMode: boolean;
  code: string;
  dialog: null | { title: string; content: ReactElement };
  debuggingLog?: ToggleEditorProps["debuggingLog"];
};

// TODO(pcardune): make this use an actual context? Or maybe redux state?
export const KeyDownContext = {
  /**
   * @internal
   * Dialog showing/hiding methods deal with ToggleEditor state.
   * We pass them to mode-specific components, to allow those
   * components to show/hide dialogs
   *
   * This is hooked up when ToggleEditor gets mounted
   */
  showDialog: (contents: ToggleEditorState["dialog"]) => {
    console.warn(`ToggleEditor has not been mounted yet. Can't show dialog`);
  },
};

class ToggleEditor extends Component<ToggleEditorProps, ToggleEditorState> {
  state: ToggleEditorState = {
    blockMode: false,
    dialog: null,
    code: "",
  };

  pendingTimeout?: afterDOMUpdateHandle;

  static defaultProps = {
    debuggingLog: {},
    cmOptions: {},
    code: "",
  };

  cmOptions: CodeMirror.EditorConfiguration;
  options: Options;
  eventHandlers: Record<string, Function[]>;
  toolbarRef: React.RefObject<HTMLInputElement> = createRef();
  ast?: AST;
  newAST?: AST;

  private recordedMarks: Map<
    number,
    {
      from: CodeMirror.Position;
      to: CodeMirror.Position;
      options: CodeMirror.TextMarkerOptions;
    }
  > = new Map();

  constructor(props: ToggleEditorProps) {
    super(props);

    SHARED.parse = this.props.language.parse;

    this.eventHandlers = {}; // blank event-handler record

    this.state.code = props.initialCode;

    KeyDownContext.showDialog = (contents: ToggleEditorState["dialog"]) =>
      this.setState(() => ({ dialog: contents }));
  }

  /**
   * @internal
   * Imports a json log of interactions and sets appropriate state
   * used for debugging and isolating cases
   */
  loadLoggedActions = (jsonLog: {
    startingSource: string;
    history?: unknown;
  }) => {
    console.log("log is", jsonLog);
    this.setState({ debuggingLog: jsonLog });
    this.props.api?.setValue(jsonLog.startingSource);
  };

  /**
   * @internal
   * Populate a base object with mode-agnostic methods we wish to expose
   */
  buildAPI(ed: CodeMirror.Editor): API {
    const base: any = {};
    // any CodeMirror function that we can call directly should be passed-through.
    // TextEditor and BlockEditor can add their own, or override them
    codeMirrorAPI.forEach((funcName) => {
      // Some functions that we want to proxy (like phrase) are not on the codemirror
      // editor object when this code executes, so we have to do the lookup inside the
      // wrapper function. Hopefully by the time the wrapper function is called,
      // the function it proxies to has been added to the editor instance.
      base[funcName] = (...args: any[]) => (ed as any)[funcName](...args);
    });

    const api: ToggleEditorAPI = {
      // custom CMB methods
      getBlockMode: () => this.state.blockMode,
      setBlockMode: this.handleToggle,
      getCM: () => ed,
      on: (...args: Parameters<CodeMirror.Editor["on"]>) => {
        const [type, fn] = args;
        if (!this.eventHandlers[type]) {
          this.eventHandlers[type] = [fn];
        } else {
          this.eventHandlers[type].push(fn);
        }
        SHARED.cm.on(type, fn);
      },
      off: (...args: Parameters<CodeMirror.Editor["on"]>) => {
        const [type, fn] = args;
        this.eventHandlers[type]?.filter((h) => h !== fn);
        SHARED.cm.off(type, fn);
      },
      runMode: () => {
        throw "runMode is not supported in CodeMirror-blocks";
      },
    };
    return Object.assign(base, api);
  }

  /**
   * @internal
   * This is an internal function that is passed down into mode-
   * specific components. After a mode switch, (1) rebuild the
   * API with mode-specific versions, (2) re-assign event handlers,
   * and (3) re-render any TextMarkers.
   */
  handleEditorMounted = (ed: CodeMirror.Editor, api: API, ast: AST) => {
    // set CM aria attributes, and mount announcer
    const mode = this.state.blockMode ? "Block" : "Text";
    const wrapper = ed.getWrapperElement();
    ed.getScrollerElement().setAttribute("role", "presentation");
    wrapper.setAttribute("aria-label", mode + " Editor");
    mountAnnouncer(wrapper);
    // Rebuild the API and assign re-events
    Object.assign(this.props.api, this.buildAPI(ed), api);
    Object.keys(this.eventHandlers).forEach((type) => {
      this.eventHandlers[type].forEach((h) => ed.on(type as any, h));
    });
    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    this.pendingTimeout = setAfterDOMUpdate(() => {
      this.recordedMarks.forEach(
        (m: { options: CodeMirror.TextMarkerOptions }, k: number) => {
          let node = ast.getNodeByNId(k);
          if (node) {
            this.props.api?.markText(node.from, node.to, m.options);
          }
        }
      );
    });
    // save the editor, and announce completed mode switch
    SHARED.cm = ed;
    say(mode + " Mode Enabled", 500);
  };

  /**
   * @internal
   * Record all TextMarkers that are (a) not bookmarks and (b) still
   * in the document. This record is used to reconstitute them after
   * the editor mounts.
   */
  recordMarks(oldAST: AST) {
    this.recordedMarks.clear();
    (SHARED.cm as CodeMirror.Editor)
      .getAllMarks()
      .filter((m) => !m.BLOCK_NODE_ID && m.type !== "bookmark")
      .forEach((m: CodeMirror.TextMarker<MarkerRange | Position>) => {
        if (!isTextMarkerRange(m)) {
          return;
        }
        const marker = m.find();
        // marker is no longer in the document, bail
        if (!marker) {
          return;
        }
        let { from: oldFrom, to: oldTo } = marker;
        const oldNode = oldAST.getNodeAt(oldFrom, oldTo); // find the node for the mark
        if (!oldNode) {
          // bail on non-node markers
          console.error(
            `Removed TextMarker at [{line:${oldFrom.line}, ch:${oldFrom.ch}},` +
              `{line:${oldTo.line}, ch:${oldTo.ch}}], since that range does not correspond to a node boundary`
          );
          return;
        }
        const newNode = this.newAST?.getNodeByNId(oldNode.nid); // use the NID to look node up srcLoc post-PP
        if (!newNode) {
          throw new Error("Could not find node " + oldNode.nid + " in new AST");
        }
        const { from, to } = newNode;
        this.recordedMarks.set(oldNode.nid, {
          from: from,
          to: to,
          options: {
            css: m.css,
            title: m.title,
            className: m.className,
          },
        });
      });
  }

  // Teardown any pending timeouts
  componentWillUnmount() {
    cancelAfterDOMUpdate(this.pendingTimeout);
  }

  /**
   * @internal
   * When the mode is toggled, (1) parse the value of the editor,
   * (2) pretty-print and re-parse to canonicalize the text,
   * (3) record TextMarkers and update editor state
   */
  handleToggle = (blockMode: boolean) => {
    this.setState((state) => {
      let oldAst, WS, code;
      try {
        try {
          let oldCode = SHARED.cm.getValue();
          oldCode.match(/\s+$/); // match ending whitespace
          oldAst = this.props.language.parse(oldCode); // parse the code (WITH annotations)
        } catch (err) {
          console.error(err);
          let message = "";
          try {
            message = this.props.language.getExceptionMessage(err);
          } catch (e) {
            message = "The parser failed, and the error could not be retrieved";
          }
          throw message;
        }
        try {
          code = oldAst.toString() + (WS ? WS[0] : ""); // pretty-print and restore whitespace
          this.ast = this.props.language.parse(code); // parse the pretty-printed (PP) code
        } catch (e) {
          console.error("COULD NOT PARSE PRETTY-PRINTED CODE FROM:\n", oldAst);
          console.error("PRETTY-PRINTED CODE WAS", oldAst.toString());
          throw `An error occured in the language module: 
          the pretty-printer probably produced invalid code.
          See the JS console for more detailed reporting.`;
        }
        this.recordMarks(oldAst); // Preserve old TextMarkers
        return { ...state, blockMode: blockMode, code: code }; // Success! Set the state
      } catch (e) {
        // Failure! Set the dialog state
        console.error(e);
        return {
          ...state,
          dialog: {
            title: "Could not convert to Blocks",
            content: e.toString(),
          },
        };
      }
    });
  };

  render() {
    const classes = "Editor " + (this.state.blockMode ? "blocks" : "text");
    return (
      <>
        <div className={classes}>
          {this.state.blockMode ? <BugButton /> : null}
          <ToggleButton
            setBlockMode={this.handleToggle}
            blockMode={this.state.blockMode}
          />
          {this.state.blockMode ? <TrashCan /> : null}
          <div
            className={"col-xs-3 toolbar-pane"}
            tabIndex={-1}
            aria-hidden={!this.state.blockMode}
          >
            <Toolbar
              primitives={
                this.props.language.primitivesFn
                  ? this.props.language.primitivesFn()
                  : null
              }
              languageId={this.props.language.id}
              blockMode={this.state.blockMode}
              toolbarRef={this.toolbarRef}
            />
          </div>
          <div className="col-xs-9 codemirror-pane">
            {this.state.blockMode ? this.renderBlocks() : this.renderCode()}
          </div>
        </div>

        <div role="application" aria-roledescription="Stand by">
          <a
            id="SR_fix_for_slow_dom"
            href="#"
            aria-roledescription=":"
            aria-label=""
          ></a>
        </div>

        <Dialog
          appElement={this.props.appElement}
          isOpen={!!this.state.dialog}
          body={this.state.dialog}
          closeFn={() => this.setState({ dialog: null })}
        />
      </>
    );
  }

  renderCode() {
    return (
      <TextEditor
        cmOptions={{ ...defaultCmOptions, ...this.props.cmOptions }}
        value={this.state.code}
        onMount={this.handleEditorMounted}
        api={this.props.api}
        passedAST={this.ast}
      />
    );
  }

  renderBlocks() {
    let defaultOptions = {
      parse: this.props.language.parse,
      incrementalRendering: true,
      collapseAll: true,
    };
    return (
      <UpgradedBlockEditor
        cmOptions={{ ...defaultCmOptions, ...this.props.cmOptions }}
        value={this.state.code}
        onMount={this.handleEditorMounted}
        api={this.props.api}
        passedAST={this.ast}
        // the props below are unique to the BlockEditor
        appElement={this.props.appElement}
        languageId={this.props.language.id}
        options={{ ...defaultOptions, ...this.props.options }}
        toolbarRef={this.toolbarRef}
      />
    );
  }
}

export default CMBContext<ToggleEditorProps>(ToggleEditor);
