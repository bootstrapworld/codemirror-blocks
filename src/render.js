
export var nodes = {
  expression(node, cm) {
    let el = document.createElement('span')
    let operatorEl = document.createElement('span')
    operatorEl.className = 'blocks-operator'
    operatorEl.appendChild(document.createTextNode(node.func))
    el.appendChild(operatorEl)
    el.appendChild(document.createTextNode(' '))
    el.className = 'blocks-expression'
    cm.markText(
      node.from,
      node.to,
      {replacedWith: el}
    )
    let argsEl = document.createElement('span')
    argsEl.className = 'blocks-args'
    el.appendChild(argsEl)
    for (let i=0; i < node.args.length; i++) {
      argsEl.appendChild(ast(node.args[i], cm))
    }
    return el
  },

  literal(node, cm) {
    let el = document.createElement('span')
    el.appendChild(document.createTextNode(node.toString()))
    el.className = 'blocks-literal'
    cm.markText(
      node.from,
      node.to,
      {replacedWith: el, inclusiveRight: false, inclusiveLeft: false}
    )
    return el
  }
}

export default function ast(node, cm) {
  return nodes[node.type](node, cm)
}

