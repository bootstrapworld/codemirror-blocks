import render from './render'

const RETURN_KEY = 13
const TAB_KEY = 9

export default class CodeMirrorBlocks {
  constructor(cm, parser) {
    this.cm = cm
    this.parser = parser
    this.blockMode = false

    this.cm.getWrapperElement().onkeydown = this.handleKeyDown.bind(this)
  }

  setBlockMode(mode) {
    if (mode === this.blockMode) {
      return
    }
    this.blockMode = mode
    if (this.blockMode) {
      var ast = this.parser.parse(this.cm.getValue())
      render(ast, this.cm, this.didRenderNode.bind(this))
    } else {
      this.cm.getAllMarks().forEach(marker => marker.clear())
    }
  }

  toggleBlockMode() {
    this.setBlockMode(!this.blockMode)
  }

  selectNode(node, nodeEl, event) {
    event.stopPropagation()
    nodeEl.classList.add('blocks-selected')
  }

  saveEdit(node, nodeEl, event) {
    nodeEl.onkeydown = null
    nodeEl.contentEditable = false
    nodeEl.classList.remove('blocks-editing')
    this.cm.replaceRange(nodeEl.innerText, node.from, node.to)
    let lines = nodeEl.innerText.split('\n')
    node.to.line = node.from.line + lines.length - 1
    if (lines.length == 1) {
      node.to.ch = node.from.ch + nodeEl.innerText.length
    } else {
      node.to.ch = lines[lines.length-1].length
    }
  }

  editNode(node, nodeEl, event) {
    event.stopPropagation()
    nodeEl.contentEditable = true
    nodeEl.classList.add('blocks-editing')
    nodeEl.onblur = this.saveEdit.bind(this, node, nodeEl)
    nodeEl.onkeydown = function(e) {
      e.stopPropagation()
      e.codemirrorIgnore = true
      if (e.which == RETURN_KEY || e.which == TAB_KEY) {
        nodeEl.blur()
      }
    }
    let range = document.createRange()
    range.setStart(nodeEl, 0)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
  }

  handleDragStart(node, nodeEl, event) {
    event.stopPropagation()
    nodeEl.classList.add('blocks-dragging')
    event.dataTransfer.effectAllowed = 'move'
    //event.dataTransfer.setDragImage(nodeEl, -5, -5)
    event.dataTransfer.setData('text', this.cm.getRange(node.from, node.to))
  }

  handleDragEnter(node, nodeEl, event) {
    event.stopPropagation()
    event.target.classList.add('blocks-over-target')
  }

  handleDragLeave(node, nodeEl, event) {
    event.stopPropagation()
    event.target.classList.remove('blocks-over-target')
  }

  handleDrop(node, nodeEl, event) {
    event.codemirrorIgnore = true
    event.preventDefault()
    event.target.classList.remove('blocks-over-target')
  }

  didRenderNode(node, nodeEl) {
    switch (node.type) {
    case 'literal':
      nodeEl.ondblclick = this.editNode.bind(this, node, nodeEl)
      nodeEl.onclick = this.selectNode.bind(this, node, nodeEl)
      nodeEl.ondragstart = this.handleDragStart.bind(this, node, nodeEl)
      break
    case 'expression':
      nodeEl.onclick = this.selectNode.bind(this, node, nodeEl)
      nodeEl.ondragstart = this.handleDragStart.bind(this, node, nodeEl)
      let dropTargetEls = nodeEl.querySelectorAll('.blocks-drop-target')
      for (var i = 0; i < dropTargetEls.length; i++) {
        let el = dropTargetEls[i]
        el.ondragenter = this.handleDragEnter.bind(this, node, nodeEl)
        el.ondragleave = this.handleDragLeave.bind(this, node, nodeEl)
        el.ondrop = this.handleDrop.bind(this, node, nodeEl)
      }
      break
    }
  }

  handleKeyDown(e) {
  }

}