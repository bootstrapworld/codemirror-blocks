import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MODE_SWITCH_ORIGIN } from "./CodeMirrorHost";
import { recordEvent } from "../state/activityLog";
import BlockEditor from "./BlockEditor";
import TextEditor from "./TextEditor";
import Dialog from "../components/Dialog";
import Toolbar from "./Toolbar";
import { ToggleButton, BugButton } from "./EditorButtons";
import { mountAnnouncer, say } from "../announcer";
import TrashCan from "./TrashCan";
import type { Language, Options } from "../CodeMirrorBlocks";
import CodeMirror from "codemirror";
import { CodeMirrorFacade } from "../editor";
import { AppContext } from "../components/Context";
import { useDispatch, useSelector } from "react-redux";
import * as selectors from "../state/selectors";
import * as actions from "../state/actions";
import { AppDispatch } from "../state/store";
import { useSearch } from "./Search";

const defaultCmOptions: CodeMirror.EditorConfiguration = {
  lineNumbers: true,
  viewportMargin: 10,
  extraKeys: { "Shift-Tab": false },
};

export type ToggleEditorProps = {
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  language: Language;
  options?: Options;
  onMount: (codemirror: CodeMirror.Editor) => void;
  debuggingLog?: {
    history?: unknown;
  };
};

function ToggleEditor(props: ToggleEditorProps) {
  const blockMode = useSelector(selectors.isBlockModeEnabled);
  const dispatch: AppDispatch = useDispatch();
  const code = useSelector(selectors.getCode);
  // The one CodeMirror, made here and handed to whichever mode is showing:
  // keeping it across switches keeps its marks, selection, scroll position and
  // undo history (#571).
  const [codemirror] = useState(() => {
    const cm = CodeMirror(() => undefined, {
      ...defaultCmOptions,
      ...props.codemirrorOptions,
      value: code,
    });
    cm.setCursor(cm.getDoc().posFromIndex(code.length)); // after the text
    return cm;
  });
  const [editor] = useState(() => new CodeMirrorFacade(codemirror));

  // Edits made in text mode may leave the history at text that is not a
  // program, which block mode could not undo to. So when text was edited,
  // the history is dropped on the way back to block mode.
  const blockModeRef = useRef(blockMode);
  blockModeRef.current = blockMode;
  const editedAsTextRef = useRef(false);
  useEffect(() => {
    const onChange = (
      _: CodeMirror.Editor,
      change: CodeMirror.EditorChange
    ) => {
      if (!blockModeRef.current && change.origin !== MODE_SWITCH_ORIGIN) {
        editedAsTextRef.current = true;
      }
    };
    codemirror.on("change", onChange);
    return () => codemirror.off("change", onChange);
  }, [codemirror]);
  const [dialog, setDialog] = useState<null | {
    title: string;
    content: ReactElement | string;
  }>(null);

  /**
   * When the mode is toggled, (1) parse the value of the editor,
   * (2) pretty-print and re-parse to canonicalize the text,
   * (3) update editor state. (The CodeMirror is the same in both modes, so
   * marks made with markText, the selection and the undo history stay.)
   */
  const handleToggle = (blockMode: boolean) => {
    recordEvent({ type: "MODE", blocks: blockMode });
    const result = dispatch(
      actions.setBlockMode(blockMode, editor.getValue(), props.language)
    );
    if (!result.successful) {
      setDialog({
        title: "Could not convert to Blocks",
        content: <p>{String(result.exception)}</p>,
      });
      return;
    }
  };

  /**
   * This is an internal function that is passed down into mode-
   * specific components. After a mode switch, (1) rebuild the
   * API with mode-specific versions, and (2) re-assign event handlers.
   */
  const handleEditorMounted = (codemirror: CodeMirror.Editor) => {
    // set CM aria attributes, and mount announcer
    const mode = blockMode ? "Block" : "Text";
    const wrapper = codemirror.getWrapperElement();
    if (!blockMode) {
      // (BlockEditor sets these; they do not belong to text mode)
      wrapper.removeAttribute("role");
      wrapper.removeAttribute("aria-multiselectable");
      wrapper.removeAttribute("tabIndex");
    } else {
      if (editedAsTextRef.current) codemirror.clearHistory();
      dispatch(actions.showMarksOnBlocks(codemirror));
    }
    editedAsTextRef.current = false;
    codemirror.getScrollerElement().setAttribute("role", "presentation");
    wrapper.setAttribute("aria-label", mode + " Editor");
    mountAnnouncer(wrapper);
    // Rebuild the API and assign re-events
    props.onMount(codemirror);
    // announce completed mode switch
    say(mode + " Mode Enabled", 500);
  };

  const toolbarRef = useRef<HTMLInputElement>(null);
  const editorElementRef = useRef<HTMLDivElement>(null);

  const { api: search, dialog: searchDialog } = useSearch(
    editor,
    editorElementRef.current ?? undefined
  );

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
    <AppContext value={appHelpers}>
      <div className={classes} ref={editorElementRef}>
        {blockMode ? (
          <BugButton
            language={props.language.id}
            blockMode={blockMode}
            code={code}
          />
        ) : null}
        <ToggleButton setBlockMode={handleToggle} blockMode={blockMode} />
        {blockMode && editor ? (
          <TrashCan language={props.language} editor={editor} />
        ) : null}
        <div className={"toolbar-pane"} tabIndex={-1} aria-hidden={!blockMode}>
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
        <div className="codemirror-pane">
          {blockMode ? (
            <BlockEditor
              codemirror={codemirror}
              value={code}
              onMount={handleEditorMounted}
              // the props below are unique to the BlockEditor
              language={props.language}
              options={{
                incrementalRendering: true,
                collapseAll: true,
                ...props.options,
              }}
              keyDownHelpers={appHelpers}
            />
          ) : (
            <TextEditor
              codemirror={codemirror}
              value={code}
              onMount={handleEditorMounted}
            />
          )}
        </div>
      </div>

      {/* Somewhere for keyboard focus to wait while CodeMirror draws a block
          that was scrolled out of the DOM (see activateByNid). Without it the
          browser drops focus to <body> and screenreaders leave the editor. */}
      <div role="application" aria-roledescription="Stand by">
        <a
          id="cmb-focus-placeholder"
          href="#"
          aria-roledescription=":"
          aria-label=""
        ></a>
      </div>

      {blockMode ? searchDialog : null}

      <Dialog
        isOpen={!!dialog}
        body={dialog}
        closeFn={() => setDialog(null)}
        // hide the editor from screenreaders while the dialog is open
        appElement={editorElementRef.current ?? undefined}
      />
    </AppContext>
  );
}

export default ToggleEditor;
