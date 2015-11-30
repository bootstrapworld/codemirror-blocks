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

    Object.assign(
      this.cm.getWrapperElement(),
      {
        onkeydown: this.handleKeyDown.bind(this),
        onclick: this.nodeEventHandler({
          whitespace: this.editWhiteSpace,
          default: this.toggleSelectNode
        }),
        ondblclick: this.nodeEventHandler({
          literal: this.editLiteral
        }),
        ondragstart: this.nodeEventHandler(this.startDraggingNode)
      }
    );
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

  toggleSelectNode(node, event) {
    if (this.selectedNodes.has(node)) {
      this.deselectNode(node, event);
    } else {
      this.selectNode(node, event);
    }
  }

  selectNode(node, event) {
    event.stopPropagation();
    node.el.classList.add('blocks-selected');
    this.selectedNodes.add(node);
  }

  deselectNode(node, event) {
    event.stopPropagation();
    node.el.classList.remove('blocks-selected');
    this.selectedNodes.delete(node);
  }

  saveEdit(node, nodeEl) {
    nodeEl.onkeydown = null;
    nodeEl.contentEditable = false;
    nodeEl.classList.remove('blocks-editing');
    this.cm.replaceRange(nodeEl.innerText, node.from, node.to);
  }

  editWhiteSpace(whiteSpaceEl, event) {
    event.stopPropagation();
    whiteSpaceEl.contentEditable = true;
    whiteSpaceEl.classList.add('blocks-editing');
    whiteSpaceEl.onblur = this.saveWhiteSpace.bind(this, whiteSpaceEl);
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

  editLiteral(node, event) {
    event.stopPropagation();
    node.el.contentEditable = true;
    node.el.classList.add('blocks-editing');
    node.el.onblur = this.saveEdit.bind(this, node, node.el);
    node.el.onkeydown = function(e) {
      e.stopPropagation();
      e.codemirrorIgnore = true;
      if (e.which == RETURN_KEY || e.which == TAB_KEY) {
        node.el.blur();
      }
    };
    let range = document.createRange();
    range.setStart(node.el, 0);
    range.setEnd(node.el, node.el.childNodes.length);
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

  startDraggingNode(node, event) {
    event.stopPropagation();
    node.el.classList.add('blocks-dragging');
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
    event.target.classList.remove('blocks-over-target');
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
    // TODO: figure out how to no-op more complicated changes that don't actually have any
    // impact on the AST.  For example, start with:
    //   (or #t #f)
    // then try to move the #f over one space. It should be a no-op.
    if ((destination.line == sourceNode.to.line && destination.ch == sourceNode.to.ch) ||
        (destination.line == sourceNode.from.line && destination.ch == sourceNode.from.ch)) {
      // destination is the same as source node location, so this should be a no-op.
      return;
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
    case 'expression':
      // set up drop targets
      let dropTargetEls = nodeEl.querySelectorAll(
        `#${nodeEl.id} > .blocks-args > .blocks-drop-target`);
      for (let i = 0; i < dropTargetEls.length; i++) {
        let el = dropTargetEls[i];
        el.ondragenter = this.handleDragEnter.bind(this, node, nodeEl);
        el.ondragleave = this.handleDragLeave.bind(this, node, nodeEl);
        el.ondrop = this.handleDrop.bind(this);
      }
    }
  }


  handleKeyDown(event) {
    if (event.which == DELETE_KEY) {
      event.preventDefault();
      this.deleteSelectedNodes();
    }
  }

  nodeEventHandler(handlers) {
    if (typeof handlers == 'function') {
      handlers = {default: handlers};
    }
    return function(event) {
      let node = this.findNodeFromEl(event.target);
      if (node) {
        if (event.target.classList.contains('blocks-white-space')) {
          // handle white space differently.
          if (handlers.whitespace) {
            handlers.whitespace.call(this, event.target, event);
            return;
          }
        }
        if (handlers[node.type]) {
          handlers[node.type].call(this, node, event);
          return;
        }
        if (handlers.default) {
          handlers.default.call(this, node, event);
        }
      }
    }.bind(this);
  }

}
