import render from './render';
import CodeMirror from 'codemirror';

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

function findNearestNodeEl(el) {
  while (el !== document.body && !el.classList.contains('blocks-node')) {
    el = el.parentNode;
  }
  if (el === document.body) {
    return null;
  }
  return el;
}

const MARKER = Symbol("codemirror-blocks-marker");

export class BlockMarker {
  constructor(cmMarker, options){
    this.cmMarker = cmMarker;
    this.options = options;
  }
  clear() {
    if (this.options.css) {
      this.cmMarker.replacedWith.style.cssText = '';
    }
    if (this.options.title) {
      this.cmMarker.replacedWith.title = '';
    }
    if (this.options.className) {
      this.cmMarker.replacedWith.classList.remove(this.options.className);
    }
    delete this.cmMarker[MARKER];
  }
  find() {
    return this.cmMarker.find();
  }
}

export default class CodeMirrorBlocks {
  constructor(cm, parser, {willInsertNode, didInsertNode, renderOptions} = {}) {
    this.cm = cm;
    this.parser = parser;
    this.willInsertNode = willInsertNode;
    this.didInsertNode = didInsertNode;
    this.renderOptions = renderOptions;
    this.ast = null;
    this.blockMode = false;
    this.undoKeys = [];
    this.redoKeys = [];
    this.keyMap = CodeMirror.keyMap[this.cm.getOption('keyMap')];

    Object.assign(
      this.cm.getWrapperElement(),
      {
        onkeydown: this.handleKeyDown.bind(this),
        onclick: this.nodeEventHandler(this.selectNode),
        ondblclick: this.nodeEventHandler({
          literal: this.editLiteral,
          whitespace: this.editWhiteSpace
        }),
        ondragstart: this.nodeEventHandler(this.startDraggingNode),
        ondragleave: this.nodeEventHandler(this.handleDragLeave),
        ondrop: this.nodeEventHandler(this.dropOntoNode)
      }
    );
    // TODO: don't do this, otherwise we copy/paste will only work
    // when there is one instance of this class on a page.
    Object.assign(document, {
      oncut: this.handleCopyCut.bind(this),
      oncopy: this.handleCopyCut.bind(this)
    });

    var dropHandler = this.nodeEventHandler(this.dropOntoNode, true);
    var dragEnterHandler = this.nodeEventHandler(this.handleDragEnter);
    this.cm.on('drop', (cm, event) => dropHandler(event));
    this.cm.on('dragenter', (cm, event) => dragEnterHandler(event));
    this.cm.on('change', this.handleChange.bind(this));
    this.cm.on('keydown', (cm, e) => this.handleKeyDown(e));
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

  markText(from, to, options) {
    let supportedOptions = new Set(['css','className','title']);
    let hasOptions = false;
    for (let option in options) {
      hasOptions = true;
      if (!supportedOptions.has(option)) {
        throw new Error(`option "${option}" is not supported by markText`);
      }
    }

    if (!hasOptions) {
      return; // noop
    }

    let marks = this.cm.findMarks(from, to);
    for (let mark of marks) {
      if (mark.replacedWith && mark.replacedWith.classList.contains('blocks-node')) {
        if (options.css) {
          mark.replacedWith.style.cssText = options.css;
        }
        if (options.className) {
          mark.replacedWith.className += ' '+options.className;
        }
        if (options.title) {
          mark.replacedWith.title = options.title;
        }
        mark[MARKER] = new BlockMarker(mark, options);
        return mark[MARKER]; // we should only find one that is a blocks-node
      }
    }
    // didn't find a codemirror mark, just pass through.
    this.cm.markText(from, to, options);
  }

  findMarks(from, to) {
    return this.cm.findMarks(from, to)
               .filter(mark => mark[MARKER])
               .map(mark => mark[MARKER]);
  }
  findMarksAt(pos) {
    return this.cm.findMarksAt(pos)
               .filter(mark => mark[MARKER])
               .map(mark => mark[MARKER]);
  }
  getAllMarks() {
    return this.cm.getAllMarks()
               .filter(mark => mark[MARKER])
               .map(mark => mark[MARKER]);
  }

  _clearMarks() {
    let marks = this.cm.findMarks({line: 0, ch: 0}, {line: this.cm.lineCount(), ch: 0});
    for (let mark of marks) {
      mark.clear();
    }
  }

  render() {
    this.ast = this.parser.parse(this.cm.getValue());
    this._clearMarks();
    for (let rootNode of this.ast.rootNodes) {
      render(rootNode, this.cm, this.renderOptions || {});
    }
  }

  getSelectedNode() {
    return this.findNodeFromEl(document.activeElement);
  }

  selectNode(node, event) {
    event.stopPropagation();
    node.el.focus();
    this.cm.scrollIntoView(node.from);
  }

  isNodeHidden(node) {
    return (node.el.classList.contains('blocks-hidden') ||
      node.el.matches('.blocks-hidden *'));
  }

  selectNextNode(event) {
    let nextNode = this.ast.getNodeAfter(this.getSelectedNode());
    while (this.isNodeHidden(nextNode)) {
      nextNode = this.ast.getNodeAfter(nextNode);
    }
    this.selectNode(nextNode, event);
  }

  selectPrevNode(event) {
    let prevNode = this.ast.getNodeBefore(this.getSelectedNode());
    while (this.isNodeHidden(prevNode)) {
      prevNode = this.ast.getNodeBefore(prevNode);
    }
    this.selectNode(prevNode, event);
  }

  handleCopyCut(event) {
    var activeEl = document.activeElement;
    if (!this.getSelectedNode()) {
      return;
    }
    var node = this.getSelectedNode();
    event.stopPropagation();
    var buffer = document.createElement('textarea');
    document.body.appendChild(buffer);
    buffer.style.opacity = "0";
    buffer.style.position = "absolute";
    buffer.innerText = this.cm.getRange(node.from, node.to);
    buffer.select();
    try {
      document.execCommand && document.execCommand(event.type);
    } catch (e) {
      console.error("execCommand doesn't work in this browser :(", e);
    }
    setTimeout(() => {
      activeEl.focus();
      buffer.parentNode && buffer.parentNode.removeChild(buffer);
    }, 200);
    if (event.type == 'cut') {
      this.cm.replaceRange('', node.from, node.to);
    }
  }

  saveEditableEl(nodeEl, text, range) {
    this.cm.replaceRange(text, range.from, range.to);
    nodeEl.onkeydown = null;
    nodeEl.contentEditable = false;
    nodeEl.classList.remove('blocks-editing');
    nodeEl.classList.remove('blocks-error');
  }

  checkEditableEl(nodeEl, text, range) {
    try {
      this.parser.lex(text);    // make sure the node itself is valid
      nodeEl.title = '';
      return true;
    } catch (e) {
      nodeEl.classList.add('blocks-error');
      try {
        nodeEl.title = this.parser.getExceptionMessage(e);
      } catch (e) {
        console.error(e);
      }
      console.error("result doesn't parse", e);
      return false;
    }
  }

  saveEdit(node, nodeEl, event) {
    event.preventDefault();
    if (this.checkEditableEl(nodeEl, nodeEl.innerText, node)) {
      this.saveEditableEl(nodeEl, nodeEl.innerText, node);
    }
  }

  editWhiteSpace(whiteSpaceEl, event) {
    event.stopPropagation();
    whiteSpaceEl.contentEditable = true;
    whiteSpaceEl.classList.add('blocks-editing');
    whiteSpaceEl.onblur = this.saveWhiteSpace.bind(this, whiteSpaceEl);
    whiteSpaceEl.onkeydown = function(e) {
      e.stopPropagation();
      e.codemirrorIgnore = true;
      let keyName = CodeMirror.keyName(e);
      if (keyName == "Enter" || keyName == "Tab") {
        e.preventDefault();
        whiteSpaceEl.blur();
      }
    };
    let range = document.createRange();
    range.setStart(whiteSpaceEl, 0);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  saveWhiteSpace(whiteSpaceEl) {
    var location = getLocationFromEl(whiteSpaceEl);
    var range = {from:location, to:location};
    if (this.checkEditableEl(whiteSpaceEl, ' '+whiteSpaceEl.innerText, range)) {
      this.saveEditableEl(whiteSpaceEl, ' '+whiteSpaceEl.innerText, range);
    }
  }

  editLiteral(node, event) {
    event.stopPropagation();
    node.el.contentEditable = true;
    node.el.classList.add('blocks-editing');
    node.el.onblur = this.saveEdit.bind(this, node, node.el);
    node.el.onkeydown = function(e) {
      e.stopPropagation();
      e.codemirrorIgnore = true;
      let keyName = CodeMirror.keyName(e);
      if (keyName == "Enter" || keyName == "Tab") {
        e.preventDefault();
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
    let node = this.getSelectedNode();
    if (node) {
      this.cm.replaceRange('', node.from, node.to);
    }
  }

  startDraggingNode(node, event) {
    event.stopPropagation();
    node.el.classList.add('blocks-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(node.el, -5, -5);
    event.dataTransfer.setData('text/plain', this.cm.getRange(node.from, node.to));
    event.dataTransfer.setData('text/id', node.id);
  }

  isDropTarget(el) {
    if (el.classList.contains('blocks-drop-target')) {
      return true;
    }
    var node = this.findNodeFromEl(el);
    if (node && node.type === 'literal') {
      return true;
    }
    return !node; // things outside of nodes are drop targets
  }

  handleDragEnter(node, event) {
    if (this.isDropTarget(event.target)) {
      event.stopPropagation();
      var el = node && this.isDropTarget(node.el) && node.el || event.target;
      el.classList.add('blocks-over-target');
    }
  }

  handleDragLeave(node, event) {
    if (this.isDropTarget(event.target)) {
      event.stopPropagation();
      event.target.classList.remove('blocks-over-target');
      if (node) {
        node.el.classList.remove('blocks-over-target');
      }
    }
  }

  findNodeFromEl(el) {
    el = findNearestNodeEl(el);
    if (el) {
      let match = el.id.match(/block-node-(.*)/);
      if (match && match.length > 1) {
        return this.ast.nodeMap.get(match[1]);
      }
    }
    return null;
  }

  dropOntoNode(destinationNode, event) {
    if (!this.isDropTarget(event.target)) {
      // not a drop taret, just return
      return;
    }
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
      if (destinationNode && destinationNode.type == 'literal') {
        if (this.cm.indexFromPos(sourceNode.from) < this.cm.indexFromPos(destinationNode.from)) {
          this.cm.replaceRange(sourceNodeText, destinationNode.from, destinationNode.to);
          this.cm.replaceRange('', sourceNode.from, sourceNode.to);
        } else {
          this.cm.replaceRange('', sourceNode.from, sourceNode.to);
          this.cm.replaceRange(sourceNodeText, destinationNode.from, destinationNode.to);
        }
      } else {
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
          this.cm.replaceRange(sourceNodeText, destination);
          this.cm.replaceRange('', sourceNode.from, sourceNode.to);
        } else {
          this.cm.replaceRange('', sourceNode.from, sourceNode.to);
          this.cm.replaceRange(sourceNodeText, destination);
        }
        if (this.didInsertNode) {
          this.didInsertNode(
            sourceNodeText,
            sourceNode,
            destination,
            destinationNode
          );
        }
      }
    });
  }

  handleKeyDown(event) {
    let keyName = CodeMirror.keyName(event);
    let capture = true;
    if (keyName == "Backspace") {
      if (this.getSelectedNode()) {
        this.deleteSelectedNodes();
      }
    } else if (keyName == "Tab") {
      this.selectNextNode(event);
    } else if (keyName == "Shift-Tab") {
      this.selectPrevNode(event);
    } else if (keyName == "Enter") {
      this.editLiteral(this.getSelectedNode(), event);
    } else {
      let command = this.keyMap[keyName];
      if (typeof command == "string") {
        this.cm.execCommand(command);
      } else if (typeof command == "function") {
        command(this.cm);
      } else {
        capture = false;
      }
    }
    if (capture) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  nodeEventHandler(handlers, callWithNullNode=false) {
    if (typeof handlers == 'function') {
      handlers = {default: handlers};
    }
    return function(event) {
      let node = this.findNodeFromEl(event.target);
      if (node || callWithNullNode) {
        if (event.target.classList.contains('blocks-white-space')) {
          // handle white space differently.
          if (handlers.whitespace) {
            handlers.whitespace.call(this, event.target, event);
            return;
          }
        }
        if (node && handlers[node.type]) {
          handlers[node.type].call(this, node, event);
          return;
        }
        if (handlers.default) {
          handlers.default.call(this, node, event);
          return;
        }
      }
    }.bind(this);
  }

}
