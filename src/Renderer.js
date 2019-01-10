import React from 'react';
import ReactDOM from 'react-dom';

import {poscmp} from './utils';

export default class Renderer {
  constructor(cm, {lockNodesOfType=[], printWidth=80} = {}) {
    this.cm = cm;
    this.lockNodesOfType = lockNodesOfType;
    this.printASTNode = node => node.pretty().display(printWidth).join("\n");
  }

  // make code "float" between text/blocks
  animateTransition(ast, toBlocks) {
    let start = Date.now();
    let that = this;
    // take note of the parent elt, CM offsets, and rootNodes
    let cm = this.cm, parent = this.cm.getScrollerElement(), rootNodes = ast.rootNodes;
    let parentScrollTop = parent.scrollTop, parentScrollLeft = parent.scrollLeft;
    let lines = parent.getElementsByClassName("CodeMirror-lines")[0];
    let {left: offsetLeft, top: offsetTop} = parent.getBoundingClientRect();
    let cloneParent = parent.appendChild(document.createElement("div"));
    cloneParent.id="clones";

    // toDom : AST Node -> DOM Node
    // given a node AST node, make a DOM node with the same text contents
    var toDom = (node) => {
      let el = document.createElement("span");
      el.className = !["literal", "blank"].includes(node.type)? 'box' : 'literal';
      el.appendChild(document.createTextNode(this.printASTNode(node)));
      return el;
    };

    // given nodes, clones, whether we're in text or block mode, and whether it's a precalc..
    // position the clones over the currently-rendered literals and blanks
    // unless the node is offscreen, in which case fade out the clone
    // uses the FLIP method described at:
    // https://medium.com/outsystems-experts/flip-your-60-fps-animations-flip-em-good-372281598865
    function assignClonePosition(nodes, clones, textPosition, precalc, shiftY=0) {
      var top, left, width, height;
      clones.forEach((clone, i) => {
        let node = nodes[i];
        // compute position in raw CM text - avoid DOM by using cm.charCoords
        if(textPosition) {
          let startCoord = cm.charCoords(node.from, "window"), endCoord = cm.charCoords(node.to, "window");
          top = startCoord.top, left = startCoord.left, width = endCoord.right-left, height = endCoord.bottom-top;
        // compute position of offscreen block - just fadeout and disappear during transition
        } else if(node.el.offsetWidth === 0 && node.el.offsetHeight === 0) {
          clone.classList.add("fadeout");
          return;
        // compute position of onscreen block - use DOM because there's no cheaper way
        } else {
          ({left, top, width, height} = node.el.getBoundingClientRect());
        }
        top  = (top  - offsetTop)  + parentScrollTop;
        left = (left - offsetLeft) + parentScrollLeft;
        if(precalc){ // pre-compute left, top, width and height
          node.top = top; node.left = left; node.width = width; node.height = height;
        } else {     // compute the GPU-accelerated transition
          clone.style.top    = top    + "px";
          clone.style.left   = left   + "px";
          clone.style.transform = 'translate('+(node.left-left)+'px,'+(node.top+shiftY-top)+'px) ';
        }
      });
    }

    // extract all the literals and blanks from a rootNode
    function flatten(flat, node) {
      return ["literal", "blank"].includes(node.type)? flat.concat([node])  // nothing inside literals and blanks
        : that.lockNodesOfType.includes(node.type)? flat.concat([node])     // Perf: don't bother looking inside
          : [...node.children()].reduce(flatten, flat);                     // look inside
    }

    // 1) Limit the number of lines CM is rendering (perf), and extract visible nodes, & make clones 
    let originalViewportMargin = that.cm.getOption("viewportMargin");
    that.cm.setOption("viewportMargin", toBlocks? 2 : 20); // blocks are bigger than text, so use a smaller viewport
    let {from, to} = that.cm.getViewport();
    let viewportNodes = ast.getRootNodesTouching({line: from, ch: 0}, {line: to, ch: 0});
    let literals = viewportNodes.reduce(flatten, []), clones = literals.map(toDom);

    // 2) pre-calculate starting positions (F)
    assignClonePosition(literals, clones, toBlocks, true);
    let startScroll = that.cm.getScrollInfo().top, topLine = cm.lineAtHeight(startScroll ,"local");
    let startRoot = rootNodes.find(r => topLine < r.from.line) || rootNodes[0];
    let canary = startRoot? startRoot.from : {line:0,ch:0}, startY = cm.cursorCoords(canary, "local").top;

    // 3) render or clear the original AST
    let renderStart = Date.now();
    lines.classList.add('fadein');
    if(toBlocks) { viewportNodes.forEach(r => this.render(r));           }
    else { cm.getAllMarks().filter(m => m.node).forEach(m => m.clear()); }
    let renderTime = (Date.now() - renderStart)/1000;

    // 4) move each clone to the ending position (L), compute transformation (I), and start animation (P) 
    assignClonePosition(literals, clones, !toBlocks, false, shiftY);
    clones.forEach(c => cloneParent.appendChild(c));
    let shiftY = cm.cursorCoords(canary, "local").top - startY; // how much did the canary line scroll?
    cm.scrollTo(null, startScroll+shiftY);
    setTimeout(() => cloneParent.classList.add("animate", toBlocks? "blocks" : "text"), 50);

    // 5) Clean up after ourselves. The 1500ms should match the transition length defined in blocks.less
    setTimeout(() => {
      lines.classList.remove('fadein');
      cloneParent.remove();
      cm.refresh();
    }, 1500);
    that.cm.setOption("viewportMargin", originalViewportMargin);
    let totalTime = (Date.now() - start)/1000;
    console.log('starting animation took: '+totalTime+ 'ms.\n'
      +renderTime+'ms ('+((renderTime/totalTime)*100).toFixed(2)+'%) of that was for Rendering '+viewportNodes.length+' roots');

    if(toBlocks) { // if going to blockMode, render out-of-viewport nodes while animation is happening
      let alreadyRendered = new Set(viewportNodes);
      rootNodes.forEach(r => {if(!alreadyRendered.has(r)) this.render(r); }); 
    }
  }

  renderNodeForReact = (node, key) => {
    this.renderNodeForReact.defaultProps = { displayName: 'ASTNode Renderer' };
    if (typeof node.render === 'function') {
      let Renderer = node.render.bind(node);
      return (
        <Renderer
          node        = {node}
          helpers     = {{renderNodeForReact: this.renderNodeForReact}}
          key         = {key}
          lockedTypes = {this.lockNodesOfType}
        />
      );
    } else {
      console.log('vv Error:', node.type, this.extraRenderers, Renderer);
      throw new Error("Don't know how to render node of type: "+node.type);
    }
  }
}
