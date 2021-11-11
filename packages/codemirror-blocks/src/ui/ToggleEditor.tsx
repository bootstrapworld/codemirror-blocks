import React, { ReactElement, useMemo, useRef, useState } from "react";
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

const defaultCmOptions: CodeMirror.EditorConfiguration = {
  lineNumbers: true,
  viewportMargin: 10,
  extraKeys: { "Shift-Tab": false },
};

export type ToggleEditorProps = {
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  language: Language;
  options?: Options;
  onMount: (editor: CodeMirrorFacade) => void;
  debuggingLog?: {
    history?: unknown;
  };
};

function ToggleEditor(props: ToggleEditorProps) {
  const [editor, setEditor] = useState<CodeMirrorFacade | null>(null);
  const blockMode = useSelector(selectors.isBlockModeEnabled);
  const dispatch: AppDispatch = useDispatch();
  const code = useSelector(selectors.getCode);
  const [dialog, setDialog] = useState<null | {
    title: string;
    content: ReactElement | string;
  }>(null);

  /**
   * When the mode is toggled, (1) parse the value of the editor,
   * (2) pretty-print and re-parse to canonicalize the text,
   * (3) record TextMarkers and update editor state
   */
  const handleToggle = (blockMode: boolean) => {
    if (!editor) {
      return; // editor hasn't mounted yet, do nothing.
    }
    const result = dispatch(
      actions.setBlockMode(blockMode, editor, props.language)
    );
    if (!result.successful) {
      // console.error(result.exception);
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
   * API with mode-specific versions, (2) re-assign event handlers,
   * and (3) re-render any TextMarkers.
   */
  const handleEditorMounted = (editor: CodeMirrorFacade) => {
    // set CM aria attributes, and mount announcer
    const mode = blockMode ? "Block" : "Text";
    const wrapper = editor.codemirror.getWrapperElement();
    editor.codemirror.getScrollerElement().setAttribute("role", "presentation");
    wrapper.setAttribute("aria-label", mode + " Editor");
    mountAnnouncer(wrapper);
    // Rebuild the API and assign re-events
    props.onMount(editor);
    // save the editor, and announce completed mode switch
    setEditor(editor);
    say(mode + " Mode Enabled", 500);
  };

  const toolbarRef = useRef<HTMLInputElement>(null);

  const appHelpers = useMemo(
    () => ({
      showDialog: (contents: typeof dialog) => setDialog(contents),
      focusToolbar: () => toolbarRef.current?.focus(),
    }),
    [setDialog, toolbarRef]
  );

  const classes = "Editor " + (blockMode ? "blocks" : "text");

  return (
    <AppContext.Provider value={appHelpers}>
      <div className={classes}>
        {blockMode ? <BugButton /> : null}
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
              codemirrorOptions={{
                ...defaultCmOptions,
                ...props.codemirrorOptions,
              }}
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
              codemirrorOptions={{
                ...defaultCmOptions,
                ...props.codemirrorOptions,
              }}
              value={code}
              onMount={handleEditorMounted}
            />
          )}
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
