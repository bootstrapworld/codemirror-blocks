// TODO: move this file to CodeMirrorBlocks.js
import CodeMirror from 'codemirror';
import ee from 'event-emitter';
import Renderer from './Renderer';
import * as languages from './languages';
import * as ui from './ui';
import merge from './merge';

let batchedLogs = [];

// Logging function
function log(event, details) {
  let userSelect = document.getElementById("userTestingID");
  let taskSelect = document.getElementById("task");
  let userID = userSelect? userSelect.value : null;
  let task   = taskSelect? taskSelect.value : null;
  let payload = {
      'tag':        'blocks-testing', 
      'event':      event,
      'details':    details,
      'userID':     userID,
      'task':       task
  };
  _LTracker.push(payload);
}
// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
function poscmp(a, b) { return  a.line - b.line || a.ch - b.ch;  }

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
function toggleDraggable(e) {
  if(e.target.draggable) {e.target.removeAttribute("draggable");} 
  else { e.target.setAttribute("draggable", true); }
}

var beepSound = require('./beep.wav');
const BEEP = new Audio(beepSound);
const WRAP = BEEP;
function playSound(sound) {
  sound.pause();
  console.log("BEEP!");
  if(sound.readyState > 0){ sound.currentTime = 0; }
  // Resolves race condition. See https://stackoverflow.com/questions/36803176
  setTimeout(function () { sound.play(); }, 50);
}

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)?true:false;
const MODKEY  = ISMAC? "Alt" : "Ctrl";
const CTRLKEY = ISMAC? "Cmd" : "Ctrl";
const DELETEKEY=ISMAC? "Backspace" : "Delete";
const LEFT    = 37;
const RIGHT   = 39;
const DOWN    = 40;
const UP      = 38;
// open/close delimeters
const openDelims = ["(","[","{"];
const closeDelims = {"(": ")", "[":"]", "{": "}"};

