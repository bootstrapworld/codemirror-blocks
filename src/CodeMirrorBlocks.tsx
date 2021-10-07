import React from "react";
import ReactDOM from "react-dom";
import Modal from "react-modal";
import ToggleEditor from "./ui/ToggleEditor";
import Args from "./components/Args";
import * as DropTarget from "./components/DropTarget";
import Node from "./components/Node";
import * as AST from "./ast";
import * as Nodes from "./nodes";
import type { Literal } from "./nodes";
import * as NodeSpec from "./nodeSpec";
import * as Languages from "./languages";
import * as Pretty from "pretty-fast-pretty-printer";
import { PrimitiveGroup } from "./parsers/primitives";
import type { Primitive } from "./parsers/primitives";
import type { API } from "./ui/ToggleEditor";
import Context from "./components/Context";
import { createAppStore } from "./store";
export type { API } from "./ui/ToggleEditor";

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

/**
 * A language definition object
 */
export type Language = {
  /**
   * A unique id for the language
   */
  id: string;

  /**
   * The name of the language
   */
  name: string;

  /**
   * Optional description of the language
   */
  description?: string;

  /**
   * A function for generating an AST from source code
   * @param code source code for the program
   * @returns The ast that codemirror-blocks will render
   */
  parse(code: string): AST.AST;

  /**
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage?(e: any): string;

  /**
   * A function for generating ASTNodes from Primitives
   */
  getASTNodeForPrimitive?: (primitive: Primitive) => AST.ASTNode;

  /**
   * A function for generating a Literal ast node from a Primitive
   */
  getLiteralNodeForPrimitive?: (primitive: Primitive) => Literal;

  /**
   * Returns a list of language primitives that will be displayed
   * in the search bar.
   */
  primitivesFn?: () => PrimitiveGroup;
};

/**
 * TODO(pcardune): create a new instance of the store inside
 * the CodeMirrorBlocks() call, rather than having this
 * global around. And fix the tests that are depending on
 * state leakage to work!
 */
const store = createAppStore();

/**
 * The main entry point for creating a new CodeMirrorBlocks editor.
 *
 * @param container a DOM node to host the editor
 * @param options configuration options for CodeMirrorBlocks
 * @param language A language definition object that has been previously
 *  registered using {@link Languages.addLanguage}
 * @param cmOptions Any additional [codemirror-specific configuration](https://codemirror.net/doc/manual.html#config)
 * @returns An object-representation of CMB, allowing for
 *  integration with external (non-react) code
 */
function CodeMirrorBlocks(
  container: HTMLElement,
  options: Options = {},
  language: Language,
  cmOptions: CodeMirror.EditorConfiguration = {}
): API {
  let api: API = {} as any;
  let initialCode = options.value;
  ReactDOM.render(
    <Context store={store}>
      <ToggleEditor
        language={language}
        initialCode={initialCode == null ? "" : initialCode}
        api={api}
        options={options}
        cmOptions={cmOptions}
      />
    </Context>,
    container
  );
  // See http://reactcommunity.org/react-modal/examples/set_app_element/
  // Used to hide the application from screen readers while a modal
  // is open.
  Modal.setAppElement(container);
  return api;
}

export {
  CodeMirrorBlocks,
  Args,
  DropTarget as DT,
  AST,
  Node,
  Nodes,
  NodeSpec,
  Languages,
  Pretty,
  PrimitiveGroup,
};
export default CodeMirrorBlocks;
