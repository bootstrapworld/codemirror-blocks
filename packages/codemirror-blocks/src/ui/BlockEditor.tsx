import React, { useEffect, useState, useRef } from "react";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import "./Editor.less";
import { useDispatch, useSelector } from "react-redux";
import {
  activateByNid,
  setCursor,
  setSelections,
  extendSelections,
  replaceSelections,
  listSelections,
} from "../actions";
import { commitChanges, FocusHint } from "../edits/commitChanges";
import { speculateChanges } from "../edits/speculateChanges";
import DragAndDropEditor from "./DragAndDropEditor";
import { validateRanges, BlockError, setAfterDOMUpdate } from "../utils";
import { keyDown } from "../keymap";
import { ASTNode, Pos } from "../ast";
import type { AST } from "../ast";
import CodeMirror, { SelectionOptions } from "codemirror";
import type { Options, Language } from "../CodeMirrorBlocks";
import type { AppDispatch } from "../store";
import type { Activity, AppAction, RootState, Quarantine } from "../reducers";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext, LanguageContext } from "../components/Context";
import {
  CodeMirrorFacade,
  ReadonlyCMBEditor,
  isBlockNodeMarker,
} from "../editor";
import ToplevelBlockEditable from "./ToplevelBlockEditable";
import { isChangeObject, makeChangeObject } from "../edits/performEdits";
import ToplevelBlock from "./ToplevelBlock";
import { AppHelpers } from "../components/Context";

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

