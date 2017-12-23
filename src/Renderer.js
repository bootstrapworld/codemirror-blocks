import React, {Component} from 'react';
import ReactDOM from 'react-dom';

import Expression       from './components/Expression';
import IfExpression     from './components/IfExpression';
import LambdaExpression from './components/LambdaExpression';
import CondExpression   from './components/CondExpression';
import CondClause       from './components/CondClause';
import Unknown          from './components/Unknown';
import Literal          from './components/Literal';
import Blank            from './components/Blank';
import Comment          from './components/Comment';
import IdentifierList   from './components/IdentifierList';
import StructDefinition from './components/StructDef';
import VariableDefinition from './components/VariableDef';
import FunctionDefinition from './components/FunctionDef';
import Sequence         from './components/Sequence';

export default class Renderer {
  constructor(cm, {lockNodesOfType=[], extraRenderers, printASTNode} = {}) {
    this.cm = cm;
    this.lockNodesOfType = lockNodesOfType;
    this.extraRenderers = extraRenderers || {};
    this.printASTNode = printASTNode || (node => node.toString());
    this.nodeRenderers = {
      unknown: Unknown,
      expression: Expression,
      functionDefinition: FunctionDefinition,
      lambdaExpression: LambdaExpression,
      variableDefinition: VariableDefinition,
      identifierList : IdentifierList,
      ifExpression: IfExpression,
      condExpression: CondExpression,
      condClause: CondClause,
      structDefinition: StructDefinition,
      literal: Literal,
      comment: Comment,
      sequence: Sequence,
      blank: Blank
    };
  }

  // make code "float" between text/blocks
  animateTransition(ast, toBlocks) {
    let start = Date.now();
    let that = this;
    // take note of the parent elt, CM offsets, and rootNodes
    let cm = this.cm, parent = this.cm.getScrollerElement(), rootNodes = ast.rootNodes;
    let lines = parent.getElementsByClassName("CodeMirror-lines")[0];
    let {left: offsetLeft, top: offsetTop} = parent.getBoundingClientRect();
    let cloneParent = parent.appendChild(document.createElement("div"));
    cloneParent.id="clones";

    // toDom : AST Node -> DOM Node
    // given a node AST node, make a DOM node with the same text contents
    var toDom = (node) => {
      let el = document.createElement("span");
      el.className = 'blocks-node-'+node.type;
      el.appendChild(document.createTextNode(this.printASTNode(node)));
      return el;
    };

    // given nodes, clones, whether we're in text or block mode, and whether it's a precalc..
    // position the clones over the currently-rendered nodes (wrap all marking in a cm.operation)
    // unless the node is offscreen, in which case fade out the clone
    // uses the FLIP method described at:
    // https://medium.com/outsystems-experts/flip-your-60-fps-animations-flip-em-good-372281598865
    function assignClonePosition(nodes, clones, textPosition, precalc) {
      if(textPosition) { // if we're computing text positions, mark them
        cm.operation(() => nodes.forEach(node => {
          node.el = toDom(node);
          node.marker = cm.markText(node.from, node.to, { replacedWith: node.el });
        }));
      }
      clones.forEach((clone, i) => {
        let node=nodes[i];
        if(node.el && node.el.offsetWidth === 0 && node.el.offsetHeight === 0) {
          clone.classList.add("fadeout");
          clone.style.whiteSpace    = "pre";
        } else {
          let {left, top, width, height} = node.el.getBoundingClientRect();
          top  = (top  - offsetTop)  + parent.scrollTop;
          left = (left - offsetLeft) + parent.scrollLeft;
          if(precalc){ // pre-compute left, top, width and height
            node.top = top; node.left = left; node.width = width; node.height = height;
          } else {     // compute the GPU-accelerated transition
            clone.style.top    = top    + "px";
            clone.style.left   = left   + "px";
            //clone.style.width  = width  + "px";
            //clone.style.height = height + "px";
            clone.style.transform = 'translate('+(node.left-left)+'px,'+(node.top-top)+'px) ';
                                //+'scale('+(node.width/width)+', '+(node.height/height)+')'; 
          }
        }
      });
      // if we were messing with text positions, clear markers
      if(textPosition) { cm.operation(() => nodes.forEach(n => {n.marker.clear(); delete n.marker;})); } 
    }

    // extract all the literals and blanks from a rootNode
    function flatten(flat, node) {
      return ["literal", "blank"].includes(node.type)? flat.concat([node])      // add literals and blanks
                : that.lockNodesOfType.includes(node.type)? flat.concat([node]) // Perf: don't bother looking inside
                : [...node].slice(1).reduce(flatten, flat);                     // look inside
    }

    // 1) Limit the number of lines CM is rendering (perf), and extract visible nodes, & make clones 
    let originalViewportMargin = that.cm.getOption("viewportMargin");
    that.cm.setOption("viewportMargin", 20);
    let {from, to} = that.cm.getViewport();
    let viewportNodes = ast.getRootNodesTouching({line: from, ch: 0}, {line: to, ch: 0});
    let nodes = viewportNodes.reduce(flatten, []);
    let clones = nodes.map(toDom);

    // 2) pre-calculate starting positions (F)
    assignClonePosition(nodes, clones, toBlocks, true);
    clones.forEach(c => cloneParent.appendChild(c));

    // 3) render or clear the original AST
    let renderStart = Date.now();
    lines.classList.add('fadein');
    if(toBlocks) { rootNodes.forEach(r => this.render(r));                  }
    else { cm.getAllMarks().filter(m => m.node).forEach(m => m.clear()); }
    console.log('rendering took: '+(Date.now() - renderStart)/1000 + 'ms');

    // 4) move each clone to the ending position (L), compute transformation (I), and start animation (P) 
    assignClonePosition(nodes, clones, !toBlocks, false);
    cloneParent.classList.add("animate");

    // 5) Clean up after ourselves. The 1500ms should match the transition length defined in blocks.less
    setTimeout(() => {
      lines.classList.remove('fadein');
      cloneParent.remove();
    }, 1500);
    that.cm.setOption("viewportMargin", originalViewportMargin);
    console.log('animateTransition took: '+(Date.now() - start)/1000 + 'ms');
  }

