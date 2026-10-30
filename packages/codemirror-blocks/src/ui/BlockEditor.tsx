import React, { useEffect, useState, useRef } from "react";
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";
import "./Editor.less";
import { useDispatch, useSelector } from "react-redux";
import { commitChanges, focusAfterUndoOrRedo } from "../edits/commitChanges";
import { speculateChanges } from "../edits/speculateChanges";
import DragAndDropEditor from "./DragAndDropEditor";
import { BlockError } from "../utils";
import { keyDown } from "../keymap";
import type { AST } from "../ast";
import CodeMirror from "codemirror";
import type { Options, Language } from "../CodeMirrorBlocks";
import type { AppDispatch } from "../state/store";
import * as selectors from "../state/selectors";
import * as actions from "../state/actions";
import type { IUnControlledCodeMirror } from "react-codemirror2";
import { EditorContext } from "../components/Context";
import { CMBEditor, CodeMirrorFacade, Pos, ReadonlyCMBEditor } from "../editor";
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
  onMount: (editor: CodeMirror.Editor) => void;
};

/**
 * Forget the browser's text selection if it is inside the editor and the
 * editor's own (hidden) input doesn't have focus.
 *
 * Before CodeMirror redraws it saves the DOM selection, and afterwards puts it
 * back if the element that had focus has gone. After a click or typing on a
 * block the selection can sit on the container of the lines (at an offset
 * equal to the number of lines), and an undo or redo that removes a line leaves
 * no child at that offset: the restore then throws "IndexSizeError" from inside
 * CodeMirror, half way through the operation. Blocks never use the DOM
 * selection (they take focus, not a caret), so it's safe to drop.
 */
const dropDomSelection = (codemirror: CodeMirror.Editor) => {
  const selection = document.getSelection();
  if (
    selection?.anchorNode &&
    !codemirror.hasFocus() &&
    codemirror.getWrapperElement().contains(selection.anchorNode)
  ) {
    selection.removeAllRanges();
  }
};

