// TODO: move this file to CodeMirrorBlocks.js
import CodeMirror from 'codemirror';
import ee from 'event-emitter';
import Renderer from './Renderer';
import * as languages from './languages';
import * as ui from './ui';
import merge from './merge';
import {playSound, BEEP} from './sound';
import {poscmp} from './utils';
import {ISMAC, MODKEY, CTRLKEY, LEFT, RIGHT, DOWN, UP} from './keycode';

// findNearestNodeEl : DOM -> DOM
// Consumes a DOM node, and produces the ancestor associated
// with an ASTNode
function findNearestNodeEl(el) {
  while (el !== document.body && !el.classList.contains('blocks-node')) {
    el = el.parentNode;
  }
  return el === document.body? null : el;
}

// FF & WK don't like draggable and contenteditable to mix, so we need
// to turn draggable on and off based on mousedown/up events
function toggleDraggable(node) {
  if(node.el.draggable) {node.el.removeAttribute("draggable");} 
  else { node.el.setAttribute("draggable", true); }
}

// open/close delimeters
const openDelims = ["(","[","{"];
const closeDelims = {"(": ")", "[":"]", "{": "}"};

// CM options we want to save/restore
const cmOptions = ["readOnly", "viewportMargin"];

const MARKER = Symbol("codemirror-blocks-marker");
export class BlockMarker {
  constructor(cmMarker, options, node){
    this.cmMarker = cmMarker;
    this.options = options;
    this.nodeEl = node.el;
  }
  clear() {
    if (this.options.css) {
      this.nodeEl.style.cssText = '';
    }
    if (this.options.title) {
      this.nodeEl.title = '';
    }
    if (this.options.className) {
      this.nodeEl.classList.remove(this.options.className);
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

  constructor(cm, languageOrParser, {toolbar, search, willInsertNode, didInsertNode, renderOptions} = {}) {
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
    this.searchNode = search;
    this.willInsertNode = willInsertNode;
    this.didInsertNode = didInsertNode;
    this.renderOptions = renderOptions || {lockNodesOfType: []};
    this.ast = null;
    this.blockMode = false;
    this.keyMap = CodeMirror.keyMap[this.cm.getOption('keyMap')];
    this.events = ee({});
    this.scroller = cm.getScrollerElement();
    this.wrapper = cm.getWrapperElement();
    this.wrapper.setAttribute("aria-label", "Text Editor");
    // Add a live region to the wrapper, for announcements
    this.announcements = document.createElement("span");
    this.announcements.setAttribute("role", "log");
    this.announcements.setAttribute("aria-live", "assertive");
    this.wrapper.appendChild(this.announcements);
    // Track all selected nodes in our own set
    this.selectedNodes = new Set();
    // Track focus and history with path/announcement pairs
    this.focusHistory = {done: [], undone: []};
    this.focusPath = {line: 0, ch: 0}; // default to empty editor with no blocks
    // Internal clipboard for non-native operations (*groan*)
    this.clipboard = "";
    // Make (and hide!) an offscreen buffer for handling native copy/cut/paste operations.
    this.buffer = document.createElement('textarea');
    Object.assign(this.buffer.style, {"opacity": 0, "height": "1px"});
    Object.assign(this.buffer, {"ariaHidden": true, "tabIndex": -1});
    document.body.appendChild(this.buffer);
    // disable Tab and Shift-Tab key handling by appending to extraKeys
    let extraKeys = this.cm.getOption('extraKeys') || {};
    extraKeys["Tab"] = extraKeys["Shift-Tab"] = false;
    this.cm.setOption('extraKeys', extraKeys);
    // add render options, if they exist
    if (this.language && this.language.getRenderOptions) {
      renderOptions = merge({}, this.language.getRenderOptions(), renderOptions);
    }
    this.renderer = new Renderer(this.cm, renderOptions);
    // assign language class, to enable per-language styling
    if (this.language) {
      this.wrapper.classList.add(`blocks-language-${this.language.id}`);
    }
    Object.assign(
      this.wrapper,
      {
        onkeydown:    ((n, e) => this.handleKeyDown(n, e)),
        onmousedown:  this.nodeEventHandler(toggleDraggable),
        onclick:      this.nodeEventHandler(this.activateNode),
        ondblclick:   this.nodeEventHandler({
          literal:      (n => this.makeQuarantineAt(false, n)),
          blank:        (n => this.makeQuarantineAt(false, n)),
          whitespace:   (n => this.makeQuarantineAt("", n))
        }),
        ondragstart:  this.nodeEventHandler(this.startDraggingNode),
        ondragend:    this.nodeEventHandler(this.stopDraggingNode),
        ondragleave:  this.nodeEventHandler(this.handleDragLeave),
        ondrop:       this.nodeEventHandler(this.dropOntoNode),
      }
    );

    // TODO: don't do this, otherwise we copy/paste will only work
    // when there is one instance of this class on a page.
    Object.assign(document, {
      oncut:  (n, e) => this.handleCopyCut(n, e),
      oncopy: (n, e) => this.handleCopyCut(n, e),
    });

    var dropHandler = this.nodeEventHandler(this.dropOntoNode, true);
    var dragEnterHandler = this.nodeEventHandler(this.handleDragEnter);
    this.cm.on('drop',      (cm, e) => dropHandler(e));
    this.cm.on('dragenter', (cm, e) => dragEnterHandler(e));
    this.cm.on('keydown',   (cm, e) => this.handleKeyDown(e));
    this.cm.on('paste',     (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('keypress',  (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('dblclick',  (cm, e) => this.cancelIfErrorExists(e));
    this.cm.on('changes',   (cm, e) => this.handleChange(cm, e));
    // mousedown events should impact dragging, focus-if-error, and click events
    this.cm.on('mousedown', (cm, e) => {
      this.cancelIfErrorExists(e);
      this.mouseUsed = true;
      setTimeout(() => this.mouseUsed = false, 200);
    });
    // If a block was active, restore focus. Otherwise let CM handle it
    // FIXME: we should handle ALL focus events, now that focusPath can be a cursor
    this.cm.on('focus',     (cm, e) => {
      if(this.blockMode && !this.mouseUsed) {
        setTimeout(() => {
          console.log('this.focusPath=', this.focusPath);
          if(this.focusPath.line===undefined) this.activateNode(this.ast.getNodeByPath(this.focusPath), e); 
        }, 10);
      }
    });

    ui.renderSearchInto(this);
  }

  // utility functions
  getBeginCursor = () => CodeMirror.Pos(this.cm.firstLine(), 0)
  getEndCursor = () => CodeMirror.Pos(this.cm.lastLine(), this.cm.getLine(this.cm.lastLine()).length)
  getFirstNode = () => this.ast.getNodeAfterCur(this.getBeginCursor());
  getLastNode = () => this.ast.getNodeBeforeCur(this.getEndCursor());

  on(event, listener) {
    this.events.on(event, listener);
  }

  off(event, listener) {
    this.events.off(event, listener);
  }

  emit(event, ...args) {
    this.events.emit(event, ...args);
  }

  // called anytime we update the underlying CM value
  // destroys the redo history and updates the undo history
  commitChange(changes, announcement=false) {
    console.log('committing change. saving focus at ' + this.focusPath);
    this.focusHistory.done.unshift({path: this.focusPath, announcement: announcement});
    this.focusHistory.undone = [];
    this.cm.operation(changes);
    if (announcement) this.say(announcement);
  }

  // muting and unmuting, to cut down on chattier compound operations
  mute()   { this.muteAnnouncements = true; }
  unmute() { this.muteAnnouncements = false; }

  // say : String Number -> Void
  // add text to the announcements element, and log it to the console
  // append a comma to distinguish between adjacent commands
  say(text, delay=200){
    if(this.muteAnnouncements) return;
    let announcement = document.createTextNode(text+", ");
    console.log(text);
    setTimeout(() => this.announcements.appendChild(announcement), delay);
    setTimeout(() => this.announcements.removeChild(announcement), delay+300);
  }

  // setBlockMode : String -> Void
  // Toggle CM attributes, and announce the mode change
  setBlockMode(mode) {
    if (mode === this.blockMode) { return; } // bail if there's no change
    this.blockMode = mode;
    if(mode) {
      this.savedOpts = {}
      cmOptions.forEach(opt => this.savedOpts[opt] = this.cm.getOption(opt));
      this.wrapper.setAttribute( "role", "tree"); 
      this.scroller.setAttribute("role", "presentation");
      this.wrapper.setAttribute("aria-label", "Block Editor");
      this.say("Switching to Block Mode");
      this.ast = this.parser.parse(this.cm.getValue());
    } else {
      cmOptions.forEach(opt => this.cm.setOption(opt, this.savedOpts[opt]));
      this.wrapper.removeAttribute( "role"); 
      this.scroller.removeAttribute("role");
      this.wrapper.setAttribute("aria-label", "Text Editor");
      this.say("Switching to Text Mode");
    }
    this.renderer.animateTransition(this.ast, mode);
  }

  toggleBlockMode() { this.setBlockMode(!this.blockMode); }

  // handleChange : CM CM-Change-Events -> Void
  // if blocks mode is enabled, re-render the blocks
  handleChange(_, changes) { if (this.blockMode) this.render(changes); }

  markText(from, to, options) {
    let supportedOptions = new Set(['css','className','title']);
    let hasOptions = false;
    for (let option in options) {
      hasOptions = true;
      if (!supportedOptions.has(option)) {
        throw new Error(`option "${option}" is not supported by markText`);
      }
    }

    if (!hasOptions) { return; } // noop

    let marks = this.cm.findMarks(from, to);
    // find blocks between [from, to], and apply the styling to node
    for (let mark of marks) {
      if (mark.replacedWith && mark.node) {
        let nodes = this.ast.getNodesBetween(from, to);
        return nodes.map(node => {
          if (options.css) {
            node.el.style.cssText = options.css;
          }
          if (options.className) {
            node.el.className += ' '+options.className;
          }
          if (options.title) {
            node.el.title = options.title;
          }
          mark[MARKER] = new BlockMarker(mark, options, node);
          return mark[MARKER];
        });
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

  // render : [Changes] -> Void
  // re-parse the document, then (ideally) patch and re-render the resulting AST
  render(changes) {
    let start = Date.now();
    let newAST = this.parser.parse(this.cm.getValue());
    this.cm.operation(() => {
      // try to patch the AST, and conservatively mark only changed nodes as dirty
      try{
        this.ast = this.ast.patch(s => this.parser.parse(s), newAST, changes);
      // patching failed! log an error, and treat *all* nodes as dirty
      } catch(e) {
        console.error('PATCHING ERROR!!', changes, e);
        this.ast = newAST;
        this.ast.dirtyNodes = this.ast.rootNodes;
      // render all the dirty nodes, and reset the cursor
      } finally {
        this.ast.dirtyNodes.forEach(n => this.renderer.render(n)); 
        setTimeout(() => {
          delete this.ast.dirtyNodes; // remove dirty nodeset, now that they've been rendered
          this.cm.focus();            // focus the editor, now on the current block
        }, 250);
      }
    });
    ui.renderToolbarInto(this);
    console.log('re-render time: '+(Date.now() - start)/1000 + 'ms');
  }

  // getActiveNode : Void -> ASTNode
  // get the ASTNode corresponing to the currently-active DOMNode
  getActiveNode() {
    return this.findNearestNodeFromEl(document.activeElement);
  }

  // activateNode : ASTNode Event -> Boolean
  // activate and announce the given node, optionally changing selection
  activateNode(node, event) {
    event.stopPropagation();
    if(node == this.getActiveNode()) { this.say(node.el.getAttribute("aria-label")); }
    if(this.isNodeEditable(node) && !(node.el.getAttribute("aria-expanded")=="false")
      && !node.el.classList.contains("blocks-editing")) {
      clearTimeout(this.queuedAnnoucement);
      this.queuedAnnoucement = setTimeout(() => { this.say("Use enter to edit"); }, 1250);
    } 
    // if there's a selection and the altKey isn't pressed, clear selection
    if((this.selectedNodes.size > 0) && !(ISMAC? event.altKey : event.ctrlKey)) { 
      this.clearSelection(); 
    }
    this.scroller.setAttribute("aria-activedescendent", node.el.id);
    // if it's not a click, make sure the viewport is scrolled so the node is visible
    if(!["click", "dblclick"].includes(event.type)) {
      this.cm.scrollIntoView(node.from); // force a CM render
      var {top, bottom, left, right} = node.el.getBoundingClientRect(); // get the *actual* bounding rect
      let offset = this.wrapper.getBoundingClientRect();
      let scroll = this.cm.getScrollInfo();
      top    = top    + scroll.top  - offset.top; 
      bottom = bottom + scroll.top  - offset.top;
      left   = left   + scroll.left - offset.left; 
      right  = right  + scroll.left - offset.left;
      this.cm.scrollIntoView({top, bottom, left, right});
    }
    node.el.focus();
    this.focusPath = node.path;
    return true;
  }
  // is this a node that can be collapsed or expanded?
  isNodeExpandable(node) {
    return !["blank", "literal", "comment"].includes(node.type) && 
         !node.el.getAttribute("aria-disabled");
  }
  isNodeEditable(node) {
    return ["blank", "literal"].includes(node.type);
  }
  // are any of the node's ancestors collapsed?
  isNodeHidden(node) {
    return node.el.matches('[aria-expanded="false"] *');
  }
  // is the node itself - or any of its ancestors - locked?
  isNodeLocked(node) {
    return node.el.matches('[aria-disabled="true"], [aria-disabled="true"] *');
  }
  // is the node a drop target or a top-level CM element?
  isDropTarget(el) {
    let node = this.findNearestNodeFromEl(el);
    return el.classList.contains('blocks-drop-target') 
      || (node && this.isNodeEditable(node))
      || !node; // things outside of nodes are drop targets
  }
  // If it's an expandable node, set to makeExpanded (or toggle)
  // return true if there's been a change
  maybeChangeNodeExpanded(node, makeExpanded) {
    if(!this.isNodeExpandable(node)) return false;
    // treat anything other than false as true (even undefined)
    let isExpanded = !(node.el.getAttribute("aria-expanded")=="false");
    if(makeExpanded !== isExpanded) { node.el.setAttribute("aria-expanded", !isExpanded); }
    return makeExpanded !== isExpanded;
  }
  // used for lightweigh refresh when the AST hasn't changed
  refreshCM(cur){
    this.cm.refresh(); 
    this.cm.scrollIntoView(cur);
    return true;
  }
  // handleCopyCut : Event -> Void
  // if any nodes are selected, copy all of their text ranges to a buffer
  // copy the buffer to the clipboard. Remove the original text onCut
  handleCopyCut(event) {
    event.stopPropagation();
    let activeNode = this.getActiveNode();
    if(!activeNode) return;

    // If nothing is selected, say "nothing selected" for cut
    // or copy the clipboard to the text of the active node
    if(this.selectedNodes.size === 0) {
      if(event.type == 'cut') {
        this.say("Nothing selected");
        return;
      } else if(event.type == 'copy') {
        this.clipboard = this.cm.getRange(activeNode.from, activeNode.to);
      }
    // Otherwise copy the contents of selection to the buffer, first-to-last
    } else {
      let sel = [...this.selectedNodes].sort((a, b) => poscmp(a.from, b.from));
      this.clipboard = sel.reduce((s,n) => s + this.cm.getRange(n.from, n.to)+" ","");
    }

    this.say((event.type == 'cut'? 'cut ' : 'copied ') + this.clipboard);
    this.buffer.value = this.clipboard;
    this.buffer.select();
    try {
      document.execCommand && document.execCommand(event.type);
    } catch (e) {
      console.error("execCommand doesn't work in this browser :(", e);
    }
    // if we cut selected nodes, clear them
    if (event.type == 'cut') { this.deleteSelectedNodes(); } // delete all those nodes if we're cutting
    else { activeNode.el.focus(); }                          // just restore the focus if we're copying
  }

  // handlePaste : Event -> Void
  // paste to a hidden buffer, then grab the text and deal with it manually
  handlePaste(e) {
    let that = this, activeNode = this.getActiveNode();
    this.mute();
    this.buffer.focus();
    setTimeout(() => {
      let text = that.buffer.value || this.clipboard;
      let dest = (that.selectedNodes.has(activeNode) && activeNode)   // we're either replacing a selected node
           || (!e.shiftKey && activeNode.el.nextElementSibling)       // ...or inserting into next WS
           || (e.shiftKey  && activeNode.el.previousElementSibling)   // ...or inserting into prev WS
           || (!e.shiftKey && activeNode.to)                          // ...or inserting after at the top level
           || (e.shiftKey  && activeNode.from);                       // ...or inserting before at the top level
      this.clearSelection();
      let quarantine = that.makeQuarantineAt(text, dest);
      that.buffer.value = ""; // empty the buffer
      // save the node
      setTimeout(() => { this.unmute(); quarantine.blur(); }, 50);
    }, 50);
  }

  // deleteNode : ASTNode -> Void
  // remove node contents from CM
  deleteNode(node) {
    if (node) { this.commitChange(()=>this.cm.replaceRange('', node.from, node.to)); }
  }

  deleteNodeWithId(nodeId) {
    this.deleteNode(this.ast.getNodeById(nodeId));
  }

  // deleteSelectedNodes : Void -> Void
  // delete all of this.selectedNodes set, and then empty the set
  deleteSelectedNodes() {
    let sel = [...this.selectedNodes].sort((b, a) => poscmp(a.from, b.from));
    this.selectedNodes.clear();
    this.commitChange(() => sel.forEach(n => this.cm.replaceRange('', n.from, n.to)),
      "deleted "+sel.length+" item"+(sel.length==1? "" : "s"));
    // get as close as possible to the first deleted node, or set cursor to beginning
    let lastPath = sel.pop().path.split(',');
    this.focusPath = this.ast.getClosestNodeFromPath(lastPath).path || {line: 0, ch: 0};
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

  // getLocationFromWhiteSpace : DOMNode -> {line, ch} | false
  // if the element is a whitespace node, return its location. Otherwise return false
  getLocationFromWhitespace(el) {
    if(!el.classList.contains('blocks-white-space')) return false;
    if(!(el.dataset.line && el.dataset.ch)) throw "getLocationFromWhitespace called with a WS el that did not have a location";
    return {line: Number(el.dataset.line), ch: Number(el.dataset.ch)}; // cast to number, since HTML5 stores data as strings
  }

  // getPathFromWhiteSpace : DOMNode -> Path | #f
  // REVISIT: As of c917d4b8d374de215f66806dc9fd3dcdc2788f90, whitespaces can be wrapped around any span,
  // which means headers (fn position, cond, if) can have WS. As a result, we need to consider *three* cases
  getPathFromWhitespace(el) {
    if(!el.classList.contains('blocks-white-space')) return false;
    let path     = this.findNearestNodeFromEl(el.parentNode).path.split(','); // get the parent path
    let prevNode = this.findNodeFromEl(el.previousElementSibling);
    let nextNode = this.findNodeFromEl(el.nextElementSibling);
    path[path.length] = prevNode ? Number(prevNode.path.split(',').pop())     // "insert after previous"
      : nextNode? nextNode.path.split(',').pop() - 1                          // "insert before next"
        : 0;                                                                  // "insert at parent's beginning"
    return path.join(',');
  }

  // findNodeFromEl : DOMNode -> ASTNode | Boolean
  // return the AST node that *exactly* matches the element, or false
  findNodeFromEl(el) {
    if(el) {
      let match = el.id.match(/block-node-(.*)/);
      return match && (match.length > 1) && this.ast.getNodeById(match[1]);
    }
    return false;
  }
  // findNearestNodeFromEl : DOMNode -> ASTNode
  // return the AST node that *best** matches the element, or null
  findNearestNodeFromEl(el) {
    return this.findNodeFromEl(findNearestNodeEl(el));
  }

  dropOntoNode(_, event) {
    this.emit(EVENT_DRAG_END, this, event);
    // not a drop target, just return
    if (!this.isDropTarget(event.target)) { return; }
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('blocks-over-target');
    // look up the source information: ID, text, JSON, and the node itself
    let sourceId       = event.dataTransfer.getData('text/id');
    let sourceNodeText = event.dataTransfer.getData('text/plain');
    let sourceNodeJSON = event.dataTransfer.getData('text/json');
    let sourceNode     = this.ast.getNodeById(sourceId);

    if (sourceNode) {
      sourceNodeText = this.cm.getRange(sourceNode.from, sourceNode.to);
    } else if (sourceNodeJSON) {
      sourceNode = JSON.parse(sourceNodeJSON);
    } else if (!sourceNodeText) {
      console.error("data transfer contains no node id/json/text. Not sure how to proceed.");
    }

    // look up the destination information: Node, destFrom, destTo, and destPath
    let destinationNode = this.findNodeFromEl(event.target);            // when dropping onto an existing node, get that Node
    let destFrom        = (destinationNode && destinationNode.from)     // if we have an existing node, use its start location
                        || this.getLocationFromWhitespace(event.target) // if we have a drop target, grab that location
                        || this.cm.coordsChar({left:event.pageX, top:event.pageY}); // give up and ask CM for the cursor location
    let destTo          = destinationNode? destinationNode.to : destFrom; // destFrom = destTo for insertion
    var destPath        = (destinationNode && destinationNode.path) 
                        || this.getPathFromWhitespace(event.target)
                        || String(this.ast.getToplevelNodeBeforeCur(this.cm.coordsChar({left:event.pageX, top:event.pageY})).path || -1);
    destPath = destPath.split(',').map(Number);

    // if we're inserting, add 1 to the last child of the path
    if(!destinationNode) { destPath[destPath.length-1]++; }
  
    // Special handling if the sourceNode is coming from within the document
    if(sourceNode) {
      let sourcePath = sourceNode.path.split(',').map(Number);
      // if the sourecepath ends at a younger sibling of any destination ancestor, decrement that ancestor's order
      for(var i = 0; i < Math.min(sourcePath.length, destPath.length); i++) {
        if((sourcePath[i] <  destPath[i]) && (sourcePath.length == (i+1))) { destPath[i]--; }
      }      
      // check for no-ops: we have to use textCoords instead of ASTpaths, to allow shifting a block within whitespace
      if ((poscmp(destFrom, sourceNode.from) > -1) && (poscmp(destTo, sourceNode.to) <  1)) { return; }
    }
    this.focusPath = destPath.join(',');
    
    // if we're coming from outside
    if (destFrom.outside) {
      sourceNodeText = '\n' + sourceNodeText;
    }

    // if we're inserting/replacing from outside the editor, just do it and return
    if (!sourceNode) {
      this.commitChange( () => this.cm.replaceRange(sourceNodeText, destFrom, destTo),
        "inserted "+sourceNodeText);
      return;
    }

    // If f is defined and the destination is a non-literal node, apply it.
    // Otherwise return the sourceNodeText unmodified
    const maybeApplyClientFn = f => {
      return (f && !(destinationNode && destinationNode.type == "literal"))?
        f(this.cm, sourceNodeText, sourceNode, destFrom, destinationNode) : sourceNodeText;
    };

    // Call willInsertNode and didInsertNode on either side of the replacement operation
    // if we're not replacing a literal.
    this.commitChange(() => {
      sourceNodeText = maybeApplyClientFn(this.willInsertNode);
      if (poscmp(sourceNode.from, destFrom) < 0) {
        this.cm.replaceRange(sourceNodeText, destFrom, destTo);
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
      } else {
        this.cm.replaceRange('', sourceNode.from, sourceNode.to);
        this.cm.replaceRange(sourceNodeText, destFrom, destTo);
      }
      maybeApplyClientFn(this.didInsertNode);
    },
    "dragged "+sourceNodeText);
  }

  // handleTopLevelEntry : Event -> Void
  // quarantine a keypress or paste entry at the CM level
  handleTopLevelEntry(e) {
    if(!this.blockMode) return; // bail if mode==false
    this.clearSelection();      // clear the previous selection
    // WK/Firefox workaround: skip kepress events that are actually clipboard events
    if(e.type == "keypress" && ["c","v","x"].includes(e.key) 
      && ((ISMAC && e.metaKey) || (!ISMAC && e.ctrlKey))) {
      return;
    }
    var text = (e.type == "keypress")? String.fromCharCode(e.which)
      : e.clipboardData.getData('text/plain');
    if(!text.replace(/\s/g, '').length) return; // let pure whitespace pass through
    this.makeQuarantineAt(text, this.cm.getCursor());
  }

  // makeQuarantineAt : String [ASTNode | DOMNode | Cursor] -> Quarantine
  // Consumes a String, a Destination, and an event.
  // Hides the original node and inserts a quarantine DOM node at the Destination 
  // with the String (or, if false, DOMNode contents), allowing the user to edit.
  makeQuarantineAt(text, dest) {
    this.cm.setOption("readOnly", "nocursor"); // make CM blind while quarantine is visible
    let quarantine = document.createElement('span');
    // if we're editing an existing ASTNode
    if(dest.type) {
      text = text || this.cm.getRange(dest.from, dest.to);
      let parent = dest.el.parentNode;
      quarantine.from = dest.from; quarantine.to = dest.to;
      quarantine.path = dest.path;              // save the path for returning focus
      quarantine.originalEl = dest.el;          // save the original DOM El
      parent.replaceChild(quarantine, dest.el); // replace the old node with the quarantine
    // if we're inserting into a whitespace node
    } else if(dest.nodeType) {
      quarantine.classList.add("blocks-white-space");
      let parent = dest.parentNode;
      quarantine.to = quarantine.from = this.getLocationFromWhitespace(dest);
      quarantine.path = this.getPathFromWhitespace(dest); // save path for focus
      quarantine.originalEl = dest;             // save the original DOM El
      parent.replaceChild(quarantine, dest);    // replace the old node with the quarantine
      quarantine.insertion = {clear: () => {}}; // make a dummy marker
    // if we're inserting into a toplevel CM cursor
    } else if(dest.line !== undefined){
      quarantine.to = quarantine.from = dest;
      // calculate the path for focus (-1 if it's the first node)
      const nodeBefore = this.ast.getToplevelNodeBeforeCur(dest);
      quarantine.path = String(nodeBefore ? nodeBefore.path : -1); // save path for focus
      let mk = this.cm.setBookmark(dest, {widget: quarantine});
      quarantine.insertion = mk;
    } else {
      throw "makeQuarantineAt given a destination of unknown type";
    }
    quarantine.classList.add('quarantine', 'blocks-node', 'blocks-editing', 'blocks-literal');
    quarantine.setAttribute('role','textbox');
    quarantine["aria-label"] = quarantine.textContent = text;
    quarantine.contentEditable = true;
    quarantine.spellcheck = false;
    quarantine.onblur    = () => this.saveQuarantine(quarantine);
    quarantine.onkeydown = (e  => this.handleEditKeyDown(quarantine, e));
    quarantine.onpaste   = (e  => {
      e.preventDefault(); // SANITIZE: kill the paste event and manually-insert plaintext
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    });
    this.wrapper.onclick = () => quarantine.blur(); // clicking the editor should be construed as a "commit"
    // If text is the empty string, we're inserting. Otherwise, we're editing
    this.say(text? "editing " : "inserting "+text+". Use Enter to save, and Shift-Escape to cancel");
    this.clearSelection(); // clear any selected nodes
    this.editQuarantine(quarantine);
    return quarantine;
  }

  // editQuarantine : Quarantine -> Void
  // If we're inserting OR we have an invalid edit, put the cursor at the end
  // otherwise select the whole thing
  editQuarantine(quarantine) {
    quarantine.focus();
    setTimeout(() => {
      let range = document.createRange();
      range.selectNodeContents(quarantine);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      if(quarantine.insertion && !this.hasInvalidEdit) range.collapse();
    }, 10);
  }

  // saveQuarantine : Quarantine -> Void
  // If not, set the error state and maintain focus
  // set this.hasInvalidEdit to the appropriate value
  saveQuarantine(quarantine) {
    try {
      let text = quarantine.textContent;
      let roots = this.parser.parse(text).rootNodes;      // Make sure the node contents will parse. If so...
      this.cm.setOption("readOnly", true);                // 1) Let CM see again, and...
      this.hasInvalidEdit = false;                        // 2) Set this.hasInvalidEdit
      if(quarantine.insertion) {                          // 3) If we're inserting (instead of editing)...
        quarantine.insertion.clear();                         // clear the CM marker
        var path = quarantine.path.split(',').map(Number);    // Extract and expand the path
        path[path.length-1] += roots.length;                  // adjust the path based on parsed text
        text = this.willInsertNode(this.cm, text, quarantine, quarantine.from, quarantine.to); // sanitize
      }
      // guard against https://github.com/bootstrapworld/codemirror-blocks/issues/123
      try {
        if(quarantine.originalEl) quarantine.parentNode.replaceChild(quarantine.originalEl, quarantine);
      } catch(e) {
        console.log('(Hopefully) Harmless DOM error:', e.toString());
      }
      this.commitChange(() => { // make the change, and set the path for re-focus
          this.cm.replaceRange(text, quarantine.from, quarantine.to);
          if(path) this.focusPath = path.join(',');
        }, 
        (quarantine.insertion? "inserted " : "changed ") + text
      );
    } catch(e) {                                      // If the node contents will NOT lex...
      this.hasInvalidEdit = quarantine;                   // 1) Set this.hasInvalidEdit
      quarantine.classList.add('blocks-error');           // 2) Set the error state
      quarantine.draggable = false;                       // 3) work around WK/FF bug w/editable nodes
      let errorTxt = this.parser.getExceptionMessage(e);
      quarantine.title = errorTxt;                        // 4) Make the title the error msg
      quarantine.focus();                                 // 5) Keep focus
      this.say(errorTxt);
    }
  }

  // handleEditKeyDown : ASTNode DOMNode Event -> Void
  // Trap Enter, Tab and Esc, Shift-Esc keys. Let the rest pass through
  handleEditKeyDown(quarantine, e) {
    e.stopPropagation();
    let keyName = CodeMirror.keyName(e);
    if (["Enter", "Tab", "Shift-Tab", "Esc", "Shift-Esc"].includes(keyName)) {
      e.preventDefault();
      // To cancel, (maybe) reinsert the original DOM Elt and activate the original
      // then remove the blur handler and the insertion node
      if(["Esc", "Shift-Esc"].includes(keyName)) {
        quarantine.onblur = this.hasInvalidEdit = false; // turn off blur handler and hasInvalidEdit
        if(quarantine.insertion) { quarantine.insertion.clear(); }
        if(quarantine.originalEl) {
          quarantine.parentNode.replaceChild(quarantine.originalEl, quarantine);
          this.activateNode(this.ast.getClosestNodeFromPath(quarantine.path.split(',')), e);
        }
        this.say("cancelled");
        this.cm.setOption("readOnly", true);  // let CM see again
      } else if(["Tab", "Shift-Tab"].includes(keyName) && this.hasInvalidEdit) {
        this.say(quarantine.title);
      } else {
        quarantine.blur();
      }
    }
  }

  // used to switch focus to the "next" node, based on a search function
  // returns false if it fails to switch, true otherwise.
  switchNodes(searchFnNode, searchFnCur, e) {
    let node = this.getActiveNode();
    let inclusive = false;
    if (!node) {
      node = searchFnCur(this.cm.getCursor());
      if (!node) {
        // In the context of UP and DOWN key, this might mean the cursor is at the
        // top of bottom already, so we should do nothing
        return false;
      }
      inclusive = true;
    }
    const result = this.ast.getNextMatchingNode(
      searchFnNode, this.isNodeHidden, node, inclusive
    );
    if (result === null) {
      playSound(BEEP);
      return false;
    }
    this.activateNode(result, e);
    return true;
  }

  handleKeyDown(event) {
    if(!this.blockMode) return; // bail if mode==false
    let that = this, keyName = CodeMirror.keyName(event);
    let activeNode = this.getActiveNode(), cur = activeNode? activeNode.from : this.cm.getCursor();

    // used to create an insertion node
    function moveCursorAdjacent(node, cursor) {
      if(node) { that.makeQuarantineAt("", node); } 
      // set mouseUsed to simulate click-to-focus
      else { that.mouseUsed = true; that.cm.focus(); that.cm.setCursor(cursor); }
    }

    // Enter should toggle editing on editable nodes, or toggle expanding
    if (keyName == "Enter" && activeNode) {
      if(this.isNodeEditable(activeNode)){
        this.makeQuarantineAt(false, activeNode);
      } else {
        that.maybeChangeNodeExpanded(activeNode);
        that.refreshCM(cur);
      }
    }
    // Ctrl/Cmd-Enter should force-allow editing on ANY node
    else if (keyName == CTRLKEY+"-Enter" && activeNode) {
      this.makeQuarantineAt(false, activeNode);
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
    else if (["Delete", "Backspace", CTRLKEY+"-Delete", CTRLKEY+"-Backspace"].includes(keyName)
              && activeNode) {
      if(this.selectedNodes.size == 0) { playSound(BEEP); }
      else { this.deleteSelectedNodes(); }
    }
    // Ctrl-[ moves the cursor to previous whitespace or cursor position
    else if (keyName === "Ctrl-[" && activeNode) {
      moveCursorAdjacent(activeNode.el.previousElementSibling, activeNode.from);
    }
    // Ctrl-] moves the cursor to next whitespace or cursor position,
    else if (keyName === "Ctrl-]" && activeNode) {
      moveCursorAdjacent(activeNode.el.nextElementSibling, activeNode.to);
    }
    // if open-bracket, modify text to be an empty expression with a blank
    else if (openDelims.includes(event.key) && activeNode) {
      let path = activeNode.path.split(',');
      path[path.length-1]++; // add an adjacent sibling
      this.focusPath = path.join(','); // put focus on new sibling
      this.commitChange(() => this.cm.replaceRange(event.key+closeDelims[event.key], activeNode.to),
        "inserted empty expression");
    }
    // shift focus to buffer for the *real* paste event to fire
    // then replace or insert, then reset the buffer
    else if ([CTRLKEY+"-V", "Shift-"+CTRLKEY+"-V"].includes(keyName) && activeNode) {
      return this.handlePaste(event);
    }
    // speak parents: "<label>, at level N, inside <label>, at level N-1...""
    else if (keyName == "\\") {
      var parents = [node], node = activeNode;
      while(node = this.ast.getNodeParent(node)){
        parents.push(node.options['aria-label'] + ", at level "+node["aria-level"]);
      }
      if(parents.length > 1) this.say(parents.join(", inside "));
      else playSound(BEEP);
    }
    // Have the subtree read itself intelligently
    else if (keyName == "Shift-\\") {
      this.say(activeNode.toDescription(activeNode['aria-level']));
    }
    // Go to the first node in the tree (depth-first)
    else if (keyName == "Home" && activeNode) {
      this.activateNode(this.ast.rootNodes[0], event);
    }
    // Go to the last visible node in the tree (depth-first)
    else if (keyName == "End" && activeNode) {
      if(this.ast.rootNodes.length == 0) return; // no-op for empty trees
      let lastNode = this.ast.getNodeBeforeCur(this.ast.reverseRootNodes[0].to);
      let lastVisibleNode = that.ast.getNextMatchingNode(
        this.ast.getNodeParent, that.isNodeHidden, lastNode, true
      );
      this.activateNode(lastVisibleNode, event);
    }
    // Shift-Left and Shift-Right toggle global expansion
    else if (keyName === "Shift-Left" && activeNode) { that.changeAllExpanded(false); }
    else if (keyName === "Shift-Right" && activeNode){ that.changeAllExpanded(true ); }
    // < jumps to the root containing the activeNode
    else if (keyName == "Shift-," && activeNode) {
      let rootNode = this.ast.getNodeByPath(activeNode.path.split(",")[0]);
      this.activateNode(rootNode, event);
    }
    // Collapse block if possible, otherwise focus on parent
    else if (event.keyCode == LEFT && activeNode) {
      let parent = this.ast.getNodeParent(activeNode);
      return (that.maybeChangeNodeExpanded(activeNode, false) && that.refreshCM(cur))
          || (parent && this.activateNode(parent, event))
          || playSound(BEEP);
    }
    // Expand block if possible, otherwise descend to firstChild
    else if (event.keyCode == RIGHT && activeNode) {
      let firstChild = this.isNodeExpandable(activeNode) 
        && this.ast.getNodeFirstChild(activeNode);
      return (that.maybeChangeNodeExpanded(activeNode, true) && that.refreshCM(cur))
          || (firstChild && this.activateNode(firstChild, event))
          || playSound(BEEP);
    }
    // Go to next visible node
    else if (event.keyCode == DOWN) {
      if (!this.switchNodes(this.ast.getNodeAfter, this.ast.getNodeAfterCur, event)) {
        return;
      }
    }
    // Go to previous visible node
    else if (event.keyCode == UP) {
      if (!this.switchNodes(this.ast.getNodeBefore, this.ast.getNodeBeforeCur, event)) {
        return;
      }
    } else {
      // Announce undo and redo (or beep if there's nothing)
      if (keyName == CTRLKEY+"-Z" && activeNode) {
        if(this.focusHistory.done.length > 0) {
          this.say("undo " + this.focusHistory.done[0].announcement);
          this.focusHistory.undone.unshift(this.focusHistory.done.shift());
          this.focusPath = this.focusHistory.undone[0].path;
        }
        else { playSound(BEEP); }
      }
      if ((ISMAC && keyName=="Shift-Cmd-Z") || (!ISMAC && keyName=="Ctrl-Y") && activeNode) { 
        if(this.focusHistory.undone.length > 0) {
          this.say("redo " + this.focusHistory.undone[0].announcement);
          this.focusHistory.done.unshift(this.focusHistory.undone.shift());
          this.focusPath = this.focusHistory.done[0].path;
        }
        else { playSound(BEEP); }
      }
      let command = this.keyMap[keyName];
      if (typeof command == "string") {
        this.cm.execCommand(command);
      } else if (typeof command == "function") {
        command(this.cm);
      } else {
        return; // let CodeMirror handle it
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  // unset the aria-selected attribute, and remove the node from the set
  removeFromSelection(node, speakEachOne=true) {
    this.selectedNodes.delete(node);
    if(speakEachOne) { this.say(node.options["aria-label"]+" unselected"); }
    node.el.setAttribute("aria-selected", "false");
  }

  // add the node to the selected set, and set the aria attribute
  // make sure selectedNodes never contains both a child and its ancestor
  addToSelection(node) {
    let selected = [...this.selectedNodes];
    // if this is an ancestor of nodes in the set, remove them first
    selected.filter(n => node.el.contains(n.el)).forEach(this.removeFromSelection);
    // bail if an ancestor is already in the set
    if(selected.find(n => n.el.contains(node.el))) {
      this.say("an ancestor is already selected");
    } else {
      node.el.setAttribute("aria-selected", true);
      this.selectedNodes.add(node);
    }
  }

  // unset the aria attribute, and empty the set
  clearSelection() {
    if(this.selectedNodes.size > 0) {
      this.selectedNodes.forEach(n => this.removeFromSelection(n, false));
      this.say("selection cleared");
    } 
  }

  // change expanded state globally
  // HACK: we should be storing state in the AST, and letting React handle state changes
  // We do this for now, strictyl for perf reasons
  changeAllExpanded(expanded) {
    this.say(expanded? "Expand All" : "Collapse All", 30);
    let activeNode = this.getActiveNode();
    this.cm.setOption("viewportMargin", Infinity);
    setTimeout(() => {
      let elts = this.wrapper.querySelectorAll(`[aria-expanded=${!expanded}]:not([class*=blocks-locked])`);
      [].forEach.call(elts, e => this.maybeChangeNodeExpanded(this.findNodeFromEl(e), expanded));
      this.refreshCM(activeNode.from); // update the CM display, since line heights may have changed
      this.cm.setOption("viewportMargin", this.savedOpts["viewportMargin"]);
      if(!expanded) { // if we collapsed, put focus on containing rootNode
        let rootPath = activeNode.path.split(",")[0];
        // shift focus if rootId !== activeNodeId, by simulating a click
        if(rootPath !== activeNode.path) this.ast.getNodeByPath(rootPath).el.click();
        else this.cm.scrollIntoView(activeNode.from);      
      }
    }, 30);
  }

  cancelIfErrorExists(event) {
    if(this.hasInvalidEdit && !(event.target === this.hasInvalidEdit)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // nodeEventHandler : {HandlerFn} Boolean -> *
  // Dispatch pattern that recieves a handler object, and
  // calls an event handler for the given node type
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
          console.log('calling default');
          handlers.default.call(this, node, event);
          return;
        }
      }
    }.bind(this);
  }
}
