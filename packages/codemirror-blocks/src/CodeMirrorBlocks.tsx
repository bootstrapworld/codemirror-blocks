import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import Modal from "react-modal";
import ToggleEditor from "./ui/ToggleEditor";
import Args, { listItems } from "./components/Args";
import { defineNode, field } from "./defineNode";
import { describeKinds } from "./summary";
import { joinWithAnd, pluralize } from "./naming";
import { formSexpr, sexpr } from "./printing";
export type { ListItem } from "./components/Args";
import * as DropTarget from "./components/DropTarget";
import { DropTarget as DropTargetComponent } from "./components/DropTarget";
import Node, { useNodeState } from "./components/Node";
export type { NodeState } from "./components/Node";
import { ASTNode } from "./ast";
import * as Nodes from "./nodes";
import * as NodeSpec from "./nodeSpec";
import * as Languages from "./languages";
import * as Pretty from "pretty-fast-pretty-printer";
import { PrimitiveGroup } from "./parsers/primitives";
import Context from "./components/Context";
import { AppStore, createAppStore } from "./state/store";
import { API, buildAPI, createStableAPI } from "./CodeMirror-api";
export type { API };

/**
 * Options for CodeMirrorBlocks
 */
export type Options = {
  /**
   * Initial code to use
   */
  value?: string;
  collapseAll?: boolean;
  incrementalRendering?: boolean;
};

import type { Language } from "./languages";
export type { Language };

type Props = {
  onMount: (api: API) => void;
  options?: Options;
  language: Language;
  codemirrorOptions?: CodeMirror.EditorConfiguration;
  store?: AppStore;
};
export const CodeMirrorBlocksComponent = ({
  onMount,
  options = {},
  language,
  codemirrorOptions = {},
  store = createAppStore(options.value),
}: Props) => {
  return (
    <Context store={store}>
      <ToggleEditor
        language={language}
        onMount={(codemirror) => onMount(buildAPI(codemirror, store, language))}
        options={options}
        codemirrorOptions={codemirrorOptions}
      />
    </Context>
  );
};

// Calling CodeMirrorBlocks() again with the same container returns the API of
// the editor that is there (the same object), and does not make a second one:
// the options and the language of the second call are not used.
const editors = new WeakMap<HTMLElement, { root: Root; api: API }>();

/**
 * The main entry point for creating a new CodeMirrorBlocks editor.
 *
 * @param container a DOM node to host the editor
 * @param options configuration options for CodeMirrorBlocks
 * @param language A language definition object that has been previously
 *  registered using {@link Languages.addLanguage}, or the id of one
 * @param codemirrorOptions Any additional [codemirror-specific configuration](https://codemirror.net/doc/manual.html#config)
 * @returns An object-representation of CMB, allowing for
 *  integration with external (non-react) code
 */
function CodeMirrorBlocks(
  container: HTMLElement,
  options: Options = {},
  languageOrId: Language | string,
  codemirrorOptions: CodeMirror.EditorConfiguration = {}
): API {
  // (a language that has been added can be said by its id: `"wescheme"`)
  const language =
    typeof languageOrId === "string"
      ? Languages.LANGUAGES[languageOrId]
      : languageOrId;
  if (!language) {
    throw new Error(
      `There is no language "${String(languageOrId)}": add it first, by loading its module (one of ${
        Object.keys(Languages.LANGUAGES).join(", ") || "none have been added"
      }).`
    );
  }
  const existing = editors.get(container);
  if (existing) {
    Modal.setAppElement(container);
    return existing.api;
  }
  // The API has every method from the start, in both modes: it is the same
  // object after a mode switch, and each mode (re)binds what it answers with.
  const { api, bind } = createStableAPI();
  const root = createRoot(container);
  editors.set(container, { root, api });
  // Render synchronously, so that the API has been bound (by `onMount`) by the
  // time this function returns.
  // eslint-disable-next-line @eslint-react/dom-no-flush-sync
  flushSync(() => {
    root.render(
      <CodeMirrorBlocksComponent
        language={language}
        onMount={bind}
        options={options}
        codemirrorOptions={codemirrorOptions}
      />
    );
  });
  // See http://reactcommunity.org/react-modal/examples/set_app_element/
  // Used to hide the application from screen readers while a modal
  // is open.
  Modal.setAppElement(container);
  return api;
}
export { setLogReporter, BlockError, poscmp } from "./utils";
export { useAST } from "./hooks";
export { attachComments, addComment, placeOrphans } from "./orphans";
export type { ReportedComment } from "./orphans";
export { currentNode, withoutOrphans } from "./ast";
export type { AST, DrawnNode, Pos, BlockComment } from "./ast";
export type { Primitive } from "./parsers/primitives";
// (the types that are in what a language makes, and so in its declarations)
export type { NodeMaker, NodeOf } from "./defineNode";
export type { ASTNodeProps, NodeFields, NodeForSpec, NodeOptions } from "./ast";
export type {
  ChildSpec,
  FieldsForSpec,
  NodeSpec as NodeSpecOf,
  List as ListSpec,
  Optional as OptionalSpec,
  Required as RequiredSpec,
  Value as ValueSpec,
} from "./nodeSpec";
export { COMMENT_RULES } from "./commentRules";
export type { CommentRules } from "./commentRules";

export {
  CodeMirrorBlocks,
  Args,
  listItems,
  defineNode,
  describeKinds,
  formSexpr,
  sexpr,
  joinWithAnd,
  pluralize,
  field,
  DropTarget as DT,
  DropTargetComponent as DropTarget,
  ASTNode,
  Node,
  useNodeState,
  Nodes,
  NodeSpec,
  Languages,
  Pretty,
  PrimitiveGroup,
};
export default CodeMirrorBlocks;
