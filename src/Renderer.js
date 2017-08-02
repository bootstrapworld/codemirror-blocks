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
      functionDef: FunctionDefinition,
      lambdaExpression: LambdaExpression,
      variableDef: VariableDefinition,
      ifExpression: IfExpression,
      condExpression: CondExpression,
      condClause: CondClause,
      struct: StructDefinition,
      literal: Literal,
      comment: Comment,
      blank: Blank
    };
  }

  // extract all the literals, create clones, and absolutely position
  // them at their original locations
  animateTransition(ast, toBlocks) {
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

    // given a literal, a clone, and whether we're coming from text...
    // position the clone over the currently-rendered literal
    // unless the literal is offscreen, in which case fade out the clone
    function assignClonePosition(literal, clone, fromText) {
      if(fromText){ // if we're coming from text, fake a literal to get coords
        literal.el = toDom(literal);
        var tm = cm.markText(literal.from, literal.to, { replacedWith: literal.el });
      }
      if(literal.el.offsetWidth === 0 && literal.el.offsetHeight === 0) {
        clone.style.animationName = "fadeout";
        clone.style.whiteSpace    = "pre";
      } else {
        // assign the location and other style info
        let {left, top, width, height} = literal.el.getBoundingClientRect();
        clone.style.width  = width  + "px";
        clone.style.height = height + "px";
        clone.style.top    = (top - offsetTop) + parent.scrollTop  + "px";
        clone.style.left   = (left- offsetLeft)+ parent.scrollLeft + "px";
        clone.className    = "transition";
      }
      if(fromText) { tm.clear(); } // clean up the faked marker
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

    // 1) get all the literals from the AST, and make clones of them
    let literals = ast.rootNodes.reduce(flatten, []);
    let clones = literals.map(toDom);

    // 2) move each clone to the *origin* location of the corresponding literal
    literals.forEach(function(literal, i) {
      assignClonePosition(literal, clones[i], toBlocks);
      cloneParent.appendChild(clones[i]);
    });

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
    literals.forEach((literal, i) => assignClonePosition(literal, clones[i], !toBlocks));

    // 5) Clean up after ourselves. The 1000ms should match the transition length defined in blocks.less
    setTimeout(function() {
      for (let node of rootNodes) {
        if(node.el) node.el.style.animationName = "";
      }
      cloneParent.remove();
    }, 1000);
    that.cm.setOption("viewportMargin", originalViewportMargin);
  }

  renderAST(ast, restoreFocusToBlock) {
    // get all marks for rendered nodes, and see if we can recycle them
    var markers = this.cm.getAllMarks().filter(m => m.node);
    //console.log("there are "+markers.length+" markers and "+ast.rootNodes.length+" roots", markers);
    ast.rootNodes.forEach((rootNode, i) => {
      if (typeof rootNode !== "object" || !rootNode.type) {
        throw new Error("Expected ASTNode but got "+rootNode);
      }
      this.render(rootNode, markers[i] || false);
    });
    // Try to restore the cursor focus
    if(!restoreFocusToBlock) return;
    setTimeout(() => {
      let node = ast.getClosestNodeFromPath(restoreFocusToBlock.split(','));
      if(node && node.el) { node.el.click(); }
      else { this.cm.focus(); }
    }, 150);
  }

  // if we can't recycle an existing container, make a new one and mark CM with it
  render(rootNode, marker) {
    let container = marker? marker.replacedWith : document.createElement('span');
    let {from, to} = marker? marker.find() : {from: null, to: null};
    // if the marker needs to be resized or created, replace it and recycle the container
    if(!marker || !(poseq(from, rootNode.from) && poseq(to, rootNode.to))) {
      if(marker) marker.clear();
      this.cm.markText(rootNode.from, rootNode.to,
                       {replacedWith: container, node: rootNode} );
    }
    // make comments disappear
    if(rootNode.options.comment) {
      this.cm.markText(rootNode.options.comment.from, rootNode.options.comment.to,
        {replacedWith: document.createElement('span')})
    }
    ReactDOM.render(this.renderNodeForReact(rootNode), container);
    container.className = 'react-container';
    return container;
  }

  renderNodeForReact = (node, key) => {
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
