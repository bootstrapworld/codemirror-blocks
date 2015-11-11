
export var nodes = {
  expression(node, cm) {
    let el = document.createElement('span')
    el.appendChild(document.createTextNode("("+node.func+" "))
    el.style.color = 'lightgreen'
    cm.markText(
      node.from,
      node.to,
      {replacedWith: el}
    )
    for (let i=0; i < node.args.length; i++) {
      el.appendChild(ast(node.args[i], cm))
      if (i < node.args.length - 1) {
        el.appendChild(document.createTextNode(' '))
      }
    }
    el.appendChild(document.createTextNode(`)`))
    return el
  },

  literal(node, cm) {
    let el = document.createElement('span')
    el.appendChild(document.createTextNode(node.toString()))
    el.style.color = 'red'
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

