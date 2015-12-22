function createFragment(htmlStr) {
  var frag = document.createDocumentFragment();
  var temp = document.createElement('div');
  temp.innerHTML = htmlStr;
  frag.appendChild(temp);
  return frag;
}

export var nodes = {
  unknown: require('./templates/unknown.handlebars'),
  expression: require('./templates/expression.handlebars'),
  functionDef: require('./templates/functionDef.handlebars'),
  variableDef: require('./templates/variableDef.handlebars'),
  struct: require('./templates/struct.handlebars'),
  literal: require('./templates/literal.handlebars'),
  comment: require('./templates/comment.handlebars')
};

var nodesInRenderOrder = [];

export function renderHTMLString(node) {
  if (nodes[node.type] === undefined) {
    throw new Error("Don't know how to render node: "+node.type);
  }
  var nodeEl = nodes[node.type]({node});
  nodesInRenderOrder.push(node);
  if (typeof nodeEl !== 'string') {
    console.warn("AST node renderers should return html strings. node:", node);
    var temp = document.createElement('div');
    temp.appendChild(nodeEl);
    return temp.innerHTML;
  }
  return nodeEl;
}

export default function render(rootNode, cm, options={}) {
  nodesInRenderOrder = [];
  var rootNodeFrag = createFragment(renderHTMLString(rootNode));
  let hiddenTypes = null;
  if (options.hideNodesOfType) {
    hiddenTypes = new Set(options.hideNodesOfType);
  }
  for (let node of nodesInRenderOrder) {
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
  cm.markText(rootNode.from, rootNode.to, {replacedWith: rootNodeFrag.firstChild.firstChild});
  return rootNodeFrag;
}