const MARKER = Symbol("codemirror-blocks-marker");
export class BlockMarker {
  constructor(cmMarker, options){
    this.cmMarker = cmMarker;
    this.options = options;
  }
  clear() {
    if (this.options.css) {
      this.cmMarker.replacedWith.firstChild.style.cssText = '';
    }
    if (this.options.title) {
      this.cmMarker.replacedWith.firstChild.title = '';
    }
    if (this.options.className) {
      this.cmMarker.replacedWith.firstChild.classList.remove(this.options.className);
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
    this.renderOptions = renderOptions || {lockNodesOfType: []};
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
    this.announcements.setAttribute("aria-live", "assertive");
    this.wrapper.appendChild(this.announcements);
    // False = no search, anything else = the-search-string
    this.searchString = false;
    this.searchBox = document.createElement("span");
    this.searchBox.setAttribute('aria-hidden', 'true');
    // Track all selected nodes in our own set
    this.selectedNodes = new Set();
    // Track paths that should be collapsed after a render
    this.pathsToCollapseAfterRender = [];
    // Track focus and history with path/announcement pairs
    this.focusHistory = {done: [], undone: []};
    this.focusPath = "0";
    // Internal clipboard for non-native operations (*groan*)
    this.clipboard = "";
    // Offscreen buffer for handling native copy/cut/paste operations
    this.buffer = document.createElement('textarea');
    this.buffer.style.opacity = 0;
    this.buffer.style.height = "1px";
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
        onkeydown:  ((n, e) => this.handleKeyDown(n, e)),
        onclick:    this.nodeEventHandler(this.activateNode),
        ondblclick: this.nodeEventHandler({
          literal:    ((n, e) => this.insertionQuarantine(false, n, e)),
          blank:      ((n, e) => this.insertionQuarantine(false, n, e)),
          whitespace: ((n, e) => this.insertionQuarantine("", n, e))
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
    this.cm.on('inputread', (cm, e) => this.handleKeyDown(e));
    this.cm.on('paste',     (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('keypress',  (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('mouseup',   (cm, e) => toggleDraggable(e));
    this.cm.on('dblclick',  (cm, e) => this.cancelIfErrorExists(e));
    this.cm.on('changes',   (cm, e) => this.handleChange(cm, e));
    // mousedown events should impact dragging, focus-if-error, and click events
    this.cm.on('mousedown', (cm, e) => {
      toggleDraggable(e); 
      this.cancelIfErrorExists(e);
      this.mouseUsed = true;
      setTimeout(() => this.mouseUsed = false, 200);
    });
    // override CM's natural onFocus behavior, activating the last focused node
    // skip this if it's the result of a mousedown event
    this.cm.on('focus',     (cm, e) => {
      if(this.blockMode && this.ast.rootNodes.length > 0 && !this.mouseUsed) {
        setTimeout(() => { this.activateNode(this.ast.getNodeByPath(this.focusPath), e); }, 10);
      }
    });
    // set up searchbox
    this.wrapper.appendChild(this.searchBox);
    this.searchBox.className = "searchBox";
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

  // called anytime we update the underlying CM value
  // destorys the redo history and updates the undo history
  commitChange(changes, announcement=false) {
    console.log('commiting change. saving focus at ', this.focusPath);
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
    log('console', text);
    setTimeout(() => this.announcements.appendChild(announcement), delay);
    setTimeout(() => this.announcements.removeChild(announcement), delay+300);
  }

  // setBlockMode : String -> Void
  // Toggle CM attributes, and announce the mode change
  setBlockMode(mode) {
    if (mode === this.blockMode) { return; } // bail if there's no change
    this.blockMode = mode;
    if(mode) { 
      this.wrapper.setAttribute( "role", "tree"); 
      this.scroller.setAttribute("role", "presentation");
      this.wrapper.setAttribute("aria-label", "Block Editor");
      this.say("Switching to Block Mode");
      this.ast = this.parser.parse(this.cm.getValue());
    } else { 
      this.wrapper.removeAttribute( "role"); 
      this.scroller.removeAttribute("role");
      this.wrapper.setAttribute("aria-label", "Text Editor");
      this.say("Switching to Text Mode");
    }
    this.renderer.animateTransition(this.ast, mode);
  }

  toggleBlockMode() {
    this.setBlockMode(!this.blockMode);
  }

  // handleChange : CM CM-Change-Events -> Void
  // if blocks mode is enabled, re-render the blocks
  handleChange(_, changes) {
    if (this.blockMode) {
      this.render(changes);
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
      if (mark.replacedWith && mark.replacedWith.firstChild.classList.contains('blocks-node')) {
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
          let node = this.ast.getClosestNodeFromPath(this.focusPath.split(','));
          if(node && node.el) { node.el.click(); }
          else { this.cm.focus(); }
          delete this.ast.dirty; // remove dirty nodeset, now that they've been rendered
        }, 100);
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
    if(node == this.getActiveNode()){
      this.say(node.el.getAttribute("aria-label"));
    }
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
    var {top, bottom, left, right} = node.el.getBoundingClientRect();
    // if the element is outside of CM's viewport, scroll to that line and recalaculate
    if((left+right+top+bottom) == 0) {
      this.cm.scrollIntoView(node.from);
      var {top, bottom, left, right} = node.el.getBoundingClientRect();
    }
    let offset = this.wrapper.getBoundingClientRect();
    let scroll = this.cm.getScrollInfo();
    top    = top    + scroll.top  - offset.top; 
    bottom = bottom + scroll.top  - offset.top;
    left   = left   + scroll.left - offset.left; 
    right  = right  + scroll.left - offset.left;
    this.cm.scrollIntoView({top, bottom, left, right}, 100);
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
        return false;
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
    if (event.type == 'cut') { this.deleteSelectedNodes(); } // delete all those nodes
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
      let node = that.insertionQuarantine(text, dest, e);
      that.buffer.value = ""; // empty the buffer
      // save the node
      setTimeout(() => { this.unmute(); node.el.blur(); }, 50);
    }, 50);
  }

  // saveEdit : ASTNode DOMNode Event -> Void
  // If not, set the error state and maintain focus
  // set this.hasInvalidEdit to the appropriate value
  saveEdit(node, nodeEl, event) {
    event.preventDefault();
    try {
      var text = nodeEl.textContent;
      let roots = this.parser.parse(text).rootNodes;  // Make sure the node contents will parse
      if(node.from === node.to) text = this.willInsertNode(text, nodeEl, node.from, node.to); // sanitize
      this.hasInvalidEdit = false;                    // 1) Set this.hasInvalidEdit
      nodeEl.title = '';                              // 2) Clear any prior error titles
      if(node.insertion) {                            // 3) If we're inserting (instead of editing)
        node.insertion.clear();                         // clear the CM marker
        var path = node.path.split(',').map(Number);    // Extract and expand the path
        path[path.length-1] += roots.length;            // adjust the path based on parsed text
      }
      if(nodeEl.originalEl) nodeEl.parentNode.insertBefore(nodeEl.originalEl, nodeEl);
      nodeEl.parentNode.removeChild(nodeEl);
      this.commitChange(() => { // make the change, and set the path for re-focus
        this.cm.replaceRange(text, node.from, node.to);
        if(path) this.focusPath = path.join(',');
      }, 
      (node.insertion? "inserted " : "changed ") + text);
    } catch(e) {                                      // If the node contents will NOT lex...
      this.hasInvalidEdit = true;                     // 1) Set this.hasInvalidEdit
      nodeEl.classList.add('blocks-error');           // 2) Set the error state
      nodeEl.draggable = false;                       // 3) work around WK/FF bug w/editable nodes
      let errorTxt = this.parser.getExceptionMessage(e);
      nodeEl.title = errorTxt;                        // 4) Make the title the error msg
      setTimeout(()=>this.editLiteral(node,event),50);// 5) Keep focus
      this.say(errorTxt);
    }
  }

  // handleEditKeyDown : ASTNode DOMNode Event -> Void
  // Trap Enter, Tab and Esc, Shift-Esc keys. Let the rest pass through
  handleEditKeyDown(node, nodeEl, e) {
    e.stopPropagation();
    e.codemirrorIgnore = true;
    let keyName = CodeMirror.keyName(e);
    if (["Enter", "Tab", "Shift-Tab", "Esc", "Shift-Esc"].includes(keyName)) {
      e.preventDefault();
      // To cancel, (maybe) reinsert the original DOM Elt and activate the original
      // then remove the blur handler and the insertion node
      if(["Esc", "Shift-Esc"].includes(keyName)) {
        nodeEl.onblur = null;
        if(nodeEl.originalEl) {
          nodeEl.parentNode.insertBefore(nodeEl.originalEl, nodeEl);
          this.activateNode(this.ast.getClosestNodeFromPath(node.path.split(',')), e);
        }
        this.say("cancelled");
        nodeEl.parentNode.removeChild(nodeEl);
      } else if(["Tab", "Shift-Tab"].includes(keyName) && this.hasInvalidEdit) {
        this.say(nodeEl.title);
      } else {
        nodeEl.blur();
      }
    }
  }

  // editLiteral : ASTNode Event -> Void
  // Set the appropriate attributes and event handlers
  editLiteral(node, event) {
    event.stopPropagation();
    this.clearSelection(); // if we're editing, clear the selection
    let action = node.el.getAttribute("aria-label") == ""? "inserting " : "editing ";
    this.say(action+node.el.getAttribute("aria-label")+". Use Enter to save, and Shift-Escape to cancel");
    node.el.contentEditable = true;
    node.el.spellcheck = false;
    node.el.classList.add('blocks-editing');
    node.el.setAttribute('role','textbox');
    node.el.onblur    = (e => this.saveEdit(node, node.el, e));
    node.el.onkeydown = (e => this.handleEditKeyDown(node, node.el, e));
    let range = document.createRange();
    let end = Math.min(node.toString().length, node.el.innerText.length);
    range.setStart(node.el, node.insertion? end : 0);
    range.setEnd(node.el, end);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    node.el.focus();
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
    this.focusPath = sel[sel.length-1].path; // point to the first node
    this.commitChange(() => sel.forEach(n => this.cm.replaceRange('', n.from, n.to)),
      "deleted "+sel.length+" item"+(sel.length==1? "" : "s"));
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

  // getLocationFromWhiteSpace : DOMNode -> {line, ch} | null
  getLocationFromWhitespace(el) {
    if(!el.classList.contains('blocks-white-space')) return; 
    let prevEl = el.previousElementSibling, nextEl = el.nextElementSibling;
    if(prevEl) { return this.findNodeFromEl(prevEl).to;   }  // If there's a previous sibling, return it's .to
    if(nextEl) { return this.findNodeFromEl(nextEl).from; }  // If there's a next sibling, return it's .from
    throw "IMPOSSIBLE: A WS element had neither a previous nor next sibling";
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

  // findNodeFromEl : DOMNode -> ASTNode
  // return the AST node that *exactly* matches the element, or null
  findNodeFromEl(el) {
    if(el) {
      let match = el.id.match(/block-node-(.*)/);
      return match && (match.length > 1) && this.ast.getNodeById(match[1]);
    }
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
                        || String(this.ast.getNodeBefore(this.cm.coordsChar({left:event.pageX, top:event.pageY})).path || -1);
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
      // Remember to re-collapse any dragged nodes after patch
      let elts = sourceNode.el.querySelectorAll("[aria-expanded=false]");
      let collapsedPaths = [].map.call(elts, elt => this.findNodeFromEl(elt).path.split(','));
      if(sourceNode.collapsed) collapsedPaths.push(sourceNode.path.split(','));
      this.pathsToCollapseAfterRender = collapsedPaths.map(p => destPath.concat(p.slice(destPath.length)).join(','));
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
    function maybeApplyClientFn(f) {
      return (f && !(destinationNode && destinationNode.type == "literal"))?
        f(sourceNodeText, sourceNode, destFrom, destinationNode) : sourceNodeText;
    }

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
      return false;
    }
    var text = (e.type == "keypress")? String.fromCharCode(e.which)
      : e.clipboardData.getData('text/plain');
    if(!text.replace(/\s/g, '').length) return; // let pure whitespace pass through
    e.preventDefault();
    this.insertionQuarantine(text, this.cm.getCursor(), e);
  }

  // insertionQuarantine : String [ASTNode | DOMNode | Cursor] Event -> Void
  // Consumes a String, a Destination, and an event.
  // Hides the original node and inserts a literal at the Destination 
  // with the String (or, if false, DOMNode contents), allowing the user to edit.
  insertionQuarantine(text, dest, event) {
    let ast  = this.parser.parse("0");
    let literal = ast.rootNodes[0];
    literal.options['aria-label'] = text;
    this.renderer.render(literal, true);
    literal.el.classList.add("quarantine");
    // if we're editing an existing ASTNode
    if(dest.type) {
      text = text || this.cm.getRange(dest.from, dest.to);
      let parent = dest.el.parentNode;
      literal.from = dest.from; literal.to = dest.to;
      literal.path = dest.path; // save the path for returning focus
      literal.el.originalEl = dest.el; // save the original DOM El
      parent.insertBefore(literal.el, dest.el);
      parent.removeChild(dest.el);
    // if we're inserting into a whitespace node
    } else if(dest.nodeType) {
      literal.el.classList.add("blocks-white-space");
      let parent = dest.parentNode;
      literal.to = literal.from = this.getLocationFromWhitespace(dest);
      literal.path = this.getPathFromWhitespace(dest); // save path for focus
      literal.el.originalEl = dest;  // save the original DOM El
      parent.insertBefore(literal.el, dest);
      parent.removeChild(dest);
      literal.insertion = {clear: () => {}}; // make a dummy marker
    // if we're inserting into a toplevel CM cursor
    } else if(dest.line !== undefined){
      literal.to = literal.from = dest;
      // calculate the path for focus (-1 if it's the first node)
      literal.path = String(this.ast.getNodeBefore(dest).path || -1);
      let mk = this.cm.setBookmark(dest, {widget: literal.el});
      literal.insertion = mk;
    } else {
      throw "insertionQuarantine given a destination of unknown type";
    }
    literal.el.draggable = false;
    literal.el.innerText = text;
    literal.el.originalPath = this.focusPath;
    literal.el.setAttribute("aria-label", text);
    setTimeout(() => this.editLiteral(literal, event), 10);
    return literal;
  }

  handleKeyDown(event) {
    if(!this.blockMode) return; // bail if mode==false
    let that = this, keyName = CodeMirror.keyName(event), keyCode = event.which;
    let activeNode = this.getActiveNode(), cur = activeNode? activeNode.from : this.cm.getCursor();
    let searchMode = this.searchString !== false;
    log('keydown', keyName);

    // used for lightweigh refresh when the AST hasn't changed
    function refreshCM(){
      that.cm.refresh(); 
      that.cm.scrollIntoView(cur);
      return true;
    }
    // used to create an insertion node
    function moveCursorAdjacent(node, cursor) {
      if(node) { that.insertionQuarantine("", node, event); } 
      // set mouseUsed to simulate click-to-focus
      else { that.mouseUsed = true; that.cm.focus(); that.cm.setCursor(cursor); }
    }
    // used to switch focus to the "next" node, based on a search function
    function switchNodes(searchFn) {
      let node = that.ast.getNextMatchingNode(
        searchFn, that.isNodeHidden, that.getActiveNode() || that.cm.getCursor());
      if(node === activeNode) { playSound(BEEP); }
      that.activateNode(node, event);
    }
    function showNextMatch(forward) {
      let matches = that.searchMatches.slice(0), test = forward? d=>d>0 : d=>d<0;
      if(!forward){ matches.reverse(); } // if we're searching backwards, reverse the array
      let index = matches.findIndex(n => test(poscmp(n.from, activeNode.from)));
      if(index < 0) { index = 0; playSound(BEEP); } // if we go off the edge, wrap to 0 & play sound
      let node = matches[index], ancestors = [node], p = that.ast.getNodeParent(node);
      while(p) { ancestors.unshift(p); p = that.ast.getNodeParent(p); }
      if(that.renderOptions.lockNodesOfType.includes(ancestors[0].type)) { node = ancestors[0]; }
      else { ancestors.forEach(a => maybeChangeNodeExpanded(a, true)); }
      refreshCM();
      that.activateNode(node, event);
      return true;
    }
    // If it's an expandable node, set to makeExpanded (or toggle)
    // return true if there's been a change
    function maybeChangeNodeExpanded(node, makeExpanded) {
      if(!that.isNodeExpandable(node)) return false;
      // treat anything other than false as true (even undefined)
      let isExpanded = !(node.el.getAttribute("aria-expanded")=="false");
      if(makeExpanded !== isExpanded) {
        node.el.setAttribute("aria-expanded", !isExpanded);
        node.collapsed = isExpanded;
      }
      return makeExpanded !== isExpanded;
    }

    if (searchMode) {
      // Turn off Find Modal
      if (["Esc","Shift-Esc"].includes(keyName)) {
        this.say("Find mode disabled");
        this.searchBox.style.display = "none"; 
        this.searchString = false;
        this.searchBox.innerText = "";
      }
      // if there's a search string, Enter and Shift-Enter go to next/prev
      else if (keyName == "Enter"       && activeNode) { showNextMatch(true ); }
      else if (keyName == "Shift-Enter" && activeNode) { showNextMatch(false); }
      // An ASCII key was pressed! If there's still a match, modify the search string and find
      else if(!((ISMAC && event.metaKey) || (!ISMAC && event.ctrlKey)) 
        && ([8, 46].includes(keyCode) || event.key.length==1) ) {
        let newSearchString = [8, 46].includes(keyCode)? this.searchString.slice(0, -1) // Del/Backspace
          : ["", true].includes(this.searchString)? event.key                           // First char
            : this.searchString + event.key;                                            // Next Char
        let searchCursor = this.cm.getSearchCursor(newSearchString);
        this.searchMatches = [];
        while(searchCursor.findNext()) { 
          let node = this.ast.getNodeContaining(searchCursor.from());
          if(node) this.searchMatches.push(node);  // make sure we're not just matching a comment
        }
        if(newSearchString !="" && this.searchMatches.length == 0) { playSound(WRAP); return; } // no matches! wrap.
        this.searchString = newSearchString;
        this.searchBox.innerText = newSearchString;
        this.say(this.searchString? 'Searching for '+this.searchString : 'Type to search', 0);
        if(newSearchString !="") showNextMatch(true);
      }
    } else {
      // Switch to Search Mode
      if (keyName == "/") {
        this.say("Find mode enabled. Type to search. Enter and Shift-Enter to search forwards"
          +" and backwards. Shift-Escape to cancel");
        this.searchBox.style.display = "inline-block";
        this.searchString = this.searchString || true;
      }    
      // Enter should toggle editing on editable nodes, or toggle expanding
      else if (keyName == "Enter" && activeNode) {
        if(this.isNodeEditable(activeNode)){
          this.insertionQuarantine(false, activeNode, event);
        } else {
          maybeChangeNodeExpanded(activeNode);
          refreshCM();
        }
      }
      // Ctrl/Cmd-Enter should force-allow editing on ANY node
      else if (keyName == CTRLKEY+"-Enter" && activeNode) {
        this.insertionQuarantine(false, activeNode, event);
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
      else if ([DELETEKEY, CTRLKEY+"-"+DELETEKEY].includes(keyName)
                && activeNode && !searchMode) {
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
      else if (openDelims.includes(event.key) && activeNode && !searchMode) {
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
    }

    // Go to the first node in the tree (depth-first)
    if (keyName == "Home" && activeNode) {
      this.activateNode(this.ast.rootNodes[0], event);
    }
    // Go to the last visible node in the tree (depth-first)
    else if (keyName == "End" && activeNode) {
      let lastExpr = [...this.ast.reverseRootNodes[0]];
      var lastNode = lastExpr[lastExpr.length-1];
      if(this.isNodeHidden(lastNode)) {
        let searchFn = (cur => this.ast.getNodeParent(cur));
        lastNode = that.ast.getNextMatchingNode(
          searchFn, that.isNodeHidden, lastNode);
      }      
      this.activateNode(lastNode, event);
    }
    // Shift-Left and Shift-Right toggle global expansion
    else if (keyName === "Shift-Left" && activeNode) {
      this.say("Collapse All", 30);
      let savedViewportMargin = this.cm.getOption("viewportMargin");
      this.cm.setOption("viewportMargin", Infinity);
      let elts = this.wrapper.querySelectorAll("[aria-expanded=true]");
      [].forEach.call(elts, e => maybeChangeNodeExpanded(this.findNodeFromEl(e), false));
      refreshCM(); // update the CM display, since line heights may have changed
      let rootPath = activeNode.path.split(",")[0]; // put focus on containing rootNode
      // shift focus if rootId !== activeNodeId
      if(rootPath !== activeNode.path) this.activateNode(this.ast.getNodeByPath(rootPath), event);
      else this.cm.scrollIntoView(activeNode.from);
      this.cm.setOption("viewportMargin", savedViewportMargin);
    }
    else if (keyName === "Shift-Right" && activeNode) {
      this.say("Expand All", 30);
      let savedViewportMargin = this.cm.getOption("viewportMargin");
      this.cm.setOption("viewportMargin", Infinity);
      let elts = this.wrapper.querySelectorAll("[aria-expanded=false]:not([class*=blocks-locked])");
      [].forEach.call(elts, e => maybeChangeNodeExpanded(this.findNodeFromEl(e), true));
      refreshCM(); // update the CM display, since line heights may have changed
      this.cm.setOption("viewportMargin", savedViewportMargin);
    }
    // active the previous non-locked, non-hidden node
    else if (keyName === "Shift-PageUp" && activeNode) {
      let searchFn = (cur => this.ast.getNodeBefore(cur)),
        testFn   = (node => that.isNodeLocked(node) || that.isNodeHidden(node));
      lastNode = that.ast.getNextMatchingNode(searchFn, testFn, activeNode);
      this.activateNode(lastNode, event);
    }
    // active the previous non-locked, non-hidden node
    else if (keyName === "Shift-PageDown" && activeNode) {
      let searchFn = (cur => this.ast.getNodeAfter(cur)),
        testFn   = (node => that.isNodeLocked(node) || that.isNodeHidden(node));
      lastNode = that.ast.getNextMatchingNode(searchFn, testFn, activeNode);
      this.activateNode(lastNode, event);
    }
    // Collapse block if possible, otherwise focus on parent
    else if (event.keyCode == LEFT && activeNode) {
      let parent = this.ast.getNodeParent(activeNode);
      return (maybeChangeNodeExpanded(activeNode, false) && refreshCM())
          || (parent && this.activateNode(parent, event))
          || playSound(BEEP);
    }
    // Expand block if possible, otherwise descend to firstChild
    else if (event.keyCode == RIGHT && activeNode) {
      let firstChild = this.isNodeExpandable(activeNode) 
        && this.ast.getNodeFirstChild(activeNode);
      return (maybeChangeNodeExpanded(activeNode, true) && refreshCM())
          || (firstChild && this.activateNode(firstChild, event))
          || playSound(BEEP);
    }
    // Go to next visible node
    else if (event.keyCode == DOWN) {
      switchNodes(cur => this.ast.getNodeAfter(cur));
    }
    // Go to previous visible node
    else if (event.keyCode == UP) {
      switchNodes(cur => this.ast.getNodeBefore(cur));
    } else {
      // Announce undo and redo (or beep if there's nothing)
      if (keyName == CTRLKEY+"-Z" && activeNode) { 
        if(this.cm.historySize().undo > 0) { 
          this.say("undo " + this.focusHistory.done[0].announcement);
          this.focusHistory.undone.unshift(this.focusHistory.done.shift());
          this.focusPath = this.focusHistory.undone[0].path;
        }
        else { playSound(BEEP); }
      }
      if ((ISMAC && keyName=="Shift-Cmd-Z") || (!ISMAC && keyName=="Ctrl-Y") && activeNode) { 
        if(this.cm.historySize().redo > 0) {
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
      } else if(!searchMode) {
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

  cancelIfErrorExists(event) {
    if(this.hasInvalidEdit){
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
          handlers.default.call(this, node, event);
          return;
        }
      }
    }.bind(this);
  }
}
