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
import {ASTNode}        from './ast';

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

  // extract all the literals, create clones, and absolutely position
  // them at their original locations
  animateTransition(ast, toBlocks) {
    window.ast = ast;
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
      if(["literal", "blank"].includes(node.type)){
        return flat.concat([node]);
      } else {
        return [...node].slice(1).reduce(flatten, flat);
      }
    }

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
  }

  render(rootNode) {
    if (typeof rootNode !== "object" || !(rootNode instanceof ASTNode)) {
      throw new Error("Expected ASTNode but got "+rootNode);
    }
    const container = document.createElement('span');
    ReactDOM.render(this.renderNodeForReact(rootNode), container);
    this.cm.markText(
      rootNode.from,
      rootNode.to,
      {
        replacedWith: container.firstChild,
        node: rootNode
      }
    );
    return container;
  }
}
