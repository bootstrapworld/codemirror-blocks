import React, {Component} from 'react';
import ReactDOM from 'react-dom';
// import PropTypes from 'prop-types';

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
    this.state = {ast: {}, marks: [], quarantine: false};
    this.renderer = null;
  }

  setRenderer = (renderer) => {
    this.renderer = renderer;
  }

  setAst = (ast) => {
    this.setState (() => {
      return {ast: ast};
    });
  }

  setMarks = (marks) => {
    this.setState (() => {
      return {marks: marks};
    });
  }

  setQuarantine = (q) => {
    this.setState (() => {
      return {quarantine: q};
    });
  }

  // ASTNode Bool -> Void
  // tell the renderer to render the given AST node (which is definitely not quarantined)
  nodeNeedsRendering = (node) => {
    console.log ("node needs rendering: " + node.id + " " + node["aria-level"]);
    if (node["aria-level"] == 1) {
      // Don't render toplevel nodes, just let react do its job.
      return;
    }
    this.renderer.render (node, false);
  }

  // ASTNode -> Void
  // called when a quarantine node is inserted
  insertQuarantine = (node) => {
    console.log ("adding quarantine " + node.id);
    this.renderer.render (node, true);
    this.setQuarantine (node);
  }

  render() {
    const invisible = {}; //{display: 'none'}; //TODO: eventually hide it
    const marks = this.state.marks;
    const portals = [];
    console.log ('marks.length is ' + marks.length);
    marks.forEach((p) => {
      const child = this.renderer.renderNodeForReact (p.node);
      // The child will be a child of CodeMirrorContainer,
      // but it's rendered at the TextMarker.replacedWith DOM element.
      const v = ReactDOM.createPortal(child, p.replacedWith, p.node.id);
      portals.push (v);
    });
    return (<span className="code-mirror-blocks-children-container" style={invisible}>
      <React.Fragment>{portals}</React.Fragment>
    </span>);
  }
}
