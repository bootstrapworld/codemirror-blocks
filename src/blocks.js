// TODO: move this file to CodeMirrorBlocks.js
import CodeMirror from 'codemirror';
import ee from 'event-emitter';
import Renderer from './Renderer';
import * as languages from './languages';
import * as ui from './ui';
import merge from './merge';

// give (a,b), produce -1 if a<b, +1 if a>b, and 0 if a=b
function poscmp(a, b) { return a.line - b.line || a.ch - b.ch; }

// findNearestNodeEl : DOM -> DOM
// Consumes a DOM node, and produces the ancestor associated
// with an ASTNode
function findNearestNodeEl(el) {
  while (el !== document.body && !el.classList.contains('blocks-node')) {
    el = el.parentNode;
  }
  return el === document.body? null : el;
}

var beepSound = require('./beep.wav');
const BEEP = new Audio(beepSound);
function playBeep() {
  BEEP.pause();
  if(BEEP.readyState > 0){ BEEP.currentTime = 0; }
  // Resolves race condition. See https://stackoverflow.com/questions/36803176
  setTimeout(function () { BEEP.play(); }, 50);
}

const ISMAC   = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)?true:false;
const MODKEY  = ISMAC? "Alt" : "Ctrl";
const CTRLKEY = ISMAC? "Cmd" : "Ctrl";
const DELETEKEY = ISMAC? "Backspace" : "Delete";
const LEFT    = 37;
const RIGHT   = 39;
const UP      = 40;
const DOWN    = 38;

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
    this.cm.setOption("viewportMargin", Infinity);
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
    this.announcements.setAttribute("aria-live", "assertive");
    this.wrapper.appendChild(this.announcements);
    this.searchString = "";
    // Track all selected nodes in our own set
    this.selectedNodes = new Set();
    // Track lastActiveNodeId
    this.lastActiveNodeId = false;
    // Offscreen buffer for copy/cut/paste operations
    this.buffer = document.createElement('textarea');
    this.buffer.style.opacity = 0;
    this.buffer.style.height = "1px";
    this.buffer.onchange = () => { this.buffer.value = ""; };
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
      oncut: (n, e) => this.handleCopyCut(n, e),
      oncopy: (n, e) => this.handleCopyCut(n, e)
    });

    var dropHandler = this.nodeEventHandler(this.dropOntoNode, true);
    var dragEnterHandler = this.nodeEventHandler(this.handleDragEnter);
    this.cm.on('drop',      (cm, e) => dropHandler(e));
    this.cm.on('dragenter', (cm, e) => dragEnterHandler(e));
    this.cm.on('inputread', (cm, e) => this.handleKeyDown(e));
    this.cm.on('paste',     (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('keypress',  (cm, e) => this.handleTopLevelEntry(e));
    this.cm.on('mouseup',   (cm, e) => this.toggleDraggable(e));
    this.cm.on('dblclick',  (cm, e) => this.cancelIfErrorExists(e));
    this.cm.on('change',    (cm, e) => this.handleChange(e));
    // mousedown events should impact dragging, focus-if-error, and click events
    this.cm.on('mousedown', (cm, e) => {
      this.toggleDraggable(e); 
      this.cancelIfErrorExists(e);
      this.mouseUsed = true;
      setTimeout(() => this.mouseUsed = false, 200);
    });
    // override CM's natural onFocus behavior, activating the last focused node
    // skip this if it's the result of a mousedown event
    this.cm.on('focus',     (cm, e) => {
      if(this.ast.rootNodes.length > 0 && !this.mouseUsed) {
        let focusNode = this.lastActiveNodeId || "0"; 
        setTimeout(() => { this.activateNode(this.ast.getNodeById(focusNode), e); }, 10);
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

  // say : String -> Void
  // add text to the announcements element, and log it to the console
  // append a comma to distinguish between adjaced commands
  say(text){
    let announcement = document.createTextNode(text+", ");
    console.log(text);
    setTimeout(() => this.announcements.appendChild(announcement), 200);
    setTimeout(() => this.announcements.removeChild(announcement), 500);
  }

  // setBlockMode : String -> Void
  // Toggle CM attributes, and announce the mode change
  setBlockMode(mode) {
    if (mode === this.blockMode) {
      return;
    } else {
      this.blockMode = mode;
      if(mode) { 
        this.wrapper.setAttribute( "role", "tree"); 
        this.scroller.setAttribute("role", "presentation");
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

  toggleBlockMode() {
    this.setBlockMode(!this.blockMode);
  }

  // FF & WK don't like draggable and contenteditable to mix, so we need
  // to turn draggable on and off based on mousedown/up events
  toggleDraggable(e) {
    if(e.target.draggable) {e.target.removeAttribute("draggable");} 
    else { e.target.setAttribute("draggable", true); }
  }

  // handleChange : CM CM-Change-Event -> Void
  // if blocks mode is enabled, re-render the blocks
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

  // render : Void -> Void
  // re-parse the document, then patch and re-render the resulting AST
  render() {
    this.ast = this.parser.parse(this.cm.getValue());
    this._clearMarks();
    //this.ast.patch(this.parser.parse(this.cm.getValue()));
    //console.log('patched AST is ', this.ast.rootNodes);
    this.renderer.renderAST(this.ast, this.lastActiveNodeId);
    ui.renderToolbarInto(this);
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
    // if there's a selection and the altKey isn't pressed, clear selection
    if((this.selectedNodes.size > 0) && !(ISMAC? event.altKey : event.ctrlKey)) { 
      this.clearSelection(); 
    }
    this.scroller.setAttribute("aria-activedescendent", node.el.id);
    this.cm.scrollIntoView(node.from);
    node.el.focus();
    this.lastActiveNodeId = node.id;
    return true;
  }

  isNodeExpandable(node) {
    return !["blank", "literal", "comment"].includes(node.type) && 
         !node.el.getAttribute("aria-disabled");
  }
  isNodeEditable(node) {
    return ["blank", "literal"].includes(node.type);
  }

  isNodeHidden(node) {
    return node.el.matches('[aria-expanded="false"] *');
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

  // handleCopyCut : Event -> Void
  // if any nodes are selected, copy all of their text ranges to a buffer
  // copy the buffer to the clipboard. Remove the original text onCut
  handleCopyCut(event) {
    event.stopPropagation();
    var clipboard, activeNode = this.getActiveNode();
    if(!activeNode) return;

    // If nothing is selected, say "nothing selected" for cut
    // or copy the clipboard to the text of the active node
    if(this.selectedNodes.size === 0) {
      if(event.type == 'cut') {
        this.say("Nothing selected");
        return false;
      } else if(event.type == 'copy') {
        clipboard = this.cm.getRange(activeNode.from, activeNode.to);
      }
    // Otherwise copy the contents of selection to the buffer, first-to-last
    } else {
      var sel = [...this.selectedNodes].sort((b,a) => poscmp(a.from, b.from));
      clipboard = sel.reduceRight((s,n) => s + this.cm.getRange(n.from, n.to)+" ","");
    }

    this.say((event.type == 'cut'? 'cut ' : 'copied ') + clipboard);
    this.buffer.value = clipboard;
    this.buffer.select();
    try {
      document.execCommand && document.execCommand(event.type);
    } catch (e) {
      console.error("execCommand doesn't work in this browser :(", e);
    }
    // put focus back on activeEl, and clear the buffer
    setTimeout(() => { activeNode.el.focus(); }, 200);
    if (event.type == 'cut') {
      // batch-delete last-to-first, to preserve the from/to indices
      this.cm.operation(() => {
        sel.forEach(n => this.cm.replaceRange('', n.from, n.to));
      });
      this.selectedNodes.clear(); // clear any pointers to the now-destroyed nodes
    }
  }

  // handlePaste : Event -> Void
  // paste to a hidden buffer, then grab the text and deal with it manually
  handlePaste(e) {
    let that = this, activeNode = this.getActiveNode();
    this.buffer.focus();
    setTimeout(() => {
      let text = that.buffer.value;
      let dest = that.selectedNodes.has(activeNode)? activeNode 
            : activeNode.el.nextElementSibling ? activeNode.el.nextElementSibling
            : activeNode.to;
      this.clearSelection();
      let node = that.insertionQuarantine(text, dest, e);
      that.buffer.value = ""; // empty the buffer
      // save the node
      setTimeout(() => node.el.blur(), 50);
    }, 50);
  }

  // saveEdit : ASTNode DOMNode Event -> Void
  // If not, set the error state and maintain focus
  // set this.hasInvalidEdit to the appropriate value
  saveEdit(node, nodeEl, event) {
    event.preventDefault();
    try {
      var text = nodeEl.innerText;                    // If inserting (from==to), sanitize
      if(node.from === node.to) text = this.willInsertNode(text, nodeEl, node.from, node.to);
      this.parser.parse(nodeEl.innerText);            // If the node contents will parse
      this.hasInvalidEdit = false;                    // 1) Set this.hasInvalidEdit
      nodeEl.title = '';                              // 2) Clear the title
      if(node.insertion){ node.insertion.clear(); }   // 3) Maybe get rid of the insertion bookmark
      this.cm.replaceRange(text, node.from, node.to); // 4) Commit the changes to CM
      this.say((nodeEl.originalEl? "changed " : "inserted ") + text);
    } catch(e) {                                      // If the node contents will NOT lex...
      this.hasInvalidEdit = true;                     // 1) Set this.hasInvalidEdit
      nodeEl.classList.add('blocks-error');           // 2) Set the error state
      nodeEl.draggable = false;                       // 3) work around WK/FF bug w/editable nodes
      let errorTxt = this.parser.getExceptionMessage(e);
      nodeEl.title = errorTxt;                        // 4) Make the title the error msg
      setTimeout(()=>this.editLiteral(node,event),50);// 5) Keep focus
      this.say("Error: "+errorTxt);
    }
  }

  // handleEditKeyDown : ASTNode DOMNode Event -> Void
  // Trap Enter, Tab and Esc, Shift-Esc keys. Let the rest pass through
  handleEditKeyDown(node, nodeEl, e) {
    e.stopPropagation();
    e.codemirrorIgnore = true;
    let keyName = CodeMirror.keyName(e);
    if (["Enter", "Tab", "Esc", "Shift-Esc"].includes(keyName)) {
      e.preventDefault();
      // To cancel, (maybe) reinsert the original DOM Elt and activate the original
      // then remove the blur handler and the insertion node
      if(["Esc", "Shift-Esc"].includes(keyName)) { 
        if(!node.insertion) {
          nodeEl.parentNode.insertBefore(nodeEl.originalEl, nodeEl);
          this.activateNode(this.ast.getNodeById(this.lastActiveNodeId), e);
        }
        this.say("cancelled");
        nodeEl.onblur = null;
        nodeEl.parentNode.removeChild(nodeEl);
      } else {
        nodeEl.blur();
      }
    }
  }

  // editLiteral : ASTNode Event -> Void
  // Set the appropriate attributes and event handlers
  editLiteral(node, event) {
    event.stopPropagation();
    this.say("editing "+node.el.getAttribute("aria-label"));
    node.el.contentEditable = true;
    node.el.spellcheck = false;
    node.el.classList.add('blocks-editing');
    node.el.setAttribute('role','textbox');
    node.el.onblur    = (e => this.saveEdit(node, node.el, e));
    node.el.onkeydown = (e => this.handleEditKeyDown(node, node.el, e));
    let range = document.createRange();
    range.setStart(node.el, node.insertion? 1 : 0);
    let end = Math.min(node.toString().length, node.el.innerText.length);
    range.setEnd(node.el, node.insertion? 1 : end);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    node.el.focus();
  }

  // deleteNode : ASTNode -> Void
  // remove node contents from CM
  deleteNode(node) {
    if (node) { this.cm.replaceRange('', node.from, node.to); }
  }

  deleteNodeWithId(nodeId) {
    this.deleteNode(this.ast.getNodeById(nodeId));
  }

  // deleteSelectedNodes : Void -> Void
  // delete all of this.selectedNodes set, and then empty the set
  deleteSelectedNodes() {
    let nodeCount = this.selectedNodes.size;
    this.cm.operation(() => this.selectedNodes.forEach(n=>this.deleteNode(n)));
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
  // If the input isn't a whitespace element, bail
  // If there's a previous sibling, return it's .to
  // If there's a next sibling, return it's .from
  // If it's the first WS after a function, return it's .to
  // Otherwise, return the character *after* the parent's .from
  getLocationFromWhitespace(el) {
    if(!el.classList.contains('blocks-white-space')) return;
    let prevEl = el.previousElementSibling;
    if(prevEl) { return this.findNodeFromEl(prevEl).to; }
    let nextEl = el.nextElementSibling;
    if(nextEl) { return this.findNodeFromEl(nextEl).from; }
    let parent = this.findNearestNodeFromEl(findNearestNodeEl(el));
    let func   = this.ast.getNodeFirstChild(parent);
    if(func)   { return func.to; }
    return { line: parent.from.line, ch: parent.from.ch+1 };
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
    let sourceNode     = this.ast.getNodeById(sourceId);
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
                        || this.getLocationFromWhitespace(event.target)          // if we have a drop target, grab that location
                        || this.cm.coordsChar({left:event.pageX, top:event.pageY}); // give up and ask CM for the cursor location
    let destTo        = destinationNode? destinationNode.to : destFrom; // destFrom = destTo for insertion
    // if we're coming from outside
    if (destFrom.outside) {
      sourceNodeText = '\n' + sourceNodeText;
    }

    // check for no-ops
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

    // If f is defined and the destination is a non-literal node, apply it.
    // Otherwise return the sourceNodeText unmodified
    function maybeApplyClientFn(f) {
      return (f && !(destinationNode && destinationNode.type == "literal"))?
        f(sourceNodeText, sourceNode, destFrom, destinationNode) : sourceNodeText;
    }

    // Call willInsertNode and didInsertNode on either side of the replacement operation
    // if we're not replacing a literal. Use cm.operation to batch these two
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

  // handleTopLevelEntry : Event -> Void
  // quarantine a keypress or paste entry at the CM level
  handleTopLevelEntry(e) {
    if(!this.blockMode) return;                           // bail if mode==false
    // Firefox workaround: skip kepress events that are actual clipboard events
    if(e.type == "keypress" && ["c","v","x"].includes(e.key) 
      && ((ISMAC && e.metaKey) || (!ISMAC && e.ctrlKey))) {
        return false;
    }
    this.clearSelection();                                // clear the previous selection
    var text = (e.type == "keypress")? String.fromCharCode(e.which)
             : e.clipboardData.getData('text/plain');
    let openBrace = ["(","[","{"].includes(text);
    // let pure whitespace pass through
    if(!text.replace(/\s/g, '').length) return;
    e.preventDefault();
    
    // if open-bracket, modify text to be an empty expression with a blank
    let match = {"(": ")", "[":"]", "{": "}"};
    if (openBrace) { text = text + "..." + match[text]; }
    let node = this.insertionQuarantine(text, this.cm.getCursor(), e);
    
    // try automatically rendering (give the DOM 20ms to catch up)
    if(e.type !== "keypress" || openBrace) { 
      let id = this.ast.getNodeBefore(this.cm.getCursor()).id;
      // move the focus to the new node, or its first child if it's an openBrace
      this.lastActiveNodeId = Number(id) + 1 + (openBrace? ",0" : "");
      setTimeout(() => node.el.blur(), 20); 
    }
  }

  // insertionQuarantine : String [ASTNode | DOMNode | Cursor] Event -> Void
  // Consumes a String, a Destination, and an event.
  // Hides the original node and inserts a literal at the Destination 
  // with the String (or, if false, DOMNode contents), allowing the user to edit.
  insertionQuarantine(text, dest, event) {
    let ast  = this.parser.parse("0");
    let literal = ast.rootNodes[0];
    literal.id="quarantine";
    literal.options['aria-label'] = text;
    this.renderer.render(literal);
    // if we're inserting into an existing ASTNode
    if(dest.type) {
      text = text || this.cm.getRange(dest.from, dest.to);
      let parent = dest.el.parentNode;
      literal.from = dest.from; literal.to = dest.to;
      literal.el.originalEl = dest.el; // save the original DOM El
      parent.insertBefore(literal.el, dest.el);
      parent.removeChild(dest.el);
      this.lastActiveNodeId = dest.id; // remember what we were editing
    // if we're inserting into a whitespace node
    } else if(dest.nodeType) {
      literal.el.classList.add("blocks-white-space");
      let parent = dest.parentNode;
      literal.to = literal.from = this.getLocationFromWhitespace(dest);
      literal.el.originalEl = dest; // save the original DOM El
      parent.insertBefore(literal.el, dest);
      parent.removeChild(dest);
    // if we're inserting into a toplevel CM cursor
    } else if(dest.line !== undefined){
      literal.to = literal.from = dest;
      let mk = this.cm.setBookmark(dest, {widget: literal.el});
      literal.insertion = mk;
    } else {
      throw "insertionQuarantine given a destination of unknown type";
    }
    literal.el.draggable = false;
    literal.el.innerText = text;
    literal.el.setAttribute("aria-label", text);
    setTimeout(() => this.editLiteral(literal, event), 10);
    return literal;
  }

  handleKeyDown(event) {
    if(!this.blockMode) return; // bail if mode==false
    let that = this;
    let keyName = CodeMirror.keyName(event);
    var activeNode = this.getActiveNode();

    function moveCursorAdjacent(node, cursor) {
      if(node) { that.insertionQuarantine("", node, event); } 
      // set mouseUsed to simulate click-to-focus
      else { that.mouseUsed = true; that.cm.focus(); that.cm.setCursor(cursor); }
    }
    function switchNodes(searchFn) {
      let node = that.ast.getNextMatchingNode(
        searchFn, that.isNodeHidden, that.getActiveNode() || that.cm.getCursor());
      if(node === activeNode) { playBeep(); }
      else { that.activateNode(node, event); }
    }
    function showAndActivate(exists) {
      clearTimeout(that.searchTimer); // reset the timer for 1sec
      that.searchTimer = setTimeout(() => {
        that.searchString = that.searchCursor = "";
        that.say('Search cleared');
      }, 1000);
      if(!exists) { playBeep(); return; } // beep if there's nothing to show
      let node = that.ast.getNodeContaining(that.searchCursor.from());
      var ancestors = [], p = that.ast.getNodeParent(node);
      while(p) { ancestors.push(p); p = that.ast.getNodeParent(p); }
      ancestors.reverse();  // put ancestors in oldest-first order
      if(that.renderOptions.lockNodesOfType.includes(ancestors[0].type)) {
        node = ancestors[0];
      } else {
        ancestors.forEach(a => maybeChangeNodeExpanded(a, true)); 
      }
      that.activateNode(node, event);
    }
    // If it's an expandable node, set to makeExpanded (or toggle)
    // return true if there's been a change
    function maybeChangeNodeExpanded(node, makeExpanded) {
      if(!that.isNodeExpandable(node)) return false;
      // treat anything other than false as true (even undefined)
      let isExpanded = !(node.el.getAttribute("aria-expanded")=="false");
      if(makeExpanded !== isExpanded) {
        node.el.setAttribute("aria-expanded", !isExpanded);
      }
      that.cm.refresh();
      return makeExpanded !== isExpanded;
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
        let searchFn = (cur => this.ast.getNodeBefore(cur));
        lastNode = that.ast.getNextMatchingNode(
          searchFn, that.isNodeHidden, that.getActiveNode());
      }
      this.activateNode(lastNode, event);
    }
    // if there's a search string, Enter and Shift-Enter go to next/prev
    else if (this.searchString && keyName == "Enter" && activeNode) {
      showAndActivate(this.searchCursor.findNext());
    }
    else if (this.searchString && keyName == "Shift-Enter" && activeNode) {
      showAndActivate(this.searchCursor.findPrevious());
    }
    // Enter should toggle editing on editable nodes, or toggle expanding
    else if (keyName == "Enter" && activeNode) {
      if(this.isNodeEditable(activeNode)){
        this.insertionQuarantine(false, activeNode, event);
      } else {
        maybeChangeNodeExpanded(activeNode);
      }
    }
    // Ctrl/Cmd-Enter should toggle editing on non-editable nodes
    else if (keyName == CTRLKEY+"-Enter" && activeNode) {
      this.insertionQuarantine(false, activeNode, event);
    }
    // Space clears selection and selects active node
    else if (keyName == "Space" && activeNode && !this.searchString) {
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
    else if (keyName == DELETEKEY && activeNode && !this.searchString) {
      if(this.selectedNodes.size == 0) { playBeep(); }
      else { this.deleteSelectedNodes(); }
    }
    // Ctrl-[ moves the cursor to previous whitespace or cursor position
    else if (keyName === "Ctrl-[" && activeNode) {
      moveCursorAdjacent(activeNode.el.previousElementSibling, activeNode.from);
    }
    // Ctrl-] moves the cursor to next whitespace or cursor position,
    // taking special care of 0-argument expressions
    else if (keyName === "Ctrl-]" && activeNode) {
      let parent = this.ast.getNodeParent(activeNode);
      let nextWS = activeNode.el.nextElementSibling ||
        parent && parent.el.querySelectorAll(".blocks-white-space")[0];
      moveCursorAdjacent(nextWS, activeNode.to);
    }
    // Shift-Left and Shift-Right toggle global expansion
    else if (keyName === "Shift-Left" && activeNode) {
      this.say("All blocks collapsed");
      let elts = this.wrapper.querySelectorAll("[aria-expanded=true]");
      [].forEach.call(elts, e => e.setAttribute("aria-expanded", false));
      let rootId = activeNode.id.split(",")[0]; // put focus on containing rootNode
      this.cm.refresh();
      // shift focus if rootId !== activeNodeId
      if(rootId !== activeNode.id) this.activateNode(this.ast.getNodeById(rootId), event);
    }
    else if (keyName === "Shift-Right" && activeNode) {
      this.say("All blocks expanded");
      let elts = this.wrapper.querySelectorAll("[aria-expanded=false]:not([class*=blocks-locked])");
      [].forEach.call(elts, e => e.setAttribute("aria-expanded", true));
      this.cm.refresh();
    }
    // shift focus to buffer for the *real* paste event to fire
    // then replace or insert, then reset the buffer
    else if (keyName == CTRLKEY+"-V" && activeNode) {
      return this.handlePaste(event);
    }
    // Collapse block if possible, otherwise focus on parent
    else if (event.keyCode == LEFT && activeNode) {
      let parent = this.ast.getNodeParent(activeNode);
      return maybeChangeNodeExpanded(activeNode, false) 
          || (parent && this.activateNode(parent, event))
          || playBeep();
    }
    // Expand block if possible, otherwise descend to firstChild
    else if (event.keyCode == RIGHT && activeNode) {
      let firstChild = this.isNodeExpandable(activeNode) 
        && this.ast.getNodeFirstChild(activeNode);
      return maybeChangeNodeExpanded(activeNode, true)
          || (firstChild && this.activateNode(firstChild, event))
          || playBeep();
    }
    // Go to next visible node
    else if (event.keyCode == UP) {
      switchNodes(cur => this.ast.getNodeAfter(cur));
    }
    // Go to previous visible node
    else if (event.keyCode == DOWN) {
      switchNodes(cur => this.ast.getNodeBefore(cur));
    } else {
      let command = this.keyMap[keyName];
      if (typeof command == "string") {
        this.cm.execCommand(command);
      } else if (typeof command == "function") {
        command(this.cm);
      } 
      // if it's an ASCII character and search is installed, try building up a search string
      else if(this.cm.getSearchCursor && /^[\x00-\xFF]$/.test(keyName) && activeNode) {
        this.searchString += keyName;
        this.say('Searching for '+this.searchString);
        this.searchCursor = this.cm.getSearchCursor(this.searchString, activeNode.from, true);
        showAndActivate(this.searchCursor.findNext());
      }
      return; // return without cancelling the event
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
