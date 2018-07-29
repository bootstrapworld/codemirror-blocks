import React, {Component} from 'react';
import PropTypes from 'prop-types';

// This component should be the root of the react tree
// for the block Node and expression component tree that renders the AST.
//
// AK: I think what needs to happen is that for any root AST nodes (that should be 
// rendered into a CodeMirror marker), we need to make a react Portal here in this
// component (and those AST nodes are what should be in state.managedNodes).
//
// For non-toplevel nodes, can we just climb up to their root and force a re-render?
//
// 
export default class CodeMirrorContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {managedNodes: {}};
    this.renderer = null;
    this.ast = null; /* FIXME: need to get this from blocks - renderer doesn't have it */
  }

  setRenderer = (renderer) => {
    this.renderer = renderer;
  }

  // ASTNode Bool -> Void
  // tell the renderer to render the given AST node (which may or may not be quarantined)
  nodeNeedsRendering = (node) => {
    console.log ("node needs rendering: " + node.id + " " + node["aria-level"]);
    if (node["aria-level"] == 1) {
      this.setState ((prevState, props) => {
        const x = {};
        x[node.id] = true;
        return {managedNodes: Object.assign (x, prevState.managedNodes) };
      });
    }
    this.renderer.render (node, false);
  }

  // ASTNode -> Void
  // called when a quarantine node is inserted
  insertQuarantine = (node) => {
    console.log ("adding quarantine " + node.id);
    this.renderer.render (node, true);
  }

  render() {
    const invisible = {}; //{display: 'none'}; //TODO: eventually hide it
    const ms = [];
    Object.keys(this.state.managedNodes).forEach(nodeId => {
      if (this.state.managedNodes[nodeId]) {
        ms.push (nodeId);
      }
    });
    const comps = ms.map ((txt)=> txt.toString () + ", ");
    return (<span className="code-mirror-blocks-children-container" style={invisible}>
      <React.Fragment>{comps}</React.Fragment>
    </span>);
  }
}