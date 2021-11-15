import React from "react";
import ReactDOM from "react-dom";
import Modal from "react-modal";
import ToggleEditor from "./ui/ToggleEditor";
import Args from "./components/Args";
import * as DropTarget from "./components/DropTarget";
import Node from "./components/Node";
import { ASTNode } from "./ast";
import * as Nodes from "./nodes";
import * as NodeSpec from "./nodeSpec";
import * as Languages from "./languages";
import * as Pretty from "pretty-fast-pretty-printer";
import { PrimitiveGroup } from "./parsers/primitives";
import Context from "./components/Context";
import { AppStore, createAppStore } from "./state/store";
import { API, buildAPI } from "./CodeMirror-api";
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

/**
 * The main entry point for creating a new CodeMirrorBlocks editor.
 *
 * @param container a DOM node to host the editor
 * @param options configuration options for CodeMirrorBlocks
 * @param language A language definition object that has been previously
 *  registered using {@link Languages.addLanguage}
 * @param codemirrorOptions Any additional [codemirror-specific configuration](https://codemirror.net/doc/manual.html#config)
 * @returns An object-representation of CMB, allowing for
 *  integration with external (non-react) code
 */
function CodeMirrorBlocks(
  container: HTMLElement,
  options: Options = {},
  language: Language,
  codemirrorOptions: CodeMirror.EditorConfiguration = {}
): API {
  const apiBox: API = {} as API;
  ReactDOM.render(
    <CodeMirrorBlocksComponent
      language={language}
      onMount={(api) => Object.assign(apiBox, api)}
      options={options}
      codemirrorOptions={codemirrorOptions}
    />,
    container
  );
  // See http://reactcommunity.org/react-modal/examples/set_app_element/
  // Used to hide the application from screen readers while a modal
  // is open.
  Modal.setAppElement(container);
  return apiBox;
}
export { setLogReporter } from "./utils";

export {
  CodeMirrorBlocks,
  Args,
  DropTarget as DT,
  ASTNode,
  Node,
  Nodes,
  NodeSpec,
  Languages,
  Pretty,
  PrimitiveGroup,
};
export default CodeMirrorBlocks;
