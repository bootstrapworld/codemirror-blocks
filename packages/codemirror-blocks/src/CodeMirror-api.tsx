import type {
  Activity,
  AppAction,
  RootState,
  Quarantine,
} from "./state/reducers";
import { ASTNode, Pos } from "./ast";
import { CodeMirrorFacade, isBlockNodeMarker } from "./editor";
import type { AppStore } from "./state/store";
import * as selectors from "./state/selectors";
import { BlockError, maxpos, minpos, poscmp } from "./utils";
import CodeMirror, { SelectionOptions } from "codemirror";
import * as actions from "./state/actions";
import type { Language } from "./CodeMirrorBlocks";
import { AST } from "./ast";

// This is the complete list of methods exposed by the CodeMirror object
// SOME of them we override, but many can be exposed directly
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

type BlockModeAPI = {
  getAst(): AST;
  getFocusedNode(): ASTNode | undefined;
  getSelectedNodes(): ASTNode[];

  /**
   * @internal
   */
  getQuarantine(): Quarantine | null;

  /**
   * @internal
   */
  setQuarantine(start: Pos, end: Pos, txt: string): void;
  executeAction(activity: Activity): void;
} & Partial<Omit<CodeMirror.Editor, typeof unsupportedAPIs[number]>>;

type ToggleEditorAPI = {
  getBlockMode(): boolean;
  setBlockMode(blockMode: boolean): void;
  getCM(): CodeMirror.Editor;
  runMode(): never;
};
export type API = ToggleEditorAPI & CodeMirrorAPI & BlockModeAPI;

/**
 * @internal
 * Populate a base object with mode-agnostic methods we wish to expose
 */
