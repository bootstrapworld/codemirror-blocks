import React, { Component, createRef, ReactElement } from "react";
import BlockEditor, { Search } from "./BlockEditor";
import TextEditor from "./TextEditor";
import Dialog from "../components/Dialog";
import ByString from "./searchers/ByString";
import ByBlock from "./searchers/ByBlock";
import attachSearch from "./Search";
import Toolbar from "./Toolbar";
import { ToggleButton, BugButton } from "./EditorButtons";
import { mountAnnouncer, say } from "../announcer";
import TrashCan from "./TrashCan";
import { AST } from "../ast";
import type { Language, Options } from "../CodeMirrorBlocks";
import CodeMirror, { MarkerRange, Position, TextMarker } from "codemirror";
import { setAfterDOMUpdate, cancelAfterDOMUpdate, debugLog } from "../utils";
import type { afterDOMUpdateHandle } from "../utils";

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
  return marker.type !== "bookmark";
}

import type { BuiltAPI as BlockEditorAPIExtensions } from "./BlockEditor";
import { CodeMirrorFacade, CMBEditor, ReadonlyCMBEditor } from "../editor";
import { SearchContext } from "../components/Context";
export type API = ToggleEditorAPI & CodeMirrorAPI & BlockEditorAPIExtensions;

export type ToggleEditorProps = typeof ToggleEditor["defaultProps"] & {
  initialCode?: string;
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  language: Language;
  options?: Options;
  onMount: (api: API) => void;
  debuggingLog?: {
    history?: unknown;
  };
};

type ToggleEditorState = {
  blockMode: boolean;
  code: string;
  dialog: null | { title: string; content: ReactElement };
  debuggingLog?: ToggleEditorProps["debuggingLog"];
  editor: CMBEditor | null;
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

  toolbarRef: createRef<HTMLInputElement>(),
};

class ToggleEditor extends Component<ToggleEditorProps, ToggleEditorState> {
  state: ToggleEditorState = {
    blockMode: false,
    dialog: null,
    code: "",
    editor: null,
  };

  pendingTimeout?: afterDOMUpdateHandle;

  static defaultProps = {
    debuggingLog: {},
    codemirrorOptions: {},
    initialCode: "",
  };

