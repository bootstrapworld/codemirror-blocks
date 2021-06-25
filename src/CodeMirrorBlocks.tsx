import React from 'react';
import ReactDOM from 'react-dom';
import ToggleEditor from './ui/ToggleEditor';
import type {ToggleEditorProps} from './ui/ToggleEditor';
import Args from './components/Args';
import {DropTarget} from './components/DropTarget';
import Node from './components/Node';
import {AST} from './ast';
import * as Nodes from './nodes';
import * as NodeSpec from './nodeSpec';
import * as Languages from './languages';
import Pretty from 'pretty-fast-pretty-printer';
import { PrimitiveGroup } from './parsers/primitives';

type CodeMirrorBlocksOptions = {
  value?: string;
};

// Consumes a DOM node to host the editor, a language object and the code
// to render. Produces an object-representation of CMB, allowing for
// integration with external (non-react) code
export default class CodeMirrorBlocks {
  constructor(container: Element, options: CodeMirrorBlocksOptions = {}, language: ToggleEditorProps['language'], cmOptions = {}) {
    let api = {};
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
    Object.assign(api, this.buildAPI());
    // TODO(pcardune): What the heck is even going on here?
    // constructors shouldn't return things that are not instances
    // of the class they are constructing. We should not have to
    // cast the return value to any for typescript to be happy.
    return api as any;
  }

  buildAPI = () => {
    return {
      'fromTextArea': this.fromTextArea,
    };
  }

  fromTextArea = myTextArea => {
    myTextArea.parentNode.replaceChild(<ToggleEditor
      appElement={myTextArea}
      initialCode={myTextArea.value}
    />, myTextArea);
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
