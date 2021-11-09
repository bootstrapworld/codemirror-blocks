import React, { useEffect, useState, useRef } from "react";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import "./Editor.less";
import { useDispatch, useSelector } from "react-redux";
import { commitChanges, FocusHint } from "../edits/commitChanges";
import { speculateChanges } from "../edits/speculateChanges";
import DragAndDropEditor from "./DragAndDropEditor";
import { BlockError } from "../utils";
import { keyDown } from "../keymap";
import type { AST } from "../ast";
import CodeMirror from "codemirror";
import type { Options, Language } from "../CodeMirrorBlocks";
import type { AppDispatch } from "../state/store";
import type { RootState } from "../state/reducers";
import * as selectors from "../state/selectors";
import * as actions from "../state/actions";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext, LanguageContext } from "../components/Context";
import { CodeMirrorFacade, ReadonlyCMBEditor } from "../editor";
import { BuiltAPI, buildAPI } from "../CodeMirror-api";
import ToplevelBlockEditable from "./ToplevelBlockEditable";
import { isChangeObject, makeChangeObject } from "../edits/performEdits";
import ToplevelBlock from "./ToplevelBlock";
import { AppHelpers } from "../components/Context";

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
  const ast = useSelector(selectors.getAST);
  const quarantine = useSelector((state: RootState) => state.quarantine);
  const [editor, setEditor] = useState<CodeMirrorFacade | null>(null);
  const newASTRef = useRef<AST | undefined>();

  // only refresh if there is no active quarantine
  useEffect(() => {
    if (!quarantine) {
      editor?.refresh();
    }
  }, [quarantine, editor]);

  /**
   * Anything that didn't come from CMB itself must be speculatively
   * checked. NOTE: this only checks the *first change* in a changeset!
   * This is hooked up to CodeMirror's onBeforeChange; event
   */
  const handleBeforeChange = (
    editor: ReadonlyCMBEditor,
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
   * This is hooked up to CodeMirror's onChange; event
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
    dispatch(actions.setAST(passedAST));
    if (options.collapseAll) {
      dispatch(actions.collapseAll());
    }

    // When the editor receives focus, select the first root (if it exists)
    const firstRoot = passedAST.getFirstRootNode();
    if (firstRoot) {
      dispatch(actions.setFocusedNode(firstRoot));
    }

    // Set extra aria attributes
    const wrapper = editor.codemirror.getWrapperElement();
    wrapper.setAttribute("role", "tree");
    wrapper.setAttribute("aria-multiselectable", "true");
    wrapper.setAttribute("tabIndex", "-1");

    // pass the block-mode CM editor, API, and current AST
    props.onMount(editor, buildAPI(editor, dispatch, language), passedAST);
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
      const end = editor.codemirror.getCursor("to");
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
      editor.codemirror.getSelection().length > 0 ? null : editor.getCursor();
    cur && editor.setCursor(cur);
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
      if (quarantine) {
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
