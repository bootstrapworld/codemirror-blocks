import React, {Component} from 'react';
import ReactDOM from 'react-dom';

import Expression from './components/Expression';
import {ASTNode} from './ast';

function createFragment(htmlStr) {
  var frag = document.createDocumentFragment();
  var temp = document.createElement('div');
  temp.innerHTML = htmlStr;
  frag.appendChild(temp);
  return frag;
}

export default class Renderer {
  constructor(cm, {hideNodesOfType, extraRenderers, printASTNode} = {}) {
    this.cm = cm;
    this.hideNodesOfType = hideNodesOfType;
    this.extraRenderers = extraRenderers || {};
    this.printASTNode = printASTNode || (node => node.toString());
    this.nodeRenderers = {
      unknown: require('./templates/unknown.handlebars'),
      expression: Expression,
      functionDef: require('./templates/functionDef.handlebars'),
      lambdaExpression: require('./templates/lambdaExpression.handlebars'),
      variableDef: require('./templates/variableDef.handlebars'),
      ifExpression: require('./templates/ifExpression.handlebars'),
      condExpression: require('./templates/condExpression.handlebars'),
      condClause: require('./templates/condClause.handlebars'),
      struct: require('./templates/struct.handlebars'),
      literal: require('./templates/literal.handlebars'),
      comment: require('./templates/comment.handlebars'),
      blank: require('./templates/blank.handlebars')
    };
    this._nodesInRenderOrder = [];
  }

  renderNode = (node) => {
    if (!node) {
      return '';
    }
    return this.renderHTMLString(node);
  }

  renderNodeForReact = (node) => {
    var Renderer = this.extraRenderers[node.type];
    if (Renderer && Renderer.prototype instanceof Component) {
      return (
        <Renderer
          node={node}
          helpers={{
            renderNode: this.renderNode,
            renderNodeForReact: this.renderNodeForReact,
          }}
        />
      );
    } else {
      return <span dangerouslySetInnerHTML={{__html: this.renderNode(node)}}/>;
    }
  }

  renderHTMLString(node) {
    if (typeof node !== "object" || !node instanceof ASTNode) {
      throw new Error("Expected ASTNode but got "+node);
    }
    var renderer = this.extraRenderers[node.type];
    if (!renderer) {
      renderer = this.nodeRenderers[node.type];
    }
    if (renderer === undefined) {
      throw new Error("Don't know how to render node of type: "+node.type);
    }
    if (renderer.prototype instanceof Component) {
      const RenderComponent = renderer;
      renderer = ({node}, {helpers}) => {
        const container = document.createElement('span');
        ReactDOM.render(<RenderComponent node={node} helpers={helpers}/>, container);
        return container.innerHTML;
      }
    }
    var nodeEl = renderer(
      {node},
      {
        helpers: {
          renderNode: this.renderNode,
          renderNodeForReact: this.renderNodeForReact,
        }
      }
    );
    this._nodesInRenderOrder.push(node);
    if (typeof nodeEl !== 'string') {
      console.warn("AST node renderers should return html strings. node:", node);
      var temp = document.createElement('div');
      temp.appendChild(nodeEl);
      return temp.innerHTML;
    }
    return nodeEl;
  }

  // extract all the literals, create clones, and absolutely position
  // them at their original locations
  animateTransition(ast, toBlocks) {
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
    }

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

    // 1) get all the literals from the AST, and make clones of them
    let literals=rootNodes.reduce((acc,r)=>acc.concat(Array.from(r).filter(n=>n.type=="literal")),[]);
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
    this._nodesInRenderOrder = [];
    var rootNodeFrag = createFragment(this.renderHTMLString(rootNode));
    let hiddenTypes = null;
    if (this.hideNodesOfType) {
      hiddenTypes = new Set(this.hideNodesOfType);
    }
    for (let node of this._nodesInRenderOrder) {
      node.el = rootNodeFrag.getElementById(`block-node-${node.id}`);
      if (!node.el) {
        console.warn("!! Didn't find a dom node for node", node);
        continue;
      }
      node.el.draggable = true;
      if (hiddenTypes && hiddenTypes.has(node.type)) {
        node.el.classList.add('blocks-hidden');
      }
    }
    this.cm.markText(
      rootNode.from,
      rootNode.to,
      {
        replacedWith: rootNodeFrag.firstChild.firstChild,
        node: rootNode
      }
    );
    return rootNodeFrag;
  }
}
