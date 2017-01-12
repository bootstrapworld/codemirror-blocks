// TODO: move this file to CodeMirrorBlocks.js
import CodeMirror from 'codemirror';
import ee from 'event-emitter';
import Renderer from './Renderer';
import * as languages from './languages';
import * as ui from './ui';
import merge from './merge';
var beepSound = require('./beep.wav');

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

// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
function poscmp(a, b) { return a.line - b.line || a.ch - b.ch; }

function findNearestNodeEl(el) {
  while (el !== document.body && !el.classList.contains('blocks-node')) {
    el = el.parentNode;
  }
  if (el === document.body) {
    return null;
  }
  return el;
}

const BEEP = new Audio(beepSound);
function playBeep() {
  BEEP.pause();
  if(BEEP.readyState > 0){ BEEP.currentTime = 0; }
  // Resolves race condition. See https://stackoverflow.com/questions/36803176
  setTimeout(function () { BEEP.play(); }, 50);
}

const ISMAC = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)?true:false;
const MODKEY = ISMAC? "Alt" : "Ctrl";
const CTRLKEY = ISMAC? "Cmd" : "Ctrl";

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

export const EVENT_DRAG_START = 'dragstart';
export const EVENT_DRAG_END = 'dragend';

export default class CodeMirrorBlocks {
  static fromTextArea(textarea, language, options={}) {
    var blocks = new CodeMirrorBlocks(
      CodeMirror.fromTextArea(textarea),
      language,
      options
    );
    blocks.setBlockMode(true);
    return blocks;
  }

  static get languages() {
    return languages;
  }