export type BlockEditorAPI = {
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

type CodeMirrorAPI = Omit<CodeMirror.Editor, typeof unsupportedAPIs[number]>;
export type BuiltAPI = BlockEditorAPI & Partial<CodeMirrorAPI>;

/**
 * Build the API for a block editor, restricting or modifying APIs
 * that are incompatible with our toggleable block editor
 */
export const buildAPI = (
  editor: CodeMirrorFacade,
  dispatch: AppDispatch
): BuiltAPI => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // Restrict CM's markText method to block editor semantics:
    // fewer options, restricted to node boundaries
    markText: (from, to, opts: CodeMirror.TextMarkerOptions = {}) => {
      const { ast } = dispatch((_, getState) => getState());
      const node = ast.getNodeAt(from, to);
      if (!node) {
        throw new BlockError(
          `Could not create TextMarker: there is no AST node at [${from}, ${to},]`,
          "API Error"
        );
      }
      const supportedOptions = ["css", "className", "title"];
      for (const opt in opts) {
        if (!supportedOptions.includes(opt))
          throw new BlockError(
            `markText: option "${opt}" is not supported in block mode`,
            `API Error`
          );
      }
      const mark = editor.codemirror.markText(from, to, opts); // keep CM in sync
      const _clear = mark.clear.bind(mark);
      mark.clear = () => {
        _clear();
        dispatch({ type: "CLEAR_MARK", id: node.id });
      };
      mark.find = () => {
        const { from, to } = ast.getNodeByIdOrThrow(node.id);
        return { from, to };
      };
      mark.options = opts;
      dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
      return mark;
    },
    // Something is selected if CM has a selection OR a block is selected
    somethingSelected: () =>
      withState(({ selections }) =>
        Boolean(editor.codemirror.somethingSelected() || selections.length)
      ),
    // CMB has focus if top-level CM has focus OR a block is active
    hasFocus: () =>
      editor.codemirror.hasFocus() ||
      Boolean(document.activeElement?.id.match(/block-node/)),
    extendSelection: (from: Pos, to: Pos, opts?: SelectionOptions) =>
      dispatch(extendSelections(editor, [from], opts, to)),
    extendSelections: (heads, opts) =>
      dispatch(extendSelections(editor, heads, opts, undefined)),
    extendSelectionsBy: (
      f: (range: CodeMirror.Range) => Pos,
      opts?: SelectionOptions
    ) =>
      dispatch(
        extendSelections(
          editor,
          listSelections(editor, dispatch).map(f),
          opts,
          undefined
        )
      ),
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
      dispatch(
        setSelections(editor, [{ anchor: anchor, head: head }], undefined, opts)
      ),
    addSelection: (anchor, head) =>
      dispatch(
        setSelections(
          editor,
          [{ anchor: anchor, head: head ?? anchor }],
          undefined,
          undefined,
          false
        )
      ),
    replaceSelections: (rStrings, select?: "around" | "start") =>
      dispatch(replaceSelections(editor, rStrings, select)),
    replaceSelection: (rString, select?: "around" | "start") =>
      dispatch(
        replaceSelections(
          editor,
          Array(listSelections(editor, dispatch).length).fill(rString),
          select
        )
      ),
    // Restrict CM's getCursor() to  block editor semantics
    getCursor: (where) => {
      const { focusId, ast } = dispatch((_, getState) => getState());
      if (focusId && document.activeElement?.id.match(/block-node/)) {
        const node = ast.getNodeByIdOrThrow(focusId);
        if (where == "from" || where == undefined) return node.from;
        if (where == "to") return node.to;
        else
          throw new BlockError(
            `getCursor() with ${where} is not supported on a focused block`,
            `API Error`
          );
      } else {
        return editor.codemirror.getCursor(where);
      }
    },
    // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
    setCursor: (curOrLine, ch, _options) =>
      withState(({ ast }) => {
        ch = ch ?? 0;
        const cur =
          typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
        const node = ast.getNodeContaining(cur);
        if (node) {
          dispatch(
            activateByNid(editor, node.nid, {
              record: false,
              allowMove: true,
            })
          );
        }
        dispatch(setCursor(editor, cur));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((api as any)[f] = () => {
        throw new BlockError(
          `The CM API '${f}' is not supported in the block editor`,
          "API Error"
        );
      })
  );
  return api;
};

export type BlockEditorProps = {
  value: string;
  options?: Options;
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  /**
   * language being used
   */
  language: Language;
  keyDownHelpers: AppHelpers;
  onBeforeChange?: IUnControlledCodeMirror["onBeforeChange"];
  onMount: (editor: CodeMirrorFacade, api: BuiltAPI, passedAST: AST) => void;
  passedAST: AST;
};

const BlockEditor = ({ options = {}, ...props }: BlockEditorProps) => {
  const { language, passedAST } = props;
  const dispatch: AppDispatch = useDispatch();
  const { ast, quarantine } = useSelector(({ ast, quarantine }: RootState) => ({
    ast,
    quarantine,
  }));
  const [editor, setEditor] = useState<CodeMirrorFacade | null>(null);
  const newASTRef = useRef<AST | undefined>();

  // only refresh if there is no active quarantine
  useEffect(() => {
    if (!!quarantine) {
      editor?.refresh();
    }
  });

  const getEditorOrThrow = () => {
    if (!editor) {
      throw new Error(`Expected codemirror to have mounted by now`);
    }
    return editor;
  };

  /**
   * @internal
   * Used for reproducing/debugging (see ToggleEditor::loadLoggedActions)
   * Filter/Tweak logged history actions before dispatching them to
   * be executed.
   */
  const _executeAction = (activity: Activity) => {
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
      getEditorOrThrow().setValue(activity.code);
      action = { ...activity, ast: ast };
    }
    // convert nid to node id, and use activate to generate the action
    else if (activity.type == "SET_FOCUS") {
      dispatch(
        activateByNid(getEditorOrThrow(), activity.nid, {
          allowMove: true,
        })
      );
      return;
    } else {
      action = activity;
    }
    dispatch(action);
  };

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
      // Success! Save the parsed AST for handleChange
      if (result.successful) {
        newASTRef.current = result.value;
      } else {
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
   * TODO(Emmanuel): use a single dispatch call here
   */
  const handleChange = (
    editor: ReadonlyCMBEditor,
    change: CodeMirror.EditorChange
  ) => {
    if (isChangeObject(change)) return; // trust our own changeObjects

    // This change did NOT originate from us, but it passed the
    // `handleBeforeChange` function so it must be valid.
    // Therefore we can commit it without calling speculateChanges.
    dispatch((dispatch, getState) => {
      const isUndoOrRedo = ["undo", "redo"].includes(change.origin as string);
      const annt = change.origin || "change"; // Default annotation
      const doChange = (hint: -1 | FocusHint) =>
        dispatch(
          commitChanges(
            [makeChangeObject(change)],
            language.parse,
            editor,
            isUndoOrRedo,
            hint,
            newASTRef.current,
            annt
          )
        );

      if (change.origin && isUndoOrRedo) {
        const { actionFocus } = getState();
        if (actionFocus) {
          // actionFocus will either contain an old OR new focusId
          const { oldFocusNId, newFocusNId } = actionFocus;
          const nextNId = (oldFocusNId || newFocusNId) as number;
          const focusHint = (newAST: AST) =>
            nextNId === null ? null : newAST.getNodeByNId(nextNId);
          doChange(focusHint);
          const actionType = change.origin.toUpperCase() as "UNDO" | "REDO";
          dispatch({ type: actionType, editor: editor });
        }
      } else {
        getState().undoableAction = annt; //?
        doChange(-1); // use -1 to allow CM to set focus
      }
    });
  };

  /**
   * When the editor mounts, (1) set change event handlers and AST,
   * (2) set the focus, (3) set aria attributes, and (4) build the API
   */
  const handleEditorDidMount = (editor: CodeMirrorFacade) => {
    setEditor(editor);
    // TODO(Emmanuel): Try to set them in the component constructor
    editor.codemirror.on("beforeChange", (ed, change) =>
      handleBeforeChange(editor, change)
    );
    editor.codemirror.on("change", (ed, change) =>
      handleChange(editor, change)
    );

    // set AST and search properties and collapse preferences
    dispatch({ type: "SET_AST", ast: passedAST });
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
    props.onMount(editor, buildAPI(editor, dispatch), passedAST);
  };

  /**
   * When the CM instance receives focus...
   * If we have a CM cursor, let CM handle it (no-op)
   * Otherwise grab the focusId, compute NId, and activate
   */
  const handleTopLevelFocus = (editor: CodeMirrorFacade) => {
    setAfterDOMUpdate(() => {
      dispatch((_, getState) => {
        const { cur, focusId, ast } = getState();
        if (cur != null) return; // if we already have a cursor, bail
        const node = focusId
          ? ast.getNodeByIdOrThrow(focusId)
          : ast.getFirstRootNode();
        activateByNid(editor, node && node.nid, {
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
    dispatch({
      type: "SET_QUARANTINE",
      start: start,
      end: end,
      text: text,
    });
  };

  /**
   * When the CM instance receives a paste event...start a quarantine
   */
  const handleTopLevelPaste = (editor: CodeMirrorFacade, e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain");
    if (text) {
      const start = editor.codemirror.getCursor("from");
      const end = editor.codemirror.getCursor("true");
      dispatch({
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
    const cur =
      editor.codemirror.getSelection().length > 0
        ? null
        : editor.codemirror.getCursor();
    dispatch(setCursor(editor, cur));
  };

  const renderPortals = () => {
    const incrementalRendering = options.incrementalRendering ?? false;
    let portals;
    if (editor && ast) {
      // Render all the top-level nodes
      portals = [...ast.children()].map((r) => (
        <EditorContext.Provider value={editor} key={r.id}>
          <ToplevelBlock
            node={r}
            incrementalRendering={incrementalRendering}
            editor={editor}
          />
        </EditorContext.Provider>
      ));
      if (!!quarantine) {
        portals.push(<ToplevelBlockEditable editor={editor} key="-1" />);
      }
    }
    return portals;
  };

  return (
    <LanguageContext.Provider value={language}>
      <DragAndDropEditor
        options={props.codemirrorOptions}
        className={`blocks-language-${language.id}`}
        value={props.value}
        onKeyPress={handleTopLevelKeyPress}
        onFocus={handleTopLevelFocus}
        onPaste={handleTopLevelPaste}
        onKeyDown={(editor, e) => {
          dispatch(
            keyDown(e, {
              language: language,
              editor,
              isNodeEnv: false,
              appHelpers: props.keyDownHelpers,
            })
          );
        }}
        onCursorActivity={handleTopLevelCursorActivity}
        editorDidMount={handleEditorDidMount}
      />
      {renderPortals()}
    </LanguageContext.Provider>
  );
};
export default BlockEditor;
