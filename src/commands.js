import {playSound, BEEP} from './sound';
import {poscmp} from './utils';
import {openDelims, closeDelims} from './blocks';

export let commands = {
	// deleteSelectedNodes : Void -> Void
	// delete all of cmb.selectedNodes set, and then empty the set
	deleteSelectedNodes: cmb => {
    if(!cmb.getActiveNode()) return false;
		if(cmb.selectedNodes.size == 0) { playSound(BEEP); return false; }
    let sel = [...cmb.selectedNodes].sort((b, a) => poscmp(a.from, b.from));
    cmb.selectedNodes.clear();
    cmb.commitChange(() => sel.forEach(n => cmb.cm.replaceRange('', n.from, n.to)),
      "deleted "+sel.length+" item"+(sel.length==1? "" : "s"));
    return true;
	},
	insertToLeft: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode(), el = node.el.previousElementSibling, cur = node.from;
		cmb.moveCursorAdjacent(el, cur);
    return true;
	},
	insertToRight: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode(), el = node.el.nextElementSibling, cur = node.to;
		cmb.moveCursorAdjacent(el, cur);
    return true;
	},
	findNextVisibleNode: cmb => {
    let next = cmb.getActiveNode()? cmb.ast.getNodeAfter : cmb.ast.getToplevelNodeAfterCur;
		cmb.activateNextNodeBasedOnFn(next);
    return true;
	},
	findPrevVisibleNode: cmb => {
    let prev = cmb.getActiveNode()? cmb.ast.getNodeBefore : cmb.ast.getToplevelNodeBeforeCur;
    cmb.activateNextNodeBasedOnFn(prev);
    return true;
	},
	findNextVisibleNodeAndPreserveSelection: cmb => {
    if(!cmb.getActiveNode()) return false;
    let next = cmb.getActiveNode()? cmb.ast.getNodeAfter : cmb.ast.getToplevelNodeAfterCur;
    cmb.activateNextNodeBasedOnFn(next, true);
    return true;
	},
	findPrevVisibleNodeAndPreserveSelection: cmb => {
    if(!cmb.getActiveNode()) return false;
    let prev = cmb.getActiveNode()? cmb.ast.getNodeBefore : cmb.ast.getToplevelNodeBeforeCur;
    cmb.activateNextNodeBasedOnFn(prev, true);
    return true;
	},
	collapseOrFindParent: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode();
		if(!(cmb.isNodeExpandable(node) && cmb.maybeChangeNodeExpanded(node, false))) {
        let parent = cmb.ast.getNodeParent(node);
        if(parent) cmb.activateNode(parent, event); else playSound(BEEP);
    } else { cmb.refreshCM(node.from); }
    return true;
	},
	expandOrFindFirstChild: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode();
		if(!(cmb.isNodeExpandable(node) && cmb.maybeChangeNodeExpanded(node, true))) {
		  let firstChild = cmb.isNodeExpandable(node) && cmb.ast.getNodeFirstChild(node);
		  if(firstChild) cmb.activateNode(firstChild, event); else playSound(BEEP);
		} else { cmb.refreshCM(node.from); }
    return true;
	},
	// speak parents: "<label>, at level N, inside <label>, at level N-1...""
  speakParents: cmb => {
    if(!cmb.getActiveNode()) return false;
    var node = cmb.getActiveNode(), parents = [node];
    while(node = cmb.ast.getNodeParent(node)){
      parents.push(node.options['aria-label'] + ", at level "+node["aria-level"]);
    }
    if(parents.length > 1) cmb.say(parents.join(", inside "));
    else playSound(BEEP);
    return true;
  },
  // Have the subtree read itself intelligently
  speakChildren: cmb => { 
    if(!cmb.getActiveNode()) return false;
  	let node = cmb.getActiveNode(); 
  	cmb.say(node.toDescription(node['aria-level'])); 
    return true;
  },
  undo: cmb => {
    if(cmb.focusHistory.done.length > 0) {
      cmb.say("undo " + cmb.focusHistory.done[0].announcement);
      cmb.cm.execCommand("undo");
      cmb.focusHistory.undone.unshift(cmb.focusHistory.done.shift());
    }
    else { playSound(BEEP); }
    return true;
  },
  redo: cmb => {
    if(cmb.focusHistory.undone.length > 0) {
      cmb.say("redo " + cmb.focusHistory.undone[0].announcement);
      cmb.cm.execCommand("redo");
      cmb.focusHistory.done.unshift(cmb.focusHistory.undone.shift());
    }
    else { playSound(BEEP); }
    return true;
  },
  paste:  (cmb, e) => {
    cmb.handlePaste(e);
    return true; 
  },
  editNode: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode();
  	cmb.makeQuarantineAt(false, node);
    return true;
  },
	// create an insertion quarantine in place of the given node
	editOrToggleExpanded: cmb => {
    if(!cmb.getActiveNode()) return false;
		let node = cmb.getActiveNode();
		if(cmb.isNodeEditable(node)){ cmb.makeQuarantineAt(false, node); }
		else { cmb.maybeChangeNodeExpanded(node) && cmb.refreshCM(node.from); }
    return true;
	},
  activateFirstVisibleNode: cmb => { 
  	cmb.activateNode(cmb.ast.rootNodes[0]);
    return true;
  },
  activateLastVisibleNode: cmb => {
    if(cmb.ast.rootNodes.length == 0) return; // no-op for empty trees
    let lastNode = cmb.ast.getNodeBeforeCur(cmb.ast.reverseRootNodes[0].to);
    let lastVisibleNode = cmb.ast.getNextMatchingNode(
      cmb.ast.getNodeParent, cmb.isNodeHidden, lastNode, true
    );
    cmb.activateNode(lastVisibleNode);
    return true;
  },
  expandAll: cmb => { 
    if(!cmb.getActiveNode()) return false;
  	cmb.changeAllExpanded(true);
    return true;
  },
  collapseAll: cmb => { 
    if(!cmb.getActiveNode()) return false;
  	cmb.changeAllExpanded(false);
    return true;
  },
  activateRoot: cmb => {
    if(!cmb.getActiveNode()) return false;
    let rootPath = cmb.getActiveNode().path.split(",")[0];
    cmb.activateNode(cmb.ast.getNodeByPath(rootPath));
    return true;
  },
  toggleSelection: cmb => {
    if(!cmb.getActiveNode()) return false;
  	cmb.toggleSelection(false);
    return true;
  },
  toggleSelectionAndPreserveSelection: cmb => {
    if(!cmb.getActiveNode()) return false;
  	cmb.toggleSelection(true);
    return true;
  },
  insertEmptyExpression: (cmb, e) => {
    if(!cmb.getActiveNode() || !openDelims.includes(event.key)) return false;
    let node = cmb.getActiveNode();
    cmb.commitChange(() => cmb.cm.replaceRange(event.key+closeDelims[event.key], node.to),
      "inserted empty expression");
  }
};
