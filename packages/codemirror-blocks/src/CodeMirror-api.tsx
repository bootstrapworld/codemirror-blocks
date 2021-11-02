import type { Activity, AppAction, RootState, Quarantine } from "./reducers";
import { ASTNode, Pos } from "./ast";
import { CodeMirrorFacade, isBlockNodeMarker } from "./editor";
import type { AppDispatch } from "./store";
import { BlockError, validateRanges } from "./utils";
import CodeMirror, { SelectionOptions } from "codemirror";
import {
  activateByNid,
  setCursor,
  setSelections,
  extendSelections,
  replaceSelections,
  listSelections,
} from "./actions";
import type { Options, Language } from "./CodeMirrorBlocks";
import { AST } from "./ast";

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
  executeAction(activity: Activity): void;
};

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
] as const;

type CodeMirrorAPI = Omit<CodeMirror.Editor, typeof unsupportedAPIs[number]>;
export type BuiltAPI = BlockEditorAPI & Partial<CodeMirrorAPI>;

/**
 * Build the API for a block editor, restricting or modifying APIs
 * that are incompatible with our toggleable block editor
 */
export const buildAPI = (
  editor: CodeMirrorFacade,
  dispatch: AppDispatch,
  language: Language
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
    getAst: () => withState(({ ast }) => ast),
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
    /**
     * @internal
     * Used for reproducing/debugging (see ToggleEditor::loadLoggedActions)
     * Filter/Tweak logged history actions before dispatching them to
     * be executed.
     */
    executeAction: (activity) => {
      console.log(activity);
      withState(({ ast }) => {
        // ignore certain logged actions that are already
        // handled by the BlockEditor constructor
        const ignoreActions = ["RESET_STORE_FOR_TESTING"];
        if (ignoreActions.includes(activity.type)) {
          return;
        }

        let action: AppAction;
        // SET_AST actions have been serialized to printed code.
        // Set the value of the editor to that code, then 
        // reconstruct the AST and pass it to the reducer
        console.log(activity)
        if (activity.type == "SET_AST") {
          editor.setValue(activity.code);
          const newAST = new AST(language.parse(activity.code));
          action = { ...activity, ast: newAST };
        }
        // convert nid to node id, and use activate to generate the action
        else if (activity.type == "SET_FOCUS") {
          dispatch(
            activateByNid(editor, activity.nid, {
              allowMove: true,
            })
          );
          return;
        } else {
          action = activity;
        }
        console.log('about to dispatch');
        dispatch(action);        
      });
    },
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