  codemirrorOptions: CodeMirror.EditorConfiguration;
  options: Options;
  eventHandlers: Record<string, Function[]>;
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
    debugLog("log is", jsonLog);
    this.setState({ debuggingLog: jsonLog });
    this.state.editor?.setValue(jsonLog.startingSource);
  };

  /**
   * @internal
   * Populate a base object with mode-agnostic methods we wish to expose
   */
  buildAPI(ed: CodeMirror.Editor): ToggleEditorAPI & Partial<CodeMirrorAPI> {
    const base: Partial<CodeMirrorAPI> = {};
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
        ed.on(type, fn);
      },
      off: (...args: Parameters<CodeMirror.Editor["on"]>) => {
        const [type, fn] = args;
        this.eventHandlers[type]?.filter((h) => h !== fn);
        ed.off(type, fn);
      },
      runMode: () => {
        throw "runMode is not supported in CodeMirror-blocks";
      },
    };
    return { ...base, ...api };
  }

  /**
   * @internal
   * This is an internal function that is passed down into mode-
   * specific components. After a mode switch, (1) rebuild the
   * API with mode-specific versions, (2) re-assign event handlers,
   * and (3) re-render any TextMarkers.
   */
  handleEditorMounted = (editor: CodeMirrorFacade, api: API, ast: AST) => {
    // set CM aria attributes, and mount announcer
    const mode = this.state.blockMode ? "Block" : "Text";
    const wrapper = editor.codemirror.getWrapperElement();
    editor.codemirror.getScrollerElement().setAttribute("role", "presentation");
    wrapper.setAttribute("aria-label", mode + " Editor");
    mountAnnouncer(wrapper);
    // Rebuild the API and assign re-events
    this.props.onMount({ ...this.buildAPI(editor.codemirror), ...api });
    Object.keys(this.eventHandlers).forEach((type) => {
      this.eventHandlers[type].forEach((h) =>
        editor.codemirror.on(type as any, h)
      );
    });
    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    this.pendingTimeout = setAfterDOMUpdate(() => {
      this.recordedMarks.forEach(
        (m: { options: CodeMirror.TextMarkerOptions }, k: number) => {
          let node = ast.getNodeByNId(k);
          if (node) {
            editor.codemirror.markText(node.from, node.to, m.options);
          }
        }
      );
    });
    // save the editor, and announce completed mode switch
    this.setState({ editor: editor });
    say(mode + " Mode Enabled", 500);
  };

  // Teardown any pending timeouts
  componentWillUnmount() {
    this.pendingTimeout && cancelAfterDOMUpdate(this.pendingTimeout);
  }

  /**
   * @internal
   * When the mode is toggled, (1) parse the value of the editor,
   * (2) pretty-print and re-parse to canonicalize the text,
   * (3) record TextMarkers and update editor state
   */
  handleToggle = (blockMode: boolean) => {
    this.setState((state) => {
      if (!state.editor) {
        // editor hasn't mounted yet, so can't toggle.
        return state;
      }
      let oldAst, WS, code;
      try {
        try {
          let oldCode = state.editor.getValue();
          oldCode.match(/\s+$/); // match ending whitespace
          oldAst = new AST(this.props.language.parse(oldCode)); // parse the code (WITH annotations)
        } catch (err) {
          console.error(err);
          let message = "";
          if (this.props.language.getExceptionMessage) {
            try {
              message = this.props.language.getExceptionMessage(err);
            } catch (e) {
              message =
                "The parser failed, and the error could not be retrieved";
            }
          }
          throw message;
        }
        try {
          code = oldAst.toString() + (WS ? WS[0] : ""); // pretty-print and restore whitespace
          this.ast = new AST(this.props.language.parse(code)); // parse the pretty-printed (PP) code
        } catch (e) {
          console.error("COULD NOT PARSE PRETTY-PRINTED CODE FROM:\n", oldAst);
          console.error("PRETTY-PRINTED CODE WAS", oldAst.toString());
          throw `An error occured in the language module: 
          the pretty-printer probably produced invalid code.
          See the JS console for more detailed reporting.`;
        }
        this.recordedMarks = recordMarks(state.editor, oldAst, this.newAST); // Preserve old TextMarkers
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

  private search: Search | null = null;

  render() {
    const classes = "Editor " + (this.state.blockMode ? "blocks" : "text");
    return (
      <SearchContext.Provider value={this.search}>
        <div className={classes}>
          {this.state.blockMode ? <BugButton /> : null}
          <ToggleButton
            setBlockMode={this.handleToggle}
            blockMode={this.state.blockMode}
          />
          {this.state.blockMode && this.state.editor ? (
            <TrashCan
              language={this.props.language}
              editor={this.state.editor}
            />
          ) : null}
          <div
            className={"col-xs-3 toolbar-pane"}
            tabIndex={-1}
            aria-hidden={!this.state.blockMode}
          >
            <Toolbar
              primitives={
                this.props.language.primitivesFn
                  ? this.props.language.primitivesFn()
                  : undefined
              }
              languageId={this.props.language.id}
              blockMode={this.state.blockMode}
              toolbarRef={KeyDownContext.toolbarRef}
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
          isOpen={!!this.state.dialog}
          body={this.state.dialog}
          closeFn={() => this.setState({ dialog: null })}
        />
      </SearchContext.Provider>
    );
  }

  renderCode() {
    return (
      <TextEditor
        codemirrorOptions={{
          ...defaultCmOptions,
          ...this.props.codemirrorOptions,
        }}
        value={this.state.code}
        onMount={this.handleEditorMounted}
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
        onSearchMounted={(search) => (this.search = search)}
        codemirrorOptions={{
          ...defaultCmOptions,
          ...this.props.codemirrorOptions,
        }}
        value={this.state.code}
        onMount={this.handleEditorMounted}
        passedAST={this.ast || new AST([])}
        // the props below are unique to the BlockEditor
        language={this.props.language}
        options={{ ...defaultOptions, ...this.props.options }}
      />
    );
  }
}

export default ToggleEditor;

/**
 * Get all TextMarkers that are (a) not bookmarks and (b) still
 * in the document. This record is used to reconstitute them after
 * the editor mounts.
 */
function recordMarks(
  editor: ReadonlyCMBEditor,
  oldAST: AST,
  newAST: AST | undefined
) {
  const recordedMarks: Map<
    number,
    {
      from: CodeMirror.Position;
      to: CodeMirror.Position;
      options: CodeMirror.TextMarkerOptions;
    }
  > = new Map();
  for (const mark of editor.getAllTextMarkers()) {
    const markRange = mark.find();
    if (!markRange) {
      // marker is no longer in the document, bail
      continue;
    }
    const oldNode = oldAST.getNodeAt(markRange.from, markRange.to); // find the node for the mark
    if (!oldNode) {
      // bail on non-node markers
      console.error(
        `Removed TextMarker at [{line:${markRange.from.line}, ch:${markRange.from.ch}},` +
          `{line:${markRange.to.line}, ch:${markRange.to.ch}}], since that range does not correspond to a node boundary`
      );
      continue;
    }
    const newNode = newAST?.getNodeByNId(oldNode.nid); // use the NID to look node up srcLoc post-PP
    if (!newNode) {
      throw new Error("Could not find node " + oldNode.nid + " in new AST");
    }
    recordedMarks.set(oldNode.nid, {
      from: newNode.from,
      to: newNode.to,
      options: {
        css: mark.css,
        title: mark.title,
        className: mark.className,
      },
    });
  }
  return recordedMarks;
}
