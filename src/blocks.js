import render from './render';

const RETURN_KEY = 13;
const TAB_KEY = 9;
const DELETE_KEY = 8;

function getLocationFromEl(el) {
  // TODO: it's kind of lame to have line and ch as attributes on random elements.
  let line = el.getAttribute('line');
  let ch = el.getAttribute('ch');
  if (line === null || ch === null) {
    // no location to get...
    return null;
  }
  return {
    line: parseInt(line),
    ch: parseInt(ch)
  };
}

export default class CodeMirrorBlocks {
  constructor(cm, parser, {willInsertNode, didInsertNode} = {}) {
    this.cm = cm;
    this.parser = parser;
    this.willInsertNode = willInsertNode;
    this.didInsertNode = didInsertNode;
    this.ast = null;
    this.blockMode = false;
    this.selectedNodes = new Set();
    this.cm.getWrapperElement().onkeydown = this.handleKeyDown.bind(this);
    this.cm.on('drop', (cm, event) => this.handleDrop(event));
    this.cm.on('change', this.handleChange.bind(this));
  }

  setBlockMode(mode) {
    if (mode === this.blockMode) {
      return;
    }
    this.blockMode = mode;
    if (this.blockMode) {
      this.render();
    } else {
      this.cm.getAllMarks().forEach(marker => marker.clear());
    }
  }

  toggleBlockMode() {
    this.setBlockMode(!this.blockMode);
  }

  handleChange() {
    if (this.blockMode) {
      this.render();
    }
  }

  _clearMarks() {
    let marks = this.cm.findMarks({line: 0, ch: 0}, {line: this.cm.lineCount(), ch: 0});
    for (let mark of marks) {
      mark.clear();
    }
  }

  render() {
    this.ast = this.parser.parse(this.cm.getValue());
    this.selectedNodes.clear();
    this._clearMarks();
    for (let rootNode of this.ast.rootNodes) {
      render(rootNode, this.cm, this.didRenderNode.bind(this));
    }
  }

  toggleSelectNode(node, nodeEl, event) {
    if (this.selectedNodes.has(node)) {
      this.deselectNode(node, nodeEl, event);
    } else {
      this.selectNode(node, nodeEl, event);
    }
  }

  selectNode(node, nodeEl, event) {
    event.stopPropagation();
    nodeEl.classList.add('blocks-selected');
    this.selectedNodes.add(node);
  }

  deselectNode(node, nodeEl, event) {
    event.stopPropagation();
    nodeEl.classList.remove('blocks-selected');
    this.selectedNodes.delete(node);
  }

  saveEdit(node, nodeEl) {
    nodeEl.onkeydown = null;
    nodeEl.contentEditable = false;
    nodeEl.classList.remove('blocks-editing');
    this.cm.replaceRange(nodeEl.innerText, node.from, node.to);
  }