  // Render the node, recycling a container whenever possible
  render(node, quarantine=false) {
    var container;
    if(node["aria-level"] == 1) { // if it's a root node, reset the marker but save the container
      let marker = this.cm.findMarksAt(node.from).filter(m => m.node)[0];
      // recycle the container, if we can
      container = (marker && !quarantine)? marker.replacedWith : document.createElement('span');
      if(marker && !quarantine) marker.clear();
      this.cm.markText(node.from, node.to, {replacedWith: container, node: node} );
      
      // REVISIT: make comments disappear by adding an empty span
      if(node.options.comment) {
        this.cm.markText(node.options.comment.from, node.options.comment.to,
          { replacedWith: document.createElement('span') });
      }
    } else { // otherwise just render in-place
      container = node.el.parentNode;
    }
    ReactDOM.render(this.renderNodeForReact(node), container);
    container.className = 'react-container';
    return container;
  }

  renderNodeForReact = (node, key) => {
    this.renderNodeForReact.defaultProps = { displayName: 'ASTNode Renderer' };
    var Renderer = this.extraRenderers[node.type] || this.nodeRenderers[node.type];
    if (Renderer === undefined) {
      throw new Error("Don't know how to render node of type: "+node.type);
    }
    if (Renderer && Renderer.prototype instanceof Component) {
      return (
        <Renderer
          node        = {node}
          helpers     = {{renderNodeForReact: this.renderNodeForReact}}
          key         = {key}
          lockedTypes = {this.lockNodesOfType}
        />
      );
    } else {
      throw new Error("Don't know how to render node of type: "+node.type);
    }
  }
}