  constructor(cm, languageOrParser, {toolbar, willInsertNode, didInsertNode, renderOptions} = {}) {
    if (typeof languageOrParser == 'string') {
      if (CodeMirrorBlocks.languages.getLanguage(languageOrParser)) {
        this.language = CodeMirrorBlocks.languages.getLanguage(languageOrParser);
        this.parser = this.language.getParser();
      } else {
        throw new Error(
          `Could not create CodeMirrorBlocks instance. Unknown language: "${languageOrParser}"`
        );
      }
    } else {
      this.language = null;
      this.parser = languageOrParser;
    }

    this.cm = cm;
    this.toolbarNode = toolbar; 
    this.willInsertNode = willInsertNode;
    this.didInsertNode = didInsertNode;
    this.renderOptions = renderOptions || {};
    this.ast = null;
    this.blockMode = false;
    this.keyMap = CodeMirror.keyMap[this.cm.getOption('keyMap')];
    this.events = ee({});
    this.wrapper = cm.getWrapperElement();
    this.wrapper.setAttribute("aria-label", "Text Editor");
    this.scroller = cm.getScrollerElement();
    // Add a live region to the wrapper, for error alerts
    this.announcements = document.createElement("span");
    this.announcements.setAttribute("role", "log");
    this.announcements.setAttribute("aria-live", "additions");
    this.wrapper.appendChild(this.announcements);
    // Track all selected nodes in our own set
    this.selectedNodes = new Set();
    // Offscreen buffer for copy/cut/paste operations
    this.buffer = document.createElement('textarea');
    this.buffer.style.opacity = 0;
    this.buffer.style.height = "1px";
    this.buffer.onchange = () => { this.buffer.value = "" }
    document.body.appendChild(this.buffer);

    if (this.language && this.language.getRenderOptions) {
      renderOptions = merge({}, this.language.getRenderOptions(), renderOptions);
    }
    this.renderer = new Renderer(this.cm, renderOptions);

    if (this.language) {
      this.wrapper.classList.add(`blocks-language-${this.language.id}`);
    }
    Object.assign(
      this.wrapper,
      {
        onkeydown: this.handleKeyDown.bind(this),
        onclick: this.nodeEventHandler(this.activateNode),
        ondblclick: this.nodeEventHandler({
          literal: this.editLiteral,
          blank: this.editLiteral,
          whitespace: this.editWhiteSpace
        }),
        onpaste: this.nodeEventHandler(this.handleTopLevelEntry),
        ondragstart: this.nodeEventHandler(this.startDraggingNode),
        ondragend: this.nodeEventHandler(this.stopDraggingNode),
        ondragleave: this.nodeEventHandler(this.handleDragLeave),
        ondrop: this.nodeEventHandler(this.dropOntoNode),
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
    this.cm.on('drop',      (cm, e) => dropHandler(e));
    this.cm.on('dragenter', (cm, e) => dragEnterHandler(e));
    this.cm.on('inputread', (cm, e) => this.handleKeyDown(e));
    this.cm.on('paste',     (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('keypress',  (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('mousedown', (cm, e) => {this.toggleDraggable(e); this.cancelIfErrorExists(e)});
    this.cm.on('mouseup',   (cm, e) => this.toggleDraggable(e));
    this.cm.on('dblclick',  (cm, e) => this.cancelIfErrorExists(e));
    this.cm.on('change',    this.handleChange.bind(this));
    this.cm.on('focus',     (cm, e) => {
      if(this.blockMode && !e.relatedTarget && this.ast.rootNodes
          && this.ast.rootNodes.length > 0) {  // bail if this is the result of a click 
        setTimeout(() => { this.activateNode(this.ast.rootNodes[0], e); }, 10);
      }
    });
  }

  on(event, listener) {
    this.events.on(event, listener);
  }

  off(event, listener) {
    this.events.off(event, listener);
  }

  emit(event, ...args) {
    this.events.emit(event, ...args);
  }

  say(text){
    let announcement = document.createTextNode(text);
    this.announcements.appendChild(announcement);
    console.log(text);
    setTimeout(() => this.announcements.removeChild(announcement), 500);
  }

  setBlockMode(mode) {
    if (mode === this.blockMode) {
      return;
    } else {
      this.blockMode = mode;
      if(mode) { 
        this.wrapper.setAttribute( "role", "tree"); 
        this.scroller.setAttribute("role", "group");
        this.wrapper.setAttribute("aria-label", "Block Editor");
        this.say("Switching to Block Mode");
      } else { 
        this.wrapper.removeAttribute( "role"); 
        this.scroller.removeAttribute("role");
        this.wrapper.setAttribute("aria-label", "Text Editor");
        this.say("Switching to Text Mode");
      }
      if(!this.ast) this.ast = this.parser.parse(this.cm.getValue());
      this.renderer.animateTransition(this.ast, mode);
    }
  }

  // FF & WK don't like draggable and contenteditable to mix, so we need
  // to turn draggable on and off based on mousedown/up events
  toggleDraggable(e) {
    if(e.target.draggable) {e.target.removeAttribute("draggable");} 
    else { e.target.setAttribute("draggable", true); }
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
    // find marks that are blocks, and apply the styling to node between [from, to]
    for (let mark of marks) {
      if (mark.replacedWith && mark.replacedWith.classList.contains('blocks-node')) {
        for(let node of mark.node){
          if((poscmp(from, node.from) < 1) && (poscmp(to, node.to) > -1)){
            if (options.css) {
              node.el.style.cssText = options.css;
            }
            if (options.className) {
              node.el.className += ' '+options.className;
            }
            if (options.title) {
              node.el.title = options.title;
            }
            mark[MARKER] = new BlockMarker(mark, options);
            return mark[MARKER]; // we should only find one that is a blocks-node
          }
        }
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
      this.renderer.render(rootNode);
    }
    ui.renderToolbarInto(this);
  }

  getActiveNode() {
    return this.findNearestNodeFromEl(document.activeElement);
  }

  activateNode(node, event) {
    if(node == this.getActiveNode()){
      this.say(node.el.getAttribute("aria-label"));
    }
    // if there's a selection and the altKey isn't pressed, clear selection
    if((this.selectedNodes.size > 0) && !event.altKey) { 
      this.clearSelection(); 
    }
    node.el.focus();
    this.scroller.setAttribute("aria-activedescendent", node.el.id);
    event.stopPropagation();
    this.cm.scrollIntoView(node.from);
  }

  isNodeHidden(node) {
    return (node.el.classList.contains('blocks-hidden') ||
      node.el.matches('.blocks-hidden *'));
  }

  _getNextUnhiddenNode(nextFn) {
    let nodeOrCursor = this.getActiveNode() || this.cm.getCursor();
    let nextNode = nextFn(nodeOrCursor);
    while (nextNode && this.isNodeHidden(nextNode)) {
      nextNode = nextFn(nextNode);
    }
    return nextNode || nodeOrCursor;
  }

  // if any nodes are selected, copy all of their text ranges to a buffer
  // copy the buffer to the clipboard. Remove the original text onCut
  handleCopyCut(event) {
    if (this.selectedNodes.size === 0) {
      return;
    }
    var activeEl = this.getActiveNode().el;
    event.stopPropagation();
    
    // copy the contents to the buffer first-to-last
    var sel = [...this.selectedNodes].sort((a,b) => poscmp(b.from, a.from));
    var clipboard = sel.reduce((s,n)=>s+this.cm.getRange(n.from, n.to)+" ","");
    this.buffer.value = clipboard;
    this.buffer.select();
    try {
      document.execCommand && document.execCommand(event.type);
    } catch (e) {
      console.error("execCommand doesn't work in this browser :(", e);
    }
    // put focus back on activeEl, and clear the buffer
    setTimeout(() => { activeEl.focus(); }, 200);
    if (event.type == 'cut') {
      // delete last-to-first to preserve the from/to indices
      sel.forEach(n => this.cm.replaceRange('', n.from, n.to));
      this.selectedNodes.clear(); // clear any pointers to the now-destroyed nodes
    }
    this.say((event.type == 'cut'? 'cut ' : 'copied ') + clipboard);
  }

  handlePaste(e) {
    let that = this, activeNode = this.getActiveNode();
    this.buffer.focus();
    setTimeout(() => {
      let data = that.buffer.value;
      if(that.selectedNodes.has(activeNode)) {
        activeNode.el.textContent = data;
        return this.editLiteral(activeNode, e);
      }
      this.cm.focus();
      this.cm.setCursor(activeNode.from);
      this.insertionQuarantine(data, e);
    }, 50);
  }

  saveEditableEl(nodeEl, text, range) {
    // See http://stackoverflow.com/questions/21926083/failed-to-execute-removechild-on-node
    // we have to remove the onblur handler first
    // because the blur event will fire *again* when the node is removed from the dom
    // which happens in this.cm.replaceRange.
    nodeEl.onblur = null;
    nodeEl.onkeydown = null;
    nodeEl.contentEditable = false;
    nodeEl.classList.remove('blocks-editing');
    nodeEl.classList.remove('blocks-error');
    this.cm.replaceRange(text, range.from, range.to);
  }

  checkEditableEl(nodeEl, text) {
    try {
      this.parser.lex(text);    // make sure the node itself is valid
      nodeEl.title = '';
      return true;
    } catch (e) {
      nodeEl.classList.add('blocks-error');
      let errorTxt = this.parser.getExceptionMessage(e);
      try {
        nodeEl.title = errorTxt;
        this.say(errorTxt);
      } catch (e) {
        console.error(e);
      }
      return false;
    }
  }

  saveEdit(node, nodeEl, event) {
    event.preventDefault();
    if (this.checkEditableEl(nodeEl, nodeEl.innerText)) {
      if(node.quarantine){
        nodeEl.innerText += " "; // add space to avoid merging with nextSibling
        node.quarantine.clear(); // get rid of the quarantine bookmark
      }
      this.saveEditableEl(nodeEl, nodeEl.innerText, node);
      this.hasInvalidEdit = false;
      this.say("saved "+nodeEl.innerText);
    } else {
      // If the node doesn't parse, wrest the focus back after a few ms
      setTimeout(() => { this.editLiteral(node, event); }, 50);
      this.hasInvalidEdit = true;
    }
  }

  editWhiteSpace(whiteSpaceEl, event) {
    event.stopPropagation();
    whiteSpaceEl.contentEditable = true;
    whiteSpaceEl.classList.add('blocks-editing');
    whiteSpaceEl.onblur = this.saveWhiteSpace.bind(this, whiteSpaceEl);
    whiteSpaceEl.onkeydown = this.handleEditKeyDown.bind(whiteSpaceEl);
    let range = document.createRange();
    range.setStart(whiteSpaceEl, 0);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  saveWhiteSpace(whiteSpaceEl) {
    var location = getLocationFromEl(whiteSpaceEl);
    var range = {from:location, to:location};
    if (this.checkEditableEl(whiteSpaceEl, ' '+whiteSpaceEl.innerText)) {
      this.saveEditableEl(whiteSpaceEl, ' '+whiteSpaceEl.innerText, range);
    }
  }

  handleEditKeyDown(e) {
    e.stopPropagation();
    e.codemirrorIgnore = true;
    let keyName = CodeMirror.keyName(e);
    if (["Enter", "Tab", "Esc"].includes(keyName)) {
      if(keyName === "Esc") { this.innerText = this.oldText || ""; }
      e.preventDefault();
      this.blur();
    }
  }

  editLiteral(node, event) {
    node.el.draggable = false; // defend against webkit
    console.log('starting editLiteral. draggable is ', node.el.draggable);
    event.stopPropagation();
    this.say("editing "+node.el.getAttribute("aria-label"));
    node.el.oldText = this.cm.getRange(node.from, node.to);
    console.log('setting class, contentEditable and blur/key events');
    node.el.contentEditable = true;
    node.el.classList.add('blocks-editing');
    node.el.onblur = this.saveEdit.bind(this, node, node.el);
    node.el.onkeydown = this.handleEditKeyDown.bind(node.el);
    let range = document.createRange();
    range.setStart(node.el, node.quarantine? 1 : 0);
    range.setEnd(node.el, node.el.children.length);
    console.log('built range: ', range);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    node.el.focus();
  }

  // remove node contents from CM
  deleteNode(node) {
    if (node) {
      this.cm.replaceRange('', node.from, node.to);
    }
  }

  deleteNodeWithId(nodeId) {
    this.deleteNode(this.ast.nodeMap.get(nodeId));
  }

  // empty the selection, and delete all the nodes
  deleteSelectedNodes() {
    let nodeCount = this.selectedNodes.size;
    this.selectedNodes.forEach(n => this.deleteNode(n));
    this.selectedNodes.clear();
    this.say("deleted "+nodeCount+" item"+(nodeCount==1? "" : "s"));
  }

  startDraggingNode(node, event) {
    event.stopPropagation();
    node.el.classList.add('blocks-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(node.el, -5, -5);
    event.dataTransfer.setData('text/plain', this.cm.getRange(node.from, node.to));
    event.dataTransfer.setData('text/id', node.id);
    this.emit(EVENT_DRAG_START, this, node, event);
  }

  stopDraggingNode(node, event) {
    node.el.classList.remove('blocks-dragging');
    this.emit(EVENT_DRAG_END, this, node, event);
  }

  isDropTarget(el) {
    if (el.classList.contains('blocks-drop-target')) {
      return true;
    }
    var node = this.findNearestNodeFromEl(el);
    if (node && ['literal', 'blank'].includes(node.type)) {
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

  // return the AST node that exactly matches the element, or null
  findNodeFromEl(el) {
    if(el) {
      let match = el.id.match(/block-node-(.*)/);
      return match && (match.length > 1) && this.ast.nodeMap.get(match[1]);
    }
  }
  // return the AST node that best matches the element, or null
  findNearestNodeFromEl(el) {
    return this.findNodeFromEl(findNearestNodeEl(el));
  }

  dropOntoNode(_, event) {
    this.emit(EVENT_DRAG_END, this, event);
    if (!this.isDropTarget(event.target)) {
      // not a drop taret, just return
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('blocks-over-target');
    // look up the source information: ID, text, JSON, and the node itself
    let sourceId       = event.dataTransfer.getData('text/id');
    let sourceNodeText = event.dataTransfer.getData('text/plain');
    let sourceNodeJSON = event.dataTransfer.getData('text/json');
    let sourceNode     = this.ast.nodeMap.get(sourceId);
    if (sourceNode) {
      sourceNodeText = this.cm.getRange(sourceNode.from, sourceNode.to);
    } else if (sourceNodeJSON) {
      sourceNode = JSON.parse(sourceNodeJSON);
    } else if (!sourceNodeText) {
      console.error("data transfer contains no node id/json/text. Not sure how to proceed.");
    }

    // look up the destination information: ID, Node, destFrom and destTo    
    let destinationNode = this.findNodeFromEl(event.target);        // when dropping onto an existing node, get that Node
    let destFrom        = (destinationNode && destinationNode.from) // if we have an existing node, use its start location
                        || getLocationFromEl(event.target)          // if we have a drop target, grab that location
                        || this.cm.coordsChar({left:event.pageX, top:event.pageY}); // give up and ask CM for the cursor location
    let destTo        = (destinationNode && destinationNode.to) || destFrom; // destFrom = destTo for insertion
    // if we're coming from outside
    if (destFrom.outside) {
      sourceNodeText = '\n' + sourceNodeText;
    }

    // check for no-ops
    // TODO: figure out how to no-op more complicated changes that don't actually have any
    // impact on the AST.  For example, start with:
    //   (or #t #f)
    //   then try to move the #f over one space. It should be a no-op.  
    if (sourceNode &&                                   // If there's a sourceNode, &
        (poscmp(destFrom, sourceNode.from) > -1) &&     // dest range is in-between source range,
        (poscmp(destTo,   sourceNode.to  ) <  1)) {     // it's a no-op.
      return;
    } 
    // if we're inserting/replacing from outsider the editor, just do it and return
    if (!sourceNode) {
      this.cm.replaceRange(sourceNodeText, destFrom, destTo);
      return;
    }

    // if f is defined and the destination is a non-literal node, apply it
    // otherwise return the sourceNodeText unmodified
    function maybeApplyClientFn(f) {
      return (f && !(destinationNode && destinationNode.type == "literal"))? 
        f(sourceNodeText, sourceNode, destFrom, destinationNode) : sourceNodeText;
    }

    // Call willInsertNode and didInsertNode on either side of the replacement operation
    // if we're not replacing a literal
    this.cm.operation(() => {
      sourceNodeText = maybeApplyClientFn(this.willInsertNode);
      if (poscmp(sourceNode.from, destFrom) < 0) {
        this.cm.replaceRange(sourceNodeText, destFrom, destTo);
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
      } else {
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
        this.cm.replaceRange(sourceNodeText, destFrom, destTo);
      }
      maybeApplyClientFn(this.didInsertNode);
    });
  }

  handleTopLevelEntry(e) {
    if(!this.blockMode) return;                           // bail if mode==false
    e.preventDefault();
    this.clearSelection();                                // clear the previous selection
    let text = (e.type == "keypress")? String.fromCharCode(e.which)
             : e.clipboardData.getData('text/plain');
    this.insertionQuarantine(text, e);    
  }

  insertionQuarantine(text, e) {
    let cur  = this.cm.getCursor();
    let ws = "\n".repeat(cur.line) + " ".repeat(cur.ch);  // make filler whitespace
    let ast  = this.parser.parse(ws + "x");               // make a fake literal
    let node = ast.rootNodes[0];                          // get its node and render it
    this.renderer.render(node, this.cm, this.renderOptions || {});
    node.el.innerText = text;                             // replace "x" with the real string
    node.to.ch = node.from.ch;                            // force the width to be zero
    let mk = this.cm.setBookmark(cur, {widget: node.el}); // add the node as a bookmark
    node.quarantine = mk;                                 // store the marker in the node
    setTimeout(() => { this.editLiteral(node, e); }, 50); // give the DOM a few ms, then edit
  }

  handleKeyDown(event) {
    if(!this.blockMode) return;                           // bail if mode==false
    let keyName = CodeMirror.keyName(event);
    let activeNode = this.getActiveNode();
    let arrowHandlers = {
      37: this.ast.getParent,
      39: this.ast.getChild,
      38: this.ast.getPrevSibling,
      40: this.ast.getNextSibling
    };
    // Arrows can move the active element, modify the selection
    if(arrowHandlers[event.keyCode] && activeNode) {
      let searchFn = arrowHandlers[event.keyCode].bind(this.ast);
      let nextNode = this._getNextUnhiddenNode(searchFn);
      if(nextNode === activeNode){ playBeep(); }
      this.activateNode(nextNode, event);
    } 
    // Enter should toggle editing
    else if (keyName == "Enter" && activeNode &&
        ["literal", "blank"].includes(activeNode.type)) {
      this.editLiteral(activeNode, event);
    }
    // Space clears selection and selects active node
    else if (keyName == "Space" && activeNode) {
      if(this.selectedNodes.has(activeNode)) { 
        this.clearSelection();
      } else {
        this.clearSelection();
        this.addToSelection(activeNode);
      }
    }
    // Mod-Space toggles node selection, preserving earlier selection
    else if (keyName == (MODKEY+"-Space") && activeNode) {
      if(this.selectedNodes.has(activeNode)) { 
        this.removeFromSelection(activeNode);
      } else {
        this.addToSelection(activeNode);
      }
    }
    // Backspace should delete selected nodes
    else if (keyName == "Backspace" && this.selectedNodes.size > 0) {
      this.deleteSelectedNodes();
    } 
    // Ctrl-[ and Ctrl-] move cursor outside of block
    else if (keyName === "Ctrl-[" && activeNode) {
      this.cm.focus();
      this.cm.setCursor(activeNode.from);
    }
    else if (keyName === "Ctrl-]" && activeNode) {
      this.cm.focus();
      this.cm.setCursor(activeNode.to);
    }
    // shift focus to buffer for the *real* paste event to fire
    // then replace or insert, then reset the buffer
    else if (keyName == CTRLKEY+"-V" && activeNode) {
      return this.handlePaste(event);
    }
    // Tab and Shift-Tab work no matter what
    else if (keyName === "Tab") {
      let searchFn = this.ast.getNodeAfter.bind(this.ast);
      this.activateNode(this._getNextUnhiddenNode(searchFn), event);
    } else if (keyName === "Shift-Tab") {
      let searchFn = this.ast.getNodeBefore.bind(this.ast);
      this.activateNode(this._getNextUnhiddenNode(searchFn), event);
    } else {
      let command = this.keyMap[keyName];
      if (typeof command == "string") {
        this.cm.execCommand(command);
      } else if (typeof command == "function") {
        command(this.cm);
      } else {
        return; // return without cancelling the event
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  // unset the aria attribute, and remove the node from the set
  removeFromSelection(node, speakEachOne=true) {
    this.selectedNodes.delete(node);
    if(speakEachOne) {
      this.say(node.options["aria-label"]+" unselected");
    }
    node.el.setAttribute("aria-selected", "false");
  }

  // add the node to the selected set, and set the aria attribute
  // make sure selectedNodes never contains a child and its ancestor
  addToSelection(node) {
    // if this is an ancestor of nodes in the set, remove them first
    this.selectedNodes.forEach(n => {
      if(node.el.contains(n.el)) { this.removeFromSelection(n); }
    });
    // bail if an ancestor is already in the set
    var ancestor = false;
    this.selectedNodes.forEach(n => ancestor = ancestor || n.el.contains(node.el));
    if(ancestor) {
      this.say("an ancestor is already selected");
      return true;
    }
    node.el.setAttribute("aria-selected", true);
    this.selectedNodes.add(node);
  }

  // unset the aria attribute, and empty the set
  clearSelection() {
    if(this.selectedNodes.size > 0){
      this.selectedNodes.forEach((n) => this.removeFromSelection(n, false));
      this.say("selection cleared");
    } 
  }

  cancelIfErrorExists(event) {
    if(this.hasInvalidEdit){
      event.preventDefault();
      event.stopPropagation();
    }
  }

  nodeEventHandler(handlers, callWithNullNode=false) {
    if (typeof handlers == 'function') {
      handlers = {default: handlers};
    }
    return function(event) {
      let node = this.findNearestNodeFromEl(event.target);
      if (node || callWithNullNode) {
        if (event.target.classList.contains('blocks-white-space')) {
          // handle white space differently.
          if (handlers.whitespace) {
            handlers.whitespace.call(this, event.target, event);
            return;
          }
        }
        if(event.target.classList.contains('blocks-blank')) {
          if(event.type == "dragstart"){
            event.stopPropagation();
            return false;
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
