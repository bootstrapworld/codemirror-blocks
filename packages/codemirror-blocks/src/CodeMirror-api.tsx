import type {
  Activity,
  AppAction,
  RootState,
  Quarantine,
} from "./state/reducers";
import { ASTNode, Pos } from "./ast";
import { CodeMirrorFacade, isBlockNodeMarker } from "./editor";
import type { AppDispatch } from "./state/store";
import * as selectors from "./state/selectors";
import { BlockError, getTempCM, maxpos, minpos, poscmp } from "./utils";
import CodeMirror, { SelectionOptions } from "codemirror";
import * as actions from "./state/actions";
import type { Language } from "./CodeMirrorBlocks";
import { AST } from "./ast";

export type BlockEditorAPI = {
  getAst(): AST;
  getFocusedNode(): ASTNode | undefined;
  getSelectedNodes(): ASTNode[];

  /**
   * @internal
   */
  getQuarantine(): Quarantine;

  /**
   * @internal
   */
  setQuarantine(start: Pos, end: Pos, txt: string): void;
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

  const api: BuiltAPI &
    Pick<
      CodeMirrorAPI,
      "listSelections" | "setSelections" | "replaceSelections"
    > = {
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
      const ast = dispatch((_, getState) => selectors.getAST(getState()));
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
      withState((state) => {
        const tmpCM = getTempCM(editor);
        tmpCM.setSelections(api.listSelections());
        tmpCM.extendSelections([from], opts);
        const { nodeIds, textRanges } = validateSelectionRanges(
          state,
          editor,
          tmpCM.listSelections(),
          undefined,
          opts
        );
        editor.codemirror.setSelections(textRanges, undefined, opts);
        dispatch(actions.setSelectedNodeIds(nodeIds));
      }),

    /**
     * Override CM's native extendSelections method, restricting it to the semantics
     * that make sense in a block editor (must include only valid node ranges)
     */
    extendSelections: (heads, opts) =>
      withState((state) => {
        const tmpCM = getTempCM(editor);
        tmpCM.setSelections(api.listSelections());
        tmpCM.extendSelection(heads[0], undefined, opts);
        // if one of the ranges is invalid, changeSelections will raise an error
        const { nodeIds, textRanges } = validateSelectionRanges(
          state,
          editor,
          tmpCM.listSelections(),
          undefined,
          opts
        );
        editor.codemirror.setSelections(textRanges, undefined, opts);
        dispatch(actions.setSelectedNodeIds(nodeIds));
      }),
    extendSelectionsBy: (
      f: (range: CodeMirror.Range) => Pos,
      opts?: SelectionOptions
    ) =>
      withState((state) => {
        const tmpCM = getTempCM(editor);
        tmpCM.setSelections(api.listSelections());
        tmpCM.extendSelection(api.listSelections().map(f)[0], undefined, opts);
        // if one of the ranges is invalid, validateSelectionRanges will raise an error
        const { nodeIds, textRanges } = validateSelectionRanges(
          state,
          editor,
          tmpCM.listSelections(),
          undefined,
          opts
        );
        editor.codemirror.setSelections(textRanges, undefined, opts);
        dispatch(actions.setSelectedNodeIds(nodeIds));
      }),
    getSelections: (sep?: string) =>
      api
        .listSelections()
        .map((s) => editor.codemirror.getRange(s.anchor, s.head, sep)),
    getSelection: (sep?: string) =>
      api
        .listSelections()
        .map((s) => editor.codemirror.getRange(s.anchor, s.head, sep))
        .join(sep),
    /**
     * Override CM's native listSelections method, using the selection
     * state from the block editor
     */
    listSelections: () =>
      withState((state) => {
        const selections = selectors.getSelectedNodes(state);
        const tmpCM = getTempCM(editor);
        // write all the ranges for all selected nodes
        selections.forEach((node) => tmpCM.addSelection(node.from, node.to));
        // write all the existing selection ranges
        editor.codemirror
          .listSelections()
          .map((s) => tmpCM.addSelection(s.anchor, s.head));
        // return all the selections
        return tmpCM.listSelections();
      }),
    replaceRange: (text, from, to, origin) =>
      withState((state) => {
        validateRanges([{ anchor: from, head: to }], selectors.getAST(state));
        editor.codemirror.replaceRange(text, from, to, origin);
      }),
    setSelections: (ranges, primary, opts) =>
      withState((state) => {
        const { nodeIds, textRanges } = validateSelectionRanges(
          state,
          editor,
          ranges,
          primary,
          opts
        );
        editor.codemirror.setSelections(textRanges, primary, opts);
        dispatch(actions.setSelectedNodeIds(nodeIds));
      }),
    setSelection: (anchor, head = anchor, opts) =>
      api.setSelections([{ anchor: anchor, head: head }], undefined, opts),
    addSelection: (anchor, head) =>
      withState((state) => {
        const { nodeIds, textRanges } = validateSelectionRanges(state, editor, [
          { anchor: anchor, head: head ?? anchor },
        ]);
        if (textRanges.length) {
          editor.codemirror.addSelection(
            textRanges[0].anchor,
            textRanges[0].head
          );
        }
        dispatch(actions.setSelectedNodeIds(nodeIds));
      }),

    /**
     * Override CM's native replaceSelections method, restricting it to the semantics
     * that make sense in a block editor (must include only valid node ranges)
     */
    replaceSelections: (rStrings, select?: "around" | "start") =>
      withState((state) => {
        const tmpCM: CodeMirror.Editor = getTempCM(editor);
        tmpCM.setSelections(api.listSelections());
        tmpCM.replaceSelections(rStrings, select);
        editor.setValue(tmpCM.getValue());
        if (select == "around") {
          // if one of the ranges is invalid, validateSelectionRanges will raise an error
          const { nodeIds, textRanges } = validateSelectionRanges(
            state,
            editor,
            tmpCM.listSelections()
          );
          editor.codemirror.setSelections(textRanges);
          dispatch(actions.setSelectedNodeIds(nodeIds));
        }
        const cur =
          select == "start"
            ? tmpCM.listSelections().pop()?.head
            : tmpCM.listSelections().pop()?.anchor;
        actions.setCursor(editor, cur ?? null);
      }),
    replaceSelection: (rString, select?: "around" | "start") =>
      api.replaceSelections(
        Array(api.listSelections().length).fill(rString),
        select
      ),
    // Restrict CM's getCursor() to  block editor semantics
    getCursor: (where) => {
      const node = dispatch((_, getState) =>
        selectors.getFocusedNode(getState())
      );
      if (node && document.activeElement?.id.match(/block-node/)) {
        if (where == "from" || where == undefined) {
          return node.from;
        }
        if (where == "to") {
          return node.to;
        } else {
          throw new BlockError(
            `getCursor() with ${where} is not supported on a focused block`,
            `API Error`
          );
        }
      } else {
        return editor.codemirror.getCursor(where);
      }
    },
    // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
    setCursor: (curOrLine, ch, _options) =>
      withState((state) => {
        const ast = selectors.getAST(state);
        ch = ch ?? 0;
        const cur =
          typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
        const node = ast.getNodeContaining(cur);
        if (node) {
          dispatch(
            actions.activateByNid(editor, node.nid, {
              record: false,
              allowMove: true,
            })
          );
        }
        dispatch(actions.setCursor(editor, cur));
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
    getAst: () => withState((state) => selectors.getAST(state)),
    // activation-test.js expects undefined
    // TODO(pcardune): choose null or undefined everywhere.
    getFocusedNode: () =>
      withState((state) => selectors.getFocusedNode(state) ?? undefined),
    getSelectedNodes: () =>
      withState((state) => {
        const ast = selectors.getAST(state);
        return state.selections.map((id) => ast.getNodeById(id));
      }),

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
     * Used for reproducing/debugging prior interactions
     * see toolkit/debug::loadLogButton.onchange()
     * Filter/Tweak logged history actions before dispatching them to
     * be executed.
     */
    executeAction: (activity) => {
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
      if (activity.type == "SET_AST") {
        editor.setValue(activity.code);
        const newAST = AST.from(language.parse(activity.code));
        action = { ...activity, ast: newAST };
      }
      // convert nid to node id, and use activate to generate the action
      else if (activity.type == "SET_FOCUS") {
        dispatch(
          actions.activateByNid(editor, activity.nid, { allowMove: true })
        );
        return;
      } else {
        action = activity;
      }
      dispatch(action);
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

/**
 * Validate and modify selection ranges to match the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
const validateSelectionRanges = (
  state: RootState,
  editor: CodeMirrorFacade,
  ranges: { anchor: Pos; head: Pos }[],
  primary?: number,
  options?: { bias?: number; origin?: string; scroll?: boolean }
) => {
  const ast = selectors.getAST(state);
  const tmpCM = getTempCM(editor);
  tmpCM.setSelections(ranges, primary, options);
  const textRanges: {
    anchor: Pos;
    head: Pos;
  }[] = [];
  const nodeIds: string[] = [];
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
      nodeIds.push(node.id);
    } else {
      textRanges.push({ anchor: anchor, head: head });
    }
  });
  return { nodeIds, textRanges };
};

function validateRanges(ranges: { anchor: Pos; head?: Pos }[], ast: AST) {
  ranges.forEach(({ anchor, head }) => {
    const c1 = head ? minpos(anchor, head) : anchor;
    const c2 = head ? maxpos(anchor, head) : anchor;
    if (ast.getNodeAt(c1, c2)) {
      return; // if there's a node, it's a valid range
    }
    // Top-Level if there's no node, or it's a root node with the cursor at .from or .to
    const N1 = ast.getNodeContaining(c1); // get node containing c1
    const N2 = ast.getNodeContaining(c2); // get node containing c2
    const c1IsTopLevel =
      !N1 ||
      (!ast.getNodeParent(N1) && (!poscmp(c1, N1.from) || !poscmp(c1, N1.to)));
    const c2IsTopLevel =
      !N2 ||
      (!ast.getNodeParent(N2) && (!poscmp(c2, N2.from) || !poscmp(c2, N2.to)));

    // If they're both top-level, it's a valid text range
    if (c1IsTopLevel && c2IsTopLevel) {
      return;
    }

    // Otherwise, the range is neither toplevel OR falls neatly on a node boundary
    throw `The range {line:${c1.line}, ch:${c1.ch}}, {line:${c2.line}, 
      ch:${c2.ch}} partially covers a node, which is not allowed`;
  });
}
