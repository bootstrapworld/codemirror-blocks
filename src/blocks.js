// TODO: move this file to CodeMirrorBlocks.js
import CodeMirror from 'codemirror';
import ee from 'event-emitter';
import Renderer from './Renderer';
import * as languages from './languages';
import * as ui from './ui';
import merge from './merge';
var beepSound = require('./beep.wav');

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
    this.lastActiveNodeId = 0;
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
        onkeydown: (n, e) => this.handleKeyDown(n, e),
        onclick: this.nodeEventHandler(this.activateNode),
        ondblclick: this.nodeEventHandler({
          literal: (n, e) => this.insertionQuarantine(false, n, e),
          blank: this.editLiteral,
          whitespace: (n, e) => this.insertionQuarantine("", n, e),
          default: this.maybeChangeNodeExpanded
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
    this.cm.on('mousedown', (cm, e) => {this.toggleDraggable(e); this.cancelIfErrorExists(e);});
    this.cm.on('mouseup',   (cm, e) => this.toggleDraggable(e));
    this.cm.on('dblclick',  (cm, e) => this.cancelIfErrorExists(e));
    this.cm.on('change',    (cm, e) => this.handleChange(e));
    this.cm.on('focus',     (cm, e) => {
      // override CM's natural onFocus behavior, activating the first node
      if(this.ast.rootNodes.length > 0 && e.relatedTarget 
          && e.relatedTarget.nodeName === "TEXTAREA") { 
        setTimeout(() => { this.activateNode(this.ast.keyMap(0), e); }, 10);
      }
    });
    // make sure all the nodes are rendered, so screenreaders can count them correcly
    this.cm.setOption('viewportMargin', Infinity);
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
    console.log(text);
    setTimeout(() => this.announcements.appendChild(announcement), 200);
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

  handleChange(cm) {
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

  render() {
    this.ast = this.parser.parse(this.cm.getValue());
    this._clearMarks();
    this.renderer.renderAST(this.ast, this.lastActiveNodeId);
    ui.renderToolbarInto(this);
  }

  getActiveNode() {
    return this.findNearestNodeFromEl(document.activeElement);
  }

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

  _getNextVisibleNode(nextFn, 
    from = this.getActiveNode() || this.cm.getCursor()) {
    let nextNode = nextFn(from);
    while (nextNode && this.isNodeHidden(nextNode)) {
      nextNode = nextFn(nextNode);
    }
    return nextNode || from;
  }

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
      clipboard = sel.reduce((s,n) => s + this.cm.getRange(n.from, n.to)+" ","");
    }
    
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
      // delete last-to-first to preserve the from/to indices
      sel.forEach(n => {
        console.log('DELETE', n.id);
        this.cm.replaceRange('', n.from, n.to);
      });
      this.selectedNodes.clear(); // clear any pointers to the now-destroyed nodes
    }
    this.say((event.type == 'cut'? 'cut ' : 'copied ') + clipboard);
  }

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
      var text = nodeEl.innerText;                    // Sanitize the text
      if(node.from === node.to) text = this.willInsertNode(text, nodeEl, node.from, node.to);
      this.parser.lex(nodeEl.innerText);              // If the node contents will lex...
      this.hasInvalidEdit = false;                    // 1) Set this.hasInvalidEdit
      nodeEl.title = '';                              // 2) Clear the title
      if(node.quarantine){ node.quarantine.clear(); } // 3) Maybe get rid of the quarantine bookmark
      this.cm.replaceRange(text, node.from, node.to); // 4) Commit the changes to CM
      this.say("saved "+nodeEl.innerText);
    } catch(e) {                                      // If the node contents will NOT lex...
      this.hasInvalidEdit = true;                     // 1) Set this.hasInvalidEdit
      nodeEl.classList.add('blocks-error');           // 2) Set the error state
      nodeEl.draggable = false;            // 3) remove draggable to work around WK/FF bug
      let errorTxt = this.parser.getExceptionMessage(e);
      nodeEl.title = errorTxt;                        // 4) Make the title the error msg
      setTimeout(()=>this.editLiteral(node,event),50);// 5) Keep focus
      this.say(errorTxt);
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
    //node.el.draggable = false; // defend against webkit
    event.stopPropagation();
    this.say("editing "+node.el.getAttribute("aria-label"));
    node.el.oldText = this.cm.getRange(node.from, node.to);
    node.el.contentEditable = true;
    node.el.classList.add('blocks-editing');
    node.el.setAttribute('role','textbox');
    node.el.onblur    = (e => this.saveEdit(node, node.el, e));
    node.el.onkeydown = this.handleEditKeyDown;
    let range = document.createRange();
    range.setStart(node.el, node.quarantine? 1 : 0);
    range.setEnd(node.el, node.quarantine? 1 : node.el.children.length);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    node.el.focus();
  }

  // remove node contents from CM
  deleteNode(node) {
    if (node) {
      console.log('DELETE', node.id);
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

  // every whitespace element has a previous and/or next sibling
  // use that to determine the location
  getLocationFromWhitespace(el) {
    let prevEl = el.previousElementSibling;
    let nextEl = el.nextElementSibling;
    let prev   = prevEl? this.findNodeFromEl(prevEl) : false;
    let next   = nextEl? this.findNodeFromEl(nextEl) : false;
    // return the end of the previous sibling (if it exists)
    // if not, return the start of the next sibling (if it exists)
    // if not, we're at the top level so return null
    return prev? prev.to 
        :  next? next.from
        :  null;
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
                        || this.getLocationFromWhitespace(event.target)          // if we have a drop target, grab that location
                        || this.cm.coordsChar({left:event.pageX, top:event.pageY}); // give up and ask CM for the cursor location
    let destTo        = (destinationNode && destinationNode.to) || destFrom; // destFrom = destTo for insertion
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
      if(destinationNode) {
        console.log('UPDATE', destinationNode.id);
      } else {
        console.log('INSERT BEFORE child:', 
        this.ast.getNodeAfter(destFrom) && this.ast.getNodeAfter(destFrom).id, 
        'parent:', 
        null);
      }
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

      if(destinationNode) {
        console.log('REPLACE', destinationNode.id, 'with', sourceNode.id);
      } else {
        console.log('MOVE', sourceNode.id, 'before:',
          this.ast.getNodeAfter(destFrom) && this.ast.getNodeAfter(destFrom).id,
          'parent', null);
      }
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
    let node = this.insertionQuarantine(text, this.cm.getCursor(), e);
    // try automatically rendering the pasted text
    if(e.type !== "keypress") { setTimeout(() => node.el.blur(), 20); }
  }

  // If it's an expandable node, set to makeExpanded (or toggle)
  // return true if there's been a change
  maybeChangeNodeExpanded(node, makeExpanded) {
    if(!this.isNodeExpandable(node)) return false;
    // treat anything other than false as true (even undefined)
    let isExpanded = !(node.el.getAttribute("aria-expanded")=="false");
    if(makeExpanded !== isExpanded) {
      node.el.setAttribute("aria-expanded", !isExpanded);
    }
    return makeExpanded !== isExpanded;
  }

  // insertionQuarantine : String [ASTNode | DOMNode | Cursor] Event -> Void
  // Consumes a String, a Destination, and an event.
  // Inserts a literal at the from Destination with the String (or, if false,
  // DOMNode contents), allowing the user to edit. onBlur(), The contents
  // text is checked for lexability and inserted in the From/To range.
  insertionQuarantine(text, dest, event) {
    let ast  = this.parser.parse("0");
    let literal = ast.rootNodes[0];
    literal.options['aria-label'] = text;
    this.renderer.renderAST(ast);
    if(dest.type) {
      console.log('UPDATE', dest.id);
      text = text || this.cm.getRange(dest.from, dest.to);
      let parent = dest.el.parentNode;
      literal.from = dest.from; literal.to = dest.to;
      parent.insertBefore(literal.el, dest.el);
      parent.removeChild(dest.el);
    } else if(dest.nodeType) {
      console.log('INSERT BEFORE child:', 
        dest.nextElementSibling && dest.nextElementSibling.id, 
        'parent:', 
        findNearestNodeEl(dest) && findNearestNodeEl(dest).id);
      literal.el.classList.add("blocks-white-space");
      let parent = dest.parentNode;
      literal.to = literal.from = this.getLocationFromWhitespace(dest);
      parent.insertBefore(literal.el, dest);
      parent.removeChild(dest);
    } else if(dest.line !== undefined){
      console.log('INSERT BEFORE child:', 
        this.ast.getNodeAfter(dest) && this.ast.getNodeAfter(dest).id, 
        'parent: ', 
        null);
      literal.to = literal.from = dest;
      let mk = this.cm.setBookmark(dest, {widget: literal.el});
      literal.quarantine = mk;
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
    // clear searches every half-second
    setTimeout(() => this.searchString = "", 750);

    function moveCursorAdjacent(node, cursor) {
      if(node) { that.insertionQuarantine("", node, event); } 
      else { that.cm.focus(); that.cm.setCursor(cursor); }
    }
    function switchNodes(searchFn) {
      let node = that._getNextVisibleNode(searchFn);
      if(node === activeNode) { playBeep(); }
      else { that.activateNode(node, event); }
    }

    // Collapse block if possible, otherwise focus on parent
    if (event.keyCode == LEFT && activeNode) {
      return this.maybeChangeNodeExpanded(activeNode, false) 
          || (activeNode.parent && this.activateNode(activeNode.parent, event))
          || playBeep();
    }
    // Expand block if possible, otherwise descend to firstChild
    else if (event.keyCode == RIGHT && activeNode) {
      return this.maybeChangeNodeExpanded(activeNode, true)
          || (activeNode.firstChild && this.activateNode(activeNode.firstChild, event))
          || playBeep();
    }
    // Go to next visible node
    else if (event.keyCode == UP) {
      switchNodes(cur => this.ast.getNodeAfter(cur));
    }
    // Go to previous visible node
    else if (event.keyCode == DOWN) {
      switchNodes(cur => this.ast.getNodeBefore(cur));
    }
    // Go to the first node in the tree (depth-first)
    else if (keyName == "Home" && activeNode) {
      this.activateNode(this.ast.rootNodes[0], event);
    }
    // Go to the last visible node in the tree (depth-first)
    else if (keyName == "End" && activeNode) {
      let lastExpr = [...this.ast.reverseRootNodes[0]];
      var lastNode = lastExpr[lastExpr.length-1];
      if(this.isNodeHidden(lastNode)) {
        let searchFn = (cur => this.ast.getNodeBefore(cur));
        lastNode = this._getNextVisibleNode(searchFn, lastNode);
      }
      this.activateNode(lastNode, event);
    }
    // Enter should toggle editing on editable nodes, or toggle expanding
    else if (keyName == "Enter" && activeNode) {
      if(this.isNodeEditable(activeNode)){
        this.insertionQuarantine(false, activeNode, event);
      } else {
        this.maybeChangeNodeExpanded(activeNode);
      }
    }
    // Ctrl/Cmd-Enter should toggle editing on non-editable nodes
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
    else if (keyName == DELETEKEY && activeNode) {
      if(this.selectedNodes.size == 0) { playBeep(); }
      else { this.deleteSelectedNodes(); }
    } 
    // Ctrl-[ and Ctrl-] move cursor to adjacent whitespace or cursor position
    else if (keyName === "Ctrl-[" && activeNode) {
      moveCursorAdjacent(activeNode.el.previousElementSibling, activeNode.from);
    }
    else if (keyName === "Ctrl-]" && activeNode) {
      moveCursorAdjacent(activeNode.el.nextElementSibling, activeNode.to);
    }
    // shift focus to buffer for the *real* paste event to fire
    // then replace or insert, then reset the buffer
    else if (keyName == CTRLKEY+"-V" && activeNode) {
      return this.handlePaste(event);
    } else {
      let command = this.keyMap[keyName];
      if (typeof command == "string") {
        this.cm.execCommand(command);
      } else if (typeof command == "function") {
        command(this.cm);
        // if it's an ASCII character and search is installed, try building up a search string
      } 
      /*
      else if(this.cm.getSearchCursor && /^[\x00-\xFF]$/.test(keyName) && activeNode){
        this.searchString += keyName;
        var searchCursor = this.cm.getSearchCursor(this.searchString.toLowerCase());
        if(!searchCursor.findNext()) { playBeep(); }
        else { 
          let marks = this.cm.findMarksAt(searchCursor.from());
          if(marks.length === 0) { playBeep(); }
          else { this.activateNode(this.findNodeFromEl(marks[0].replacedWith), event); }
        }
      }
      */
      return; // return without cancelling the event
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
