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

  // extract all the literals, create clones, and absolutely position 
  // them at their original locations
  animateTransition(ast, toBlocks) {
    var that = this, rootNodes = ast.rootNodes;
    // take note of the parent elt, CM offsets, and literals from the AST
    var cm = this.cm, parent = this.cm.getScrollerElement();
    let {left: offsetLeft, top: offsetTop} = parent.getBoundingClientRect();
    var literals = rootNodes.reduce((acc, r) => {
      return acc.concat(Array.from(r).filter((n) => n.type==="literal"));
    }, []);


    // toDom : AST Node -> DOM Node
    // given a literal AST node, make a DOM node with the same srcLoc info
    function toDom(astNode) {
      let el = document.createElement("span");
      el.from = astNode.from; el.to = astNode.to;
      el.appendChild(document.createTextNode(astNode.value.toString()));
      return el;
    }

    // assignPosition : DOM Node, {styles} - > Void
    // given a DOM node and some position info, necessary style properties
    function assignPosition(node, {left, top, width, height}){
      node.style.top    = (top - offsetTop) + parent.scrollTop  + "px";
      node.style.left   = (left- offsetLeft)+ parent.scrollLeft + "px";
      node.style.width  = width  + "px";
      node.style.height = height + "px";
      node.style.display   = "inline-block";
      node.style.position  = "absolute";
      node.style.animation = "none";
      node.className   = "transition";
    }

    // for each literal, figure out where belongs and then add a clone there
    var clones = literals.map(function(literal) {
      var clone = toDom(literal); // make the clone
      if(toBlocks){
        literal.el = clone; // if it's not yet rendered, use the clone as the element
        var tm = cm.markText(literal.from, literal.to, { replacedWith: literal.el });
      }
      assignPosition(clone, literal.el.getBoundingClientRect()); // assign the location
      if(toBlocks) { tm.clear(); }
      parent.appendChild(clone);
      return clone;
    });

    // render or clear the original AST
    if(toBlocks) { 
      for(let root of rootNodes){
        that.render(root); 
        root.el.style.animationName = "fadein"; 
      }
    } else { 
      cm.getAllMarks().forEach(marker => marker.clear()); 
    }

    // find out where each literal *is* post-rendering, and move the corresponding clone
    literals.forEach((literal, i) => {
      if(!toBlocks){
        literal.el = toDom(literal);
        var tm = cm.markText(clones[i].from, clones[i].to, { replacedWith: literal.el });
      }
      assignPosition(clones[i], literal.el.getBoundingClientRect());
      if(!toBlocks) { tm.clear(); }
    });

    setTimeout(function() {
      for (let node of rootNodes) { if(node.el) node.el.style.animationName = ""; }
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