const BlockEditor = ({ options = {}, ...props }: BlockEditorProps) => {
  const { language } = props;
  const dispatch: AppDispatch = useDispatch();
  const ast = useSelector(selectors.getAST);
  const quarantine = useSelector(selectors.getQuarantine);
  const [editor, setEditor] = useState<CodeMirrorFacade | null>(null);
  const newASTRef = useRef<AST | undefined>(undefined);

  // When the last block goes away (deleted, dragged to the trash, undone...),
  // keyboard focus has nowhere to go and falls to the page body, so typing and
  // shortcuts stop working. Keep it in the editor instead.
  const hadBlocks = useRef(false);
  useEffect(() => {
    const hasBlocks = ast.rootNodes.length > 0;
    if (hadBlocks.current && !hasBlocks) {
      const active = document.activeElement;
      if (
        !active ||
        active === document.body ||
        active.id === "SR_fix_for_slow_dom"
      ) {
        editor?.focus();
      }
    }
    hadBlocks.current = hasBlocks;
  }, [ast, editor]);

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
      const result = speculateChanges([change], language, editor.getValue());
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
  const handleChange = (editor: CMBEditor, change: CodeMirror.EditorChange) => {
    if (isChangeObject(change)) {
      return; // trust our own changeObjects
    }

    // This change did NOT originate from us, but it passed the
    // `handleBeforeChange` function so it must be valid.
    // Therefore we can commit it without calling speculateChanges.
    const isUndoOrRedo = ["undo", "redo"].includes(change.origin as string);
    const annt = change.origin || "change"; // Default annotation
    if (!isUndoOrRedo) {
      dispatch(actions.setUndoableAction(annt));
    }
    // For an undo or redo the text has already changed, so the AST must follow
    // it; focus waits for handleChanges, which sees the whole undo or redo.
    dispatch(
      commitChanges(
        [makeChangeObject(change)],
        editor,
        isUndoOrRedo,
        undefined,
        newASTRef.current,
        annt
      )
    );
  };

  /**
   * CodeMirror reports "changes" once an operation is over and the display is
   * redrawn. For an undo or redo that is after the last of its changes (one
   * history item can hold several), so this is where focus is restored, and
   * where the history item that now sits on the other stack learns what it was.
   */
  const handleChanges = (
    editor: CMBEditor,
    changes: CodeMirror.EditorChange[]
  ) => {
    const which = changes[0]?.origin;
    if (which !== "undo" && which !== "redo") {
      return;
    }
    dispatch(focusAfterUndoOrRedo(which, editor, changes));
    dispatch(actions.finishUndoOrRedo(which, editor));
  };

  /**
   * When the editor mounts, (1) set change event handlers and AST,
   * (2) set the focus, (3) set aria attributes, and (4) build the API
   */
  const handleEditorDidMount = (codemirror: CodeMirror.Editor) => {
    const editor = new CodeMirrorFacade(codemirror);
    setEditor(editor);
    // TODO(Emmanuel): Try to set them in the component constructor
    codemirror.on("beforeChange", (ed, change) => {
      if (change.origin === "undo" || change.origin === "redo") {
        dropDomSelection(ed);
      }
      handleBeforeChange(editor, change);
    });
    codemirror.on("change", (ed, change) => handleChange(editor, change));
    codemirror.on("changes", (ed, changes) => handleChanges(editor, changes));

    // set AST and search properties and collapse preferences
    if (options.collapseAll) {
      dispatch(actions.collapseAll());
    }

    // When the editor receives focus, select the first root (if it exists)
    const firstRoot = ast.getFirstRootNode();
    if (firstRoot) {
      dispatch(actions.setFocusedNode(firstRoot));
    }

    // Set extra aria attributes
    const wrapper = codemirror.getWrapperElement();
    wrapper.setAttribute("role", "tree");
    wrapper.setAttribute("aria-multiselectable", "true");
    wrapper.setAttribute("tabIndex", "-1");

    // pass the block-mode CM editor, API, and current AST
    props.onMount(codemirror);
  };

  // we have use a ref here instead of useState
  // because handleTopLevelFocus gets passed down to
  // react-codemirror2's UnControlled component which
  // does not update event handlers on the uncontrolled
  // codemirror instance...
  const lastCursor = useRef<Pos | null>(null);

  /**
   * When the CM instance receives focus...
   * If we have a CM cursor, let CM handle it (no-op)
   * Otherwise grab the focusId, compute NId, and activate
   */
  const handleTopLevelFocus = (editor: ReadonlyCMBEditor) => {
    dispatch((_, getState) => {
      const ast = selectors.getAST(getState());
      const focusedNode = selectors.getFocusedNode(getState());
      const { current: cur } = lastCursor;
      if (cur != null) {
        return; // if we already have a cursor, bail
      }
      const node = focusedNode || ast.getFirstRootNode();
      dispatch(
        actions.activateByNid(editor, node && node.nid, {
          allowMove: true,
        })
      );
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
    dispatch(actions.setQuarantine(start, end, text));
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
      dispatch(actions.setQuarantine(start, end, text));
    }
  };

  /**
   * When the CM instance receives cursor activity...
   * If there are selections, pass null. Otherwise pass the cursor.
   */
  const handleTopLevelCursorActivity = (editor: CodeMirrorFacade) => {
    const cur =
      editor.codemirror.getSelection().length > 0 ? null : editor.getCursor();
    lastCursor.current = cur;
    // Only reclaim focus if the text editor already has it. Block edits also
    // move the (parked) cursor, and taking focus then would scroll the view to
    // the cursor and pull focus away from the block that should keep it.
    if (cur && editor.hasFocus()) {
      editor.setCursor(cur);
      editor.focus();
    }
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
        portals.push(
          <ToplevelBlockEditable
            editor={editor}
            quarantine={quarantine}
            key="-1"
          />
        );
      }
    }
    return portals;
  };

  return (
    <>
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
    </>
  );
};
export default BlockEditor;
