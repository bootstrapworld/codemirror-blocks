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
import IdentifierList from './components/IdentifierList';
import StructDefinition from './components/StructDef';
import VariableDefinition from './components/VariableDef';
import FunctionDefinition from './components/FunctionDef';

// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
function poscmp(a, b) { return a.line - b.line || a.ch - b.ch; }
function poseq(a, b) { return poscmp(a,b)===0; }

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
      blank: Blank
    };
  }

  // extract all the literals, create clones, and absolutely position
  // them at their original locations
  animateTransition(ast, toBlocks) {
    let start = Date.now();
    let that = this;
    // take note of the parent elt, CM offsets, and rootNodes
    let cm = this.cm, parent = this.cm.getScrollerElement(), rootNodes = ast.rootNodes;
    let {left: offsetLeft, top: offsetTop} = parent.getBoundingClientRect();
    let cloneParent = parent.appendChild(document.createElement("div"));

    // toDom : AST Node -> DOM Node
    // given a literal AST node, make a DOM node with the same srcLoc info
    var toDom = (literal) => {
      let el = document.createElement("span");
      el.appendChild(document.createTextNode(this.printASTNode(literal)));
      return el;
    };

    // given literals, clones, and whether we're coming from text...
    // position the clones over the currently-rendered literals
    // unless the literal is offscreen, in which case fade out the clone
    function assignClonePosition(literals, clones, fromText=!toBlocks) {
      if(fromText) { // if we're coming from text, fake a literal to get coords
        cm.operation(() => literals.forEach(literal => {
          literal.el = toDom(literal);
          literal.marker = cm.markText(literal.from, literal.to, { replacedWith: literal.el });
        }));
      }
      clones.forEach((clone, i) => {
        if(literals[i].el && literals[i].el.offsetWidth === 0 && literals[i].el.offsetHeight === 0) {
          clone.style.animationName = "fadeout";
          clone.style.whiteSpace    = "pre";
        } else if(literals[i].el){
          // assign the location and other style info
          let {left, top, width, height} = literals[i].el.getBoundingClientRect();
          clone.style.width  = width  + "px";
          clone.style.height = height + "px";
          clone.style.top    = (top - offsetTop) + parent.scrollTop  + "px";
          clone.style.left   = (left- offsetLeft)+ parent.scrollLeft + "px";
          clone.className    = "transition";
        }
      });
      // clear markers
      if(fromText) { cm.operation(() => literals.forEach(l => {l.marker.clear(); delete l.marker;})); } 
    }

    // extract all the literals and blanks from a rootNode
    function flatten(flat, node) {
      return ["literal", "blank"].includes(node.type)? flat.concat([node])
                : that.lockNodesOfType.includes(node.type)? flat // pass over locked nodes
                : [...node].slice(1).reduce(flatten, flat);
    }

    // 0) Optimization: limit the number of lines CM is rendering
    let originalViewportMargin = that.cm.getOption("viewportMargin");
    that.cm.setOption("viewportMargin", 20);
    
    // 1) get all the *visible* literals from the AST, and make clones of them
    let literals = ast.rootNodes.reduce(flatten, []);
    //                .filter(l => (l.from.line >= vp.from) && (l.to.line <= vp.to));
    let clones = literals.map(toDom);

    // 2) move each clone to the *origin* location of the corresponding literal
    assignClonePosition(literals, clones, toBlocks);
    clones.forEach(c => cloneParent.appendChild(c));

    // 3) render or clear the original AST
    if(toBlocks) {
      rootNodes.forEach(r => {
        this.render(r);
        r.el.style.animationName = "fadein";
      });
    } else {
      cm.getAllMarks().forEach(marker => marker.clear());
    }

    // 4) move each clone to the *destination* location of the corresponding literal
    assignClonePosition(literals, clones, !toBlocks);

    // 5) Clean up after ourselves. The 1000ms should match the transition length defined in blocks.less
    setTimeout(function() {
      for (let node of rootNodes) {
        if(node.el) node.el.style.animationName = "";
      }
      cloneParent.remove();
    }, 1000);
    that.cm.setOption("viewportMargin", originalViewportMargin);
    console.log('animateTransition: '+(Date.now() - start)/1000 + 'ms');
  }

  // Render the rootNode into a new marker, clearing any old ones
  // TODO: recycle rootNode.replacedWith, to make use of React's magic
  render(rootNode, quarantine=false) {
    var marker = this.cm.findMarksAt(rootNode.from).filter(m => m.node)[0];
    let container = /*marker? marker.replacedWith : */document.createElement('span');
    if(marker && !quarantine) marker.clear();
    this.cm.markText(rootNode.from, rootNode.to, {replacedWith: container, node: rootNode} );
    
    // REVISIT: make comments disappear by adding an empty span
    if(rootNode.options.comment) {
      this.cm.markText(rootNode.options.comment.from, rootNode.options.comment.to,
        { replacedWith: document.createElement('span') });
    }
    ReactDOM.render(this.renderNodeForReact(rootNode), container);
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
          node={node}
          helpers={{renderNodeForReact: this.renderNodeForReact}}
          key = {key}
          lockedTypes = {this.lockNodesOfType}
        />
      );
    } else {
      throw new Error("Don't know how to render node of type: "+node.type);
    }
  }
}