export const buildAPI = (
  codemirror: CodeMirror.Editor,
  store: AppStore,
  language: Language
) => {
  const base = {} as CodeMirrorAPI;
  // any CodeMirror function that we can call directly should be passed-through.
  // TextEditor and BlockEditor can add their own, or override them
  codeMirrorAPI.forEach((funcName) => {
    // Some functions that we want to proxy (like phrase) are not on the codemirror
    // editor object when this code executes, so we have to do the lookup inside the
    // wrapper function. Hopefully by the time the wrapper function is called,
    // the function it proxies to has been added to the editor instance.
    base[funcName] = (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (codemirror as any)[funcName](...args);
  });

  const api: ToggleEditorAPI = {
    // custom CMB methods
    getBlockMode: () => selectors.isBlockModeEnabled(store.getState()),
    setBlockMode: (blockMode: boolean) => {
      store.dispatch(
        actions.setBlockMode(
          blockMode,
          new CodeMirrorFacade(codemirror),
          language
        )
      );
    },
    getCM: () => codemirror,
    runMode: () => {
      throw "runMode is not supported in CodeMirror-blocks";
    },
  };
  const textModeApi = buildTextModeAPI();
  const blockModeApi = buildBlockModeAPI(codemirror, store, language);
  if (store.getState().blockMode) {
    return { ...base, ...api, ...textModeApi, ...blockModeApi };
  }
  return { ...base, ...api, ...textModeApi };
};

const buildTextModeAPI = () => {
  // CodeMirror APIs that we need to disallow
  // NOTE(Emmanuel): we should probably block 'on' and 'off'...
  const unsupportedAPIs = ["startOperation", "endOperation", "operation"];

  const api = {} as API;
  // show which APIs are unsupported
  unsupportedAPIs.forEach(
    (f) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((api as any)[f] = () => {
        throw `The CM API '${f}' is not supported in CodeMirrorBlocks`;
      })
  );
  return api;
};

/**
 * Build the API for a block editor, restricting or modifying APIs
 * that are incompatible with our toggleable block editor
 */
const buildBlockModeAPI = (
  codemirror: CodeMirror.Editor,
  store: AppStore,
  language: Language
): BlockModeAPI => {
  const api: BlockModeAPI &
    Pick<
      CodeMirrorAPI,
      "listSelections" | "setSelections" | "replaceSelections"
    > = {
    /*****************************************************************
     * CM APIs WE WANT TO OVERRIDE
     */
    findMarks: (from, to) =>
      codemirror.findMarks(from, to).filter((m) => !isBlockNodeMarker(m)),
    findMarksAt: (pos) =>
      codemirror.findMarksAt(pos).filter((m) => !isBlockNodeMarker(m)),
    getAllMarks: () =>
      codemirror.getAllMarks().filter((m) => !isBlockNodeMarker(m)),
    // Restrict CM's markText method to block editor semantics:
    // fewer options, restricted to node boundaries
    markText: (from, to, opts: CodeMirror.TextMarkerOptions = {}) => {
      const ast = store.dispatch((_, getState) => selectors.getAST(getState()));
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
      const mark = codemirror.markText(from, to, opts); // keep CM in sync
      const _clear = mark.clear.bind(mark);
      mark.clear = () => {
        _clear();
        store.dispatch({ type: "CLEAR_MARK", id: node.id });
      };
      mark.find = () => {
        const { from, to } = ast.getNodeByIdOrThrow(node.id);
        return { from, to };
      };
      mark.options = opts;
      store.dispatch({ type: "ADD_MARK", id: node.id, mark: mark });
      return mark;
    },
    // Something is selected if CM has a selection OR a block is selected
    somethingSelected: () => {
      return Boolean(
        codemirror.somethingSelected() || store.getState().selections.length
      );
    },
    // CMB has focus if top-level CM has focus OR a block is active
    hasFocus: () =>
      codemirror.hasFocus() ||
      Boolean(document.activeElement?.id.match(/block-node/)),
    extendSelection: (from: Pos, to: Pos, opts?: SelectionOptions) => {
      const tmpCM = getTempCM(codemirror);
      tmpCM.setSelections(api.listSelections());
      tmpCM.extendSelections([from], opts);
      const { nodeIds, textRanges } = validateSelectionRanges(
        store.getState(),
        codemirror,
        tmpCM.listSelections(),
        undefined,
        opts
      );
      codemirror.setSelections(textRanges, undefined, opts);
      store.dispatch(actions.setSelectedNodeIds(nodeIds));
    },

    /**
     * Override CM's native extendSelections method, restricting it to the semantics
     * that make sense in a block editor (must include only valid node ranges)
     */
    extendSelections: (heads, opts) => {
      const tmpCM = getTempCM(codemirror);
      tmpCM.setSelections(api.listSelections());
      tmpCM.extendSelection(heads[0], undefined, opts);
      // if one of the ranges is invalid, changeSelections will raise an error
      const { nodeIds, textRanges } = validateSelectionRanges(
        store.getState(),
        codemirror,
        tmpCM.listSelections(),
        undefined,
        opts
      );
      codemirror.setSelections(textRanges, undefined, opts);
      store.dispatch(actions.setSelectedNodeIds(nodeIds));
    },
    extendSelectionsBy: (
      f: (range: CodeMirror.Range) => Pos,
      opts?: SelectionOptions
    ) => {
      const tmpCM = getTempCM(codemirror);
      tmpCM.setSelections(api.listSelections());
      tmpCM.extendSelection(api.listSelections().map(f)[0], undefined, opts);
      // if one of the ranges is invalid, validateSelectionRanges will raise an error
      const { nodeIds, textRanges } = validateSelectionRanges(
        store.getState(),
        codemirror,
        tmpCM.listSelections(),
        undefined,
        opts
      );
      codemirror.setSelections(textRanges, undefined, opts);
      store.dispatch(actions.setSelectedNodeIds(nodeIds));
    },
    getSelections: (sep?: string) =>
      api
        .listSelections()
        .map((s) => codemirror.getRange(s.anchor, s.head, sep)),
    getSelection: (sep?: string) =>
      api
        .listSelections()
        .map((s) => codemirror.getRange(s.anchor, s.head, sep))
        .join(sep),
    /**
     * Override CM's native listSelections method, using the selection
     * state from the block editor
     */
    listSelections: () => {
      const selections = selectors.getSelectedNodes(store.getState());
      const tmpCM = getTempCM(codemirror);
      // write all the ranges for all selected nodes
      selections.forEach((node) => tmpCM.addSelection(node.from, node.to));
      // write all the existing selection ranges
      codemirror
        .listSelections()
        .map((s) => tmpCM.addSelection(s.anchor, s.head));
      // return all the selections
      return tmpCM.listSelections();
    },
    replaceRange: (text, from, to, origin) => {
      validateRanges(
        [{ anchor: from, head: to }],
        selectors.getAST(store.getState())
      );
      codemirror.replaceRange(text, from, to, origin);
    },
    setSelections: (ranges, primary, opts) => {
      const { nodeIds, textRanges } = validateSelectionRanges(
        store.getState(),
        codemirror,
        ranges,
        primary,
        opts
      );
      codemirror.setSelections(textRanges, primary, opts);
      store.dispatch(actions.setSelectedNodeIds(nodeIds));
    },
    setSelection: (anchor, head = anchor, opts) =>
      api.setSelections([{ anchor: anchor, head: head }], undefined, opts),
    addSelection: (anchor, head) => {
      const { nodeIds, textRanges } = validateSelectionRanges(
        store.getState(),
        codemirror,
        [{ anchor: anchor, head: head ?? anchor }]
      );
      if (textRanges.length) {
        codemirror.addSelection(textRanges[0].anchor, textRanges[0].head);
      }
      store.dispatch(actions.setSelectedNodeIds(nodeIds));
    },

    /**
     * Override CM's native replaceSelections method, restricting it to the semantics
     * that make sense in a block editor (must include only valid node ranges)
     */
    replaceSelections: (rStrings, select?: "around" | "start") => {
      const tmpCM: CodeMirror.Editor = getTempCM(codemirror);
      tmpCM.setSelections(api.listSelections());
      tmpCM.replaceSelections(rStrings, select);
      codemirror.setValue(tmpCM.getValue());
      if (select == "around") {
        // if one of the ranges is invalid, validateSelectionRanges will raise an error
        const { nodeIds, textRanges } = validateSelectionRanges(
          store.getState(),
          codemirror,
          tmpCM.listSelections()
        );
        codemirror.setSelections(textRanges);
        store.dispatch(actions.setSelectedNodeIds(nodeIds));
      }
      const cur =
        select == "start"
          ? tmpCM.listSelections().pop()?.head
          : tmpCM.listSelections().pop()?.anchor;
      actions.setCursor(new CodeMirrorFacade(codemirror), cur ?? null);
    },
    replaceSelection: (rString, select?: "around" | "start") =>
      api.replaceSelections(
        Array(api.listSelections().length).fill(rString),
        select
      ),
    // Restrict CM's getCursor() to  block editor semantics
    getCursor: (where) => {
      const node = store.dispatch((_, getState) =>
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
        return codemirror.getCursor(where);
      }
    },
    // If the cursor falls in a node, activate it. Otherwise set the cursor as-is
    setCursor: (curOrLine, ch, _options) => {
      const ast = selectors.getAST(store.getState());
      ch = ch ?? 0;
      const cur =
        typeof curOrLine === "number" ? { line: curOrLine, ch } : curOrLine;
      const node = ast.getNodeContaining(cur);
      const editor = new CodeMirrorFacade(codemirror);
      if (node) {
        store.dispatch(
          actions.activateByNid(editor, node.nid, {
            record: false,
            allowMove: true,
          })
        );
      }
      store.dispatch(actions.setCursor(editor, cur));
    },
    // As long as widget isn't defined, we're good to go
    setBookmark: (pos, opts) => {
      if (opts?.widget) {
        throw new BlockError(
          "setBookmark() with a widget is not supported in Block Mode",
          "API Error"
        );
      }
      return codemirror.setBookmark(pos, opts);
    },

    /*****************************************************************
     * APIs THAT ARE UNIQUE TO CODEMIRROR-BLOCKS
     */
    getAst: () => selectors.getAST(store.getState()),
    // activation-test.js expects undefined
    // TODO(pcardune): choose null or undefined everywhere.
    getFocusedNode: () =>
      selectors.getFocusedNode(store.getState()) ?? undefined,
    getSelectedNodes: () => {
      const ast = selectors.getAST(store.getState());
      return store
        .getState()
        .selections.map((id) => ast.getNodeByIdOrThrow(id));
    },

    /*****************************************************************
     * APIs FOR TESTING
     */
    getQuarantine: () => selectors.getQuarantine(store.getState()),
    setQuarantine: (start, end, text) =>
      store.dispatch({
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
        codemirror.setValue(activity.code);
        const newAST = AST.from(language.parse(activity.code));
        action = { ...activity, ast: newAST };
      }
      // convert nid to node id, and use activate to generate the action
      else if (activity.type == "SET_FOCUS") {
        store.dispatch(
          actions.activateByNid(
            new CodeMirrorFacade(codemirror),
            activity.nid,
            { allowMove: true }
          )
        );
        return;
      } else {
        action = activity;
      }
      store.dispatch(action);
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
 * Create a dummy CM instance, matching relevant state
 * from a passed CodeMirrorFacade
 */
const tmpDiv = document.createElement("div");
function getTempCM(codemirror: CodeMirror.Editor) {
  const tmpCM = CodeMirror(tmpDiv, { value: codemirror.getValue() });
  tmpCM.setCursor(codemirror.getCursor());
  return tmpCM;
}

/**
 * Validate and modify selection ranges to match the semantics
 * that make sense in a block editor (must include only valid node ranges)
 */
const validateSelectionRanges = (
  state: RootState,
  codemirror: CodeMirror.Editor,
  ranges: { anchor: Pos; head: Pos }[],
  primary?: number,
  options?: { bias?: number; origin?: string; scroll?: boolean }
) => {
  const ast = selectors.getAST(state);
  const tmpCM = getTempCM(codemirror);
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
