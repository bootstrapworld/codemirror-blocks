function createFragment(htmlStr) {
  var frag = document.createDocumentFragment();
  var temp = document.createElement('div');
  temp.innerHTML = htmlStr;
  frag.appendChild(temp);
  return frag;
}

export var nodes = {
  expression: require('./templates/expression.handlebars'),
  functionDef: require('./templates/functionDef.handlebars'),
  struct: require('./templates/struct.handlebars'),
  literal: require('./templates/literal.handlebars')
};

var nodesInRenderOrder = [];

export function renderHTMLString(node) {
  if (nodes[node.type] === undefined) {
    throw "Don't know how to render node: "+node.type;
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

export default function render(rootNode, cm, callback) {
  nodesInRenderOrder = [];
  var rootNodeFrag = createFragment(renderHTMLString(rootNode));
  for (let node of nodesInRenderOrder) {
    node.el = rootNodeFrag.getElementById(`block-node-${node.id}`);
    if (!node.el) {
      console.warn("!! Didn't find a dom node for node", node);
      continue;
    }
    node.el.draggable = true;
    callback(node);
  }
  cm.markText(rootNode.from, rootNode.to, {replacedWith: rootNodeFrag.firstChild.firstChild});
  return rootNodeFrag;
}
