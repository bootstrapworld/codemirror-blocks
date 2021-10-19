import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import CodeMirror from "codemirror";
import { setAfterDOMUpdate, cancelAfterDOMUpdate } from "../utils";

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

import type { BuiltAPI as BlockEditorAPIExtensions } from "./BlockEditor";
import { CodeMirrorFacade, CMBEditor, ReadonlyCMBEditor } from "../editor";
import { AppContext } from "../components/Context";
export type API = ToggleEditorAPI & CodeMirrorAPI & BlockEditorAPIExtensions;

export type ToggleEditorProps = {
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

function ToggleEditor(props: ToggleEditorProps) {
  const [editor, setEditor] = useState<CodeMirrorFacade | null>(null);
  const [blockMode, setBlockMode] = useState(false);
  const [code, setCode] = useState(props.initialCode ?? "");
  const [dialog, setDialog] = useState<null | {
    title: string;
    content: ReactElement;
  }>(null);
  const [ast, setAST] = useState(new AST([]));
  const [search, setSearch] = useState<Search>({
    search: () => {
      throw new Error("Search not ready yet");
    },
    onSearch: () => {
      throw new Error("Search not ready yet");
    },
    setCursor: () => {
      throw new Error("Search not ready yet");
    },
    setCM: () => {
      throw new Error("Search not ready yet");
    },
  });
  const [recordedMarks, setRecordedMarks] = useState<
    Map<
      number,
      {
        from: CodeMirror.Position;
        to: CodeMirror.Position;
        options: CodeMirror.TextMarkerOptions;
      }
    >
  >(new Map());

  /**
   * When the mode is toggled, (1) parse the value of the editor,
   * (2) pretty-print and re-parse to canonicalize the text,
   * (3) record TextMarkers and update editor state
   */
  const handleToggle =
    (editor: CMBEditor, language: Language) => (blockMode: boolean) => {
      let oldAst, WS, code;
      try {
        try {
          const oldCode = editor.getValue();
          oldCode.match(/\s+$/); // match ending whitespace
          oldAst = new AST(language.parse(oldCode)); // parse the code (WITH annotations)
        } catch (err) {
          console.error(err);
          let message = "";
          if (language.getExceptionMessage) {
            try {
              message = language.getExceptionMessage(err);
            } catch (e) {
              message =
                "The parser failed, and the error could not be retrieved";
            }
          }
          throw message;
        }
        try {
          code = oldAst.toString() + (WS ? WS[0] : ""); // pretty-print and restore whitespace
          setAST(new AST(language.parse(code))); // parse the pretty-printed (PP) code
        } catch (e) {
          console.error("COULD NOT PARSE PRETTY-PRINTED CODE FROM:\n", oldAst);
          console.error("PRETTY-PRINTED CODE WAS", oldAst.toString());
          throw `An error occured in the language module: 
        the pretty-printer probably produced invalid code.
        See the JS console for more detailed reporting.`;
        }
        // Preserve old TextMarkers
        setRecordedMarks(recordMarks(editor, oldAst, undefined));
        // Success! Set the state
        setBlockMode(blockMode);
        setCode(code);
      } catch (e) {
        // Failure! Set the dialog state
        console.error(e);
        setDialog({
          title: "Could not convert to Blocks",
          content: e.toString(),
        });
      }
    };

  const eventHandlersRef = useRef<Record<string, Function[]>>({});
  /**
   * @internal
   * Populate a base object with mode-agnostic methods we wish to expose
   */
  const buildAPI = (
    ed: CodeMirrorFacade
  ): ToggleEditorAPI & Partial<CodeMirrorAPI> => {
    const base: Partial<CodeMirrorAPI> = {};
    // any CodeMirror function that we can call directly should be passed-through.
    // TextEditor and BlockEditor can add their own, or override them
    codeMirrorAPI.forEach((funcName) => {
      // Some functions that we want to proxy (like phrase) are not on the codemirror
      // editor object when this code executes, so we have to do the lookup inside the
      // wrapper function. Hopefully by the time the wrapper function is called,
      // the function it proxies to has been added to the editor instance.
      base[funcName] = (...args: any[]) =>
        (ed.codemirror as any)[funcName](...args);
    });

    const api: ToggleEditorAPI = {
      // custom CMB methods
      getBlockMode: () => blockMode,
      setBlockMode: handleToggle(ed, props.language),
      getCM: () => ed.codemirror,
      on: (...args: Parameters<CodeMirror.Editor["on"]>) => {
        const [type, fn] = args;
        const eventHandlers = eventHandlersRef.current;
        if (!eventHandlers[type]) {
          eventHandlers[type] = [fn];
        } else {
          eventHandlers[type].push(fn);
        }
        ed.codemirror.on(type, fn);
      },
      off: (...args: Parameters<CodeMirror.Editor["on"]>) => {
        const [type, fn] = args;
        eventHandlersRef.current[type]?.filter((h) => h !== fn);
        ed.codemirror.off(type, fn);
      },
      runMode: () => {
        throw "runMode is not supported in CodeMirror-blocks";
      },
    };
    return { ...base, ...api };
  };

  /**
   * This is an internal function that is passed down into mode-
   * specific components. After a mode switch, (1) rebuild the
   * API with mode-specific versions, (2) re-assign event handlers,
   * and (3) re-render any TextMarkers.
   */
  const handleEditorMounted = (editor: CodeMirrorFacade, api: API) => {
    // set CM aria attributes, and mount announcer
    const mode = blockMode ? "Block" : "Text";
    const wrapper = editor.codemirror.getWrapperElement();
    editor.codemirror.getScrollerElement().setAttribute("role", "presentation");
    wrapper.setAttribute("aria-label", mode + " Editor");
    mountAnnouncer(wrapper);
    // Rebuild the API and assign re-events
    props.onMount({ ...buildAPI(editor), ...api });
    for (const [type, handlers] of Object.entries(eventHandlersRef.current)) {
      handlers.forEach((h) => editor.codemirror.on(type as any, h));
    }
    // save the editor, and announce completed mode switch
    setEditor(editor);
    say(mode + " Mode Enabled", 500);
  };

  useEffect(() => {
    if (!editor) {
      return;
    }
    // once the DOM has loaded, reconstitute any marks and render them
    // see https://stackoverflow.com/questions/26556436/react-after-render-code/28748160#28748160
    const pending = setAfterDOMUpdate(() => {
      recordedMarks.forEach(
        (m: { options: CodeMirror.TextMarkerOptions }, k: number) => {
          let node = ast.getNodeByNId(k);
          if (node) {
            editor.codemirror.markText(node.from, node.to, m.options);
          }
        }
      );
    });
    return () => cancelAfterDOMUpdate(pending);
  }, [recordedMarks, editor, ast]);

  const renderBlocks = () => {
    let defaultOptions = {
      parse: props.language.parse,
      incrementalRendering: true,
      collapseAll: true,
    };
    return (
      <UpgradedBlockEditor
        onSearchMounted={setSearch}
        codemirrorOptions={{
          ...defaultCmOptions,
          ...props.codemirrorOptions,
        }}
        value={code}
        onMount={handleEditorMounted}
        passedAST={ast}
        // the props below are unique to the BlockEditor
        language={props.language}
        options={{ ...defaultOptions, ...props.options }}
        keyDownHelpers={appHelpers}
      />
    );
  };
  const renderCode = () => (
    <TextEditor
      codemirrorOptions={{
        ...defaultCmOptions,
        ...props.codemirrorOptions,
      }}
      value={code}
      onMount={handleEditorMounted}
      passedAST={ast}
    />
  );

  const toolbarRef = useRef<HTMLInputElement>(null);

  const appHelpers = useMemo(
    () => ({
      showDialog: (contents: typeof dialog) => setDialog(contents),
      focusToolbar: () => toolbarRef.current?.focus(),
      search,
    }),
    [setDialog, toolbarRef, search]
  );

  const classes = "Editor " + (blockMode ? "blocks" : "text");

  return (
    <AppContext.Provider value={appHelpers}>
      <div className={classes}>
        {blockMode ? <BugButton /> : null}
        <ToggleButton
          setBlockMode={
            editor ? handleToggle(editor, props.language) : () => {}
          }
          blockMode={blockMode}
        />
        {blockMode && editor ? (
          <TrashCan language={props.language} editor={editor} />
        ) : null}
        <div
          className={"col-xs-3 toolbar-pane"}
          tabIndex={-1}
          aria-hidden={!blockMode}
        >
          <Toolbar
            primitives={
              props.language.primitivesFn
                ? props.language.primitivesFn()
                : undefined
            }
            languageId={props.language.id}
            blockMode={blockMode}
            toolbarRef={toolbarRef}
          />
        </div>
        <div className="col-xs-9 codemirror-pane">
          {blockMode ? renderBlocks() : renderCode()}
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

      <Dialog isOpen={!!dialog} body={dialog} closeFn={() => setDialog(null)} />
    </AppContext.Provider>
  );
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
