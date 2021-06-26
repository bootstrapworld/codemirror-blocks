import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import Args from './components/Args';
import {DropTarget} from './components/DropTarget';
import Node from './components/Node';
import {AST} from './ast';
import * as Nodes from './nodes';
import * as NodeSpec from './nodeSpec';
import * as Languages from './languages';
import Pretty from 'pretty-fast-pretty-printer';
import { PrimitiveGroup } from './parsers/primitives';
import type {API} from './ui/ToggleEditor';

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

export type Language = {
  id: string;
  name: string;
  parse: () => void;
  getExceptionMessage?: () => void;
  getASTNodeForPrimitive?: () => void;
  getLiteralNodeForPrimitive?: () => void;
  primitivesFn?: () => unknown[];
};

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(container: Element, options: Options = {}, language: Language, cmOptions: CodeMirror.EditorConfiguration = {}) {
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
    // TODO(pcardune): What the heck is even going on here?
    // constructors shouldn't return things that are not instances
    // of the class they are constructing. We should not have to
    // cast the return value to any for typescript to be happy.
    return api as any;
  }
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
