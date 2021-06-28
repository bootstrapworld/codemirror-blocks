import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import Args from './components/Args';
import {DropTarget} from './components/DropTarget';
import Node from './components/Node';
import type {AST, ASTNode} from './ast';
import * as Nodes from './nodes';
import type {Literal} from './nodes';
import * as NodeSpec from './nodeSpec';
import * as Languages from './languages';
import Pretty from 'pretty-fast-pretty-printer';
import { PrimitiveGroup } from './parsers/primitives';
import type {Primitive} from './parsers/primitives';
import type {API} from './ui/ToggleEditor';
export type {API} from './ui/ToggleEditor';

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
   * A function for generating an AST from source code
   * @param code source code for the program
   * @returns The ast that codemirror-blocks will render
   */
  parse(code: string): AST;

  /**
   * A function for generating a human readable error message
   * from any exceptions that are thrown by a call to parse()
   */
  getExceptionMessage?(e: any): string;

  /**
   * A function for generating ASTNodes from Primitives
   */
  getASTNodeForPrimitive?: (primitive: Primitive) => ASTNode;

  /**
   * A function for generating a Literal ast node from a Primitive
   */
  getLiteralNodeForPrimitive?: (primitive: Primitive) => Literal;

  /**
   * Returns a list of language primitives that will be displayed
   * in the search bar.
   */
  primitivesFn?: () => Primitive[];

  /**
   * @deprecated
   */
  primitives: Primitive[];
};


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
function CodeMirrorBlocks(container: Element, options: Options = {}, language: Language, cmOptions: CodeMirror.EditorConfiguration = {}): API {
  let api: API = {} as any;
  let initialCode = options.value;
  ReactDOM.render(
    <ToggleEditor
      language={language}
      initialCode={(initialCode == null) ? "" : initialCode}
      api={api}
      appElement={container}
      options={options}
      cmOptions={cmOptions}
    />,
    container
  );
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
