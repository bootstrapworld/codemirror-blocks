function createFragment(htmlStr) {
  var temp = document.createElement('div');
  temp.innerHTML = htmlStr;
  return temp.firstChild;
}

function makeDropTarget(location) {
  let dropEl = document.createElement('span');
  dropEl.className = 'blocks-drop-target blocks-white-space';
  dropEl.appendChild(document.createTextNode(''));
  dropEl.location = location;
  return dropEl;
}

export var nodes = {
  expression(node, cm, callback) {
    let expressionEl = document.createElement('span');
    expressionEl.className = 'blocks-expression';
    expressionEl.draggable = true;

    let operatorEl = document.createElement('span');
    operatorEl.className = 'blocks-operator';
    operatorEl.appendChild(document.createTextNode(node.func));

    expressionEl.appendChild(operatorEl);
    expressionEl.appendChild(document.createTextNode(' '));
    let argsEl = document.createElement('span');
    argsEl.className = 'blocks-args';
    let location = Object.assign({}, node.to);
    if (node.args.length > 0) {
      Object.assign(location, node.args[0].from);
    }
    argsEl.appendChild(
      makeDropTarget(location)
    );
    for (let i=0; i < node.args.length; i++) {
      argsEl.appendChild(render(node.args[i], cm, callback));
      argsEl.appendChild(
        makeDropTarget({
          line: node.args[i].to.line,
          ch: node.args[i].to.ch
        })
      );
    }
    expressionEl.appendChild(argsEl);

    cm.markText(
      node.from,
      node.to,
      {replacedWith: expressionEl}
    );

    return expressionEl;
  },

  functionDef(node, cm, callback) {
    var template = require('./templates/functionDef.handlebars');
    var functionDefEl = createFragment(template({node, cm, callback}));
    cm.markText(
      node.from,
      node.to,
      {replacedWith: functionDefEl}
    );
    return functionDefEl;
  },

  struct(node, cm, callback) {
    var template = require('./templates/struct.handlebars');
    var structEl = createFragment(template({node, cm, callback}));
    cm.markText(
      node.from,
      node.to,
      {replacedWith: structEl}
    );
    return structEl;
  },

  literal(node, cm) {
    let literalEl = document.createElement('span')
    literalEl.appendChild(document.createTextNode(node.toString()))
    literalEl.className = 'blocks-literal'
    literalEl.draggable = true
    cm.markText(
      node.from,
      node.to,
      {replacedWith: literalEl, inclusiveRight: false, inclusiveLeft: false}
    )
    return literalEl
  }
}

export default function render(node, cm, callback) {
  if (nodes[node.type] === undefined) {
    throw "Don't know how to render node: "+node.type;
  }
  var nodeEl = nodes[node.type](node, cm, callback)
  nodeEl.id = `block-node-${node.id}`
  nodeEl.classList.add('blocks-node')
  callback(node, nodeEl)
  return nodeEl
}
