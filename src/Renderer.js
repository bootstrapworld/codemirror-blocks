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
