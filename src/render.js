function makeDropTarget(location) {
  let dropEl = document.createElement('span')
  dropEl.className = 'blocks-drop-target blocks-white-space'
  dropEl.appendChild(document.createTextNode(''))
  dropEl.location = location
  return dropEl
}

export var nodes = {
  expression(node, cm, callback) {
    let expressionEl = document.createElement('span')
    expressionEl.id = `block-node-${node.id}`
    expressionEl.className = 'blocks-expression'
    expressionEl.draggable = true

    let operatorEl = document.createElement('span')
    operatorEl.className = 'blocks-operator'
    operatorEl.appendChild(document.createTextNode(node.func))

    expressionEl.appendChild(operatorEl)
    expressionEl.appendChild(document.createTextNode(' '))
    let argsEl = document.createElement('span')
    argsEl.className = 'blocks-args'
    argsEl.appendChild(
      makeDropTarget({
        line: node.from.line,
        ch: node.from.ch+1+node.func.length
      })
    )
    for (let i=0; i < node.args.length; i++) {
      argsEl.appendChild(render(node.args[i], cm, callback))
      argsEl.appendChild(
        makeDropTarget({
          line: node.args[i].to.line,
          ch: node.args[i].to.ch
        })
      )
    }
    expressionEl.appendChild(argsEl)

    cm.markText(
      node.from,
      node.to,
      {replacedWith: expressionEl}
    )

    return expressionEl
  },

  literal(node, cm) {
    let literalEl = document.createElement('span')
    literalEl.id = `block-node-${node.id}`
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
  var nodeEl = nodes[node.type](node, cm, callback)
  callback(node, nodeEl)
  return nodeEl
}

