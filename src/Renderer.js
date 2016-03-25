function createFragment(htmlStr) {
  var frag = document.createDocumentFragment();
  var temp = document.createElement('div');
  temp.innerHTML = htmlStr;
  frag.appendChild(temp);
  return frag;
}

export default class Renderer {
  constructor(cm, {hideNodesOfType, extraRenderers} = {}) {
    this.cm = cm;
    this.hideNodesOfType = hideNodesOfType;
    this.extraRenderers = extraRenderers || {};
    this.nodeRenderers = {
      unknown: require('./templates/unknown.handlebars'),
      expression: require('./templates/expression.handlebars'),
      functionDef: require('./templates/functionDef.handlebars'),
      variableDef: require('./templates/variableDef.handlebars'),
      struct: require('./templates/struct.handlebars'),
      literal: require('./templates/literal.handlebars'),
      comment: require('./templates/comment.handlebars'),
      blank: require('./templates/blank.handlebars')
    };
    this._nodesInRenderOrder = [];
  }

  renderHTMLString(node) {
    var renderer = this.extraRenderers[node.type];
    if (!renderer) {
      renderer = this.nodeRenderers[node.type];
    }
    if (renderer === undefined) {
      throw new Error("Don't know how to render node of type: "+node.type);
    }
    var nodeEl = renderer(
      {node},
      {
        helpers: {
          renderNode: (node) => {
            if (!node) {
              return '';
            }
            return this.renderHTMLString(node);
          }
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

  // textToBlocks : CodeMirror [AST] -> ...
  // consumes an array of ASTs, produces an array of DOM trees where the children are
  // ordered according to their source locations
  textToBlocks(rootNodes) {
    // take note of the CM offsets
    var parent = this.cm.getScrollerElement(), cm = this.cm;
    let {left: offsetLeft, top: offsetTop} = parent.getBoundingClientRect();

    function poscmp(a, b) { return a.line - b.line || a.ch - b.ch; }
    function toDom(astNode) {
      let el = document.createElement("span");
      el.from = astNode.from; el.to = astNode.to;
      el.appendChild(document.createTextNode(astNode.value.toString()));
      return el;
    }

    // extract all the literals, and absolutely position them at their original source locations
    function attachLiteralsAtTextPositions(rootNodes) {
      var clones = rootNodes.reduce((acc, r) => {
        var flattened = Array.from(r).sort((a, b) => poscmp(a.from, a.from));
        return acc.concat(flattened.filter((n) => n.type==="literal").map(toDom));
      }, []);
      clones.forEach((clone) => {
        var tm = cm.markText(clone.from, clone.to, { replacedWith: clone });
        let {left, top, width, height} = clone.getBoundingClientRect();
        clone.className = "transition";
        clone.style.top = (top - offsetTop) + parent.scrollTop  + "px";
        clone.style.left= (left- offsetLeft)+ parent.scrollLeft + "px";
        clone.style.width     = width  + "px";
        clone.style.height    = height + "px";
        clone.style.display   = "inline-block";
        clone.style.position  = "absolute";
        clone.style.animation = "none";
        tm.clear();
        parent.appendChild(clone);
      });
      return clones;
    }
    // extract all the literals from a rendered DOM tree, 
    // and tell the clones to move to their positions
    function animateTransition(clones, rootNodes) {
      for (let node of rootNodes) { if(node.el) node.el.style.animationName = "fadein"; }
      var literals = rootNodes.reduce((acc, r) => {
        return acc.concat(Array.from(r).filter((n) => n.type==="literal"));
      }, []);
      literals.forEach(function(node, i) {
        // Don't animate if we're going to or from an invisible node
        if(!clones[i] || (node.el.offsetWidth === 0 && node.el.offsetHeight === 0)) {
          if(clones[i]) clones[i].remove(); 
        } else {
          let {left, top, width, height} = node.el.getBoundingClientRect();
          clones[i].style.top  = (top - offsetTop) + parent.scrollTop + "px";
          clones[i].style.left = (left- offsetLeft)+ parent.scrollLeft+ "px";
          clones[i].style.width   = width  + "px";
          clones[i].style.height  = height + "px";
        }
      });
    }
    // attach the clones in Text Position
    var clones = attachLiteralsAtTextPositions(rootNodes);
    // render the blocks
    for(let r of rootNodes) this.render(r);
    // animate the clones from text position to block position
    animateTransition(clones, rootNodes);
    // remove all the clones and any animation effects
    setTimeout(function() {
      for (let node of rootNodes) { node.el.style.animationName = ""; }
      for (let c of clones) { if(c) c.remove(); }
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