  editWhiteSpace(whiteSpaceEl, node, nodeEl, event) {
    event.stopPropagation();
    whiteSpaceEl.contentEditable = true;
    whiteSpaceEl.classList.add('blocks-editing');
    whiteSpaceEl.onblur = this.saveWhiteSpace.bind(this, whiteSpaceEl, node, nodeEl);
    whiteSpaceEl.onkeydown = function(e) {
      e.stopPropagation();
      e.codemirrorIgnore = true;
      if (e.which == RETURN_KEY || e.which == TAB_KEY) {
        whiteSpaceEl.blur();
      }
    };
    let range = document.createRange();
    range.setStart(whiteSpaceEl, 0);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  saveWhiteSpace(whiteSpaceEl) {
    whiteSpaceEl.onkeydown = null;
    whiteSpaceEl.contentEditable = false;
    whiteSpaceEl.classList.remove('blocks-editing');
    var location = getLocationFromEl(whiteSpaceEl);
    this.cm.replaceRange(
      ' '+whiteSpaceEl.innerText, location, location);
  }

  editNode(node, nodeEl, event) {
    event.stopPropagation();
    nodeEl.contentEditable = true;
    nodeEl.classList.add('blocks-editing');
    nodeEl.onblur = this.saveEdit.bind(this, node, nodeEl);
    nodeEl.onkeydown = function(e) {
      e.stopPropagation();
      e.codemirrorIgnore = true;
      if (e.which == RETURN_KEY || e.which == TAB_KEY) {
        nodeEl.blur();
      }
    };
    let range = document.createRange();
    range.setStart(nodeEl, 0);
    range.setEnd(nodeEl, nodeEl.childNodes.length);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  deleteSelectedNodes() {
    let nodes = [...this.selectedNodes];
    nodes.sort((a,b) => this.cm.indexFromPos(b.from) - this.cm.indexFromPos(a.from));
    this.cm.operation(() => {
      for (let node of nodes) {
        this.cm.replaceRange('', node.from, node.to);
      }
    });
  }

  handleDragStart(node, nodeEl, event) {
    event.stopPropagation();
    nodeEl.classList.add('blocks-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', this.cm.getRange(node.from, node.to));
    event.dataTransfer.setData('text/id', node.id);
  }

  handleDragEnter(node, nodeEl, event) {
    event.stopPropagation();
    event.target.classList.add('blocks-over-target');
  }

  handleDragLeave(node, nodeEl, event) {
    event.stopPropagation();
    event.target.classList.remove('blocks-over-target');
  }

  findNodeFromEl(el) {
    while (el !== document.body && !el.classList.contains('blocks-node')) {
      el = el.parentNode;
    }
    let match = el.id.match(/block-node-(.*)/);
    if (match && match.length > 1) {
      return this.ast.nodeMap.get(match[1]);
    }
    return null;
  }

  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    let nodeId = event.dataTransfer.getData('text/id');
    if (!nodeId) {
      console.error("data transfer contains no node id. Not sure how to proceed.");
    }
    let sourceNode = this.ast.nodeMap.get(nodeId);
    if (!sourceNode) {
      console.error("node", nodeId, "not found in AST");
    }
    let sourceNodeText = this.cm.getRange(sourceNode.from, sourceNode.to);
    let destination = getLocationFromEl(event.target);
    if (!destination) {
      // event.target probably isn't a drop target, so just get the location from the event
      destination = this.cm.coordsChar({left:event.pageX, top:event.pageY});
      if (destination.outside) {
        sourceNodeText = '\n' + sourceNodeText;
      }
    }
    this.cm.operation(() => {
      let destinationNode = this.findNodeFromEl(event.target);
      if (this.willInsertNode) {
        // give client code an opportunity to modify the sourceNodeText before
        // it gets dropped in. For example, to add proper spacing
        sourceNodeText = this.willInsertNode(
          sourceNodeText,
          sourceNode,
          destination,
          destinationNode
        );
      }
      if (this.cm.indexFromPos(sourceNode.from) < this.cm.indexFromPos(destination)) {
        this.cm.replaceRange(sourceNodeText, destination, destination);
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
      } else {
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
        this.cm.replaceRange(sourceNodeText, destination, destination);
      }
      if (this.didInsertNode) {
        this.didInsertNode(
          sourceNodeText,
          sourceNode,
          destination,
          destinationNode
        );
      }
    });
  }

  didRenderNode(node, nodeEl) {
    switch (node.type) {
    case 'literal':
      nodeEl.ondblclick = this.editNode.bind(this, node, nodeEl);
      nodeEl.onclick = this.toggleSelectNode.bind(this, node, nodeEl);
      nodeEl.ondragstart = this.handleDragStart.bind(this, node, nodeEl);
      break;
    case 'expression':
      nodeEl.onclick = this.toggleSelectNode.bind(this, node, nodeEl);
      nodeEl.ondragstart = this.handleDragStart.bind(this, node, nodeEl);

      // set up drop targets
      let dropTargetEls = nodeEl.querySelectorAll(
        `#${nodeEl.id} > .blocks-args > .blocks-drop-target`);
      for (let i = 0; i < dropTargetEls.length; i++) {
        let el = dropTargetEls[i];
        el.ondragenter = this.handleDragEnter.bind(this, node, nodeEl);
        el.ondragleave = this.handleDragLeave.bind(this, node, nodeEl);
        el.ondrop = this.handleDrop.bind(this);
      }

      // set up white space
      let whiteSpaceEls = nodeEl.querySelectorAll(
        `#${nodeEl.id} > .blocks-args > .blocks-white-space`);
      for (let i = 0; i < whiteSpaceEls.length; i++) {
        let el = whiteSpaceEls[i];
        el.onclick = this.editWhiteSpace.bind(this, el, node, nodeEl);
      }
      break;
    }
  }

  handleKeyDown(event) {
    if (event.which == DELETE_KEY) {
      event.preventDefault();
      this.deleteSelectedNodes();
    }
  }

}
