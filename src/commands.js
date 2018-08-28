import {playSound, BEEP, poscmp} from './blocks';

export let commands = {
	// deleteSelectedNodes : Void -> Void
	// delete all of this.selectedNodes set, and then empty the set
	deleteSelectedNodes: cmb => {
		if(cmb.selectedNodes.size == 0) { playSound(BEEP); return; }
	    let sel = [...cmb.selectedNodes].sort((b, a) => poscmp(a.from, b.from));
	    cmb.selectedNodes.clear();
	    cmb.focusPath = sel[sel.length-1].path; // point to the first node
	    cmb.commitChange(() => sel.forEach(n => cmb.cm.replaceRange('', n.from, n.to)),
	      "deleted "+sel.length+" item"+(sel.length==1? "" : "s"));
	},
	insertToLeft: cmb => {
		let node = cmb.getActiveNode(), el = node.el.previousElementSibling, cur = node.from;
		cmb.moveCursorAdjacent(el, cur);
	},
	insertToRight: cmb => {
		let node = cmb.getActiveNode(), el = node.el.nextElementSibling, cur = node.to;
		cmb.moveCursorAdjacent(el, cur);
	},
	findNextVisibleNode: cmb => {
		cmb.activateNextNodeBasedOnFn(cur => cmb.ast.getNodeAfter(cur));
	},
	findPrevVisibleNode: cmb => {
		cmb.activateNextNodeBasedOnFn(cur => cmb.ast.getNodeBefore(cur));
	},
	findNextVisibleNodeAndPreserveSelection: cmb => {
		cmb.activateNextNodeBasedOnFn(cur => cmb.ast.getNodeAfter(cur), true);
	},
	findPrevVisibleNodeAndPreserveSelection: cmb => {
		cmb.activateNextNodeBasedOnFn(cur => cmb.ast.getNodeBefore(cur), true);
	},
	collapseOrFindParent: cmb => {
		let node = cmb.getActiveNode();
		if(!(cmb.isNodeExpandable(node) && cmb.maybeChangeNodeExpanded(node, false))) {
        let parent = cmb.ast.getNodeParent(node);
        if(parent) cmb.activateNode(parent, event); else playSound(BEEP);
      } else { cmb.refreshCM(); }
	},
	expandOrFindFirstChild: cmb => {
		let node = cmb.getActiveNode();
		if(!(cmb.isNodeExpandable(node) && cmb.maybeChangeNodeExpanded(node, true))) {
		  let firstChild = cmb.isNodeExpandable(node) && cmb.ast.getNodeFirstChild(node);
		  if(firstChild) cmb.activateNode(firstChild, event); else playSound(BEEP);
		} else { cmb.refreshCM(); }
	},
	// speak parents: "<label>, at level N, inside <label>, at level N-1...""
    speakParents: cmb => {
      var node = cmb.getActiveNode(), parents = [node];
      while(node = cmb.ast.getNodeParent(node)){
        parents.push(node.options['aria-label'] + ", at level "+node["aria-level"]);
      }
      if(parents.length > 1) cmb.say(parents.join(", inside "));
      else playSound(BEEP);
    },
    // Have the subtree read itself intelligently
    speakChildren: cmb => { 
    	let node = cmb.getActiveNode(); 
    	cmb.say(node.toDescription(node['aria-level'])); 
    },
    undo: cmb => {
      if(cmb.searchString !== false) return; // Don't allow in searchMode
      if(cmb.focusHistory.done.length > 0) {
        cmb.say("undo " + cmb.focusHistory.done[0].announcement);
        cmb.cm.execCommand("undo");
        cmb.focusHistory.undone.unshift(cmb.focusHistory.done.shift());
        cmb.focusPath = cmb.focusHistory.undone[0].path;
      }
      else { playSound(BEEP); }
    },
    redo: cmb => {
      if(cmb.searchString !== false) return; // Don't allow in searchMode
      if(cmb.focusHistory.undone.length > 0) {
        cmb.say("redo " + cmb.focusHistory.undone[0].announcement);
        cmb.cm.execCommand("redo");
        cmb.focusHistory.done.unshift(cmb.focusHistory.undone.shift());
        cmb.focusPath = cmb.focusHistory.done[0].path;
      }
      else { playSound(BEEP); }
    },
    paste:  (cmb, e) => { cmb.handlePaste(e); },
    searchModeOff: cmb => {
      cmb.say("Find mode disabled");
      cmb.searchBox.style.display = "none"; 
      cmb.searchString = false;
      cmb.searchBox.innerText = "";
    },
    searchModeOn: cmb => {
      cmb.say("Find mode enabled. Type to search. Enter and Shift-Enter to search forwards"
        +" and backwards. Shift-Escape to cancel");
      cmb.searchBox.style.display = "inline-block";
      cmb.searchString = cmb.searchString || true;
    },
    editNode: cmb => {
  		let node = cmb.getActiveNode();
    	cmb.insertionQuarantine(false, node, event);
    },
  	// create an insertion quarantine in place of the given node
  	editOrToggleExpanded: cmb => {
  		let node = cmb.getActiveNode();
  		if(cmb.isNodeEditable(node)){ cmb.insertionQuarantine(false, node); }
  		else { cmb.maybeChangeNodeExpanded(node) && cmb.refreshCM(); }
  	},
    activateFirstVisibleNode: cmb => { 
    	cmb.activateNode(cmb.ast.rootNodes[0]); 
    },
    activateLastVisibleNode: cmb => {
      let lastExpr = [...cmb.ast.reverseRootNodes[0]];
      var lastNode = lastExpr[lastExpr.length-1];
      if(cmb.isNodeHidden(lastNode)) {
        let searchFn = (cur => cmb.ast.getNodeParent(cur));
        lastNode = cmb.ast.getNextMatchingNode(searchFn, cmb.isNodeHidden, lastNode);
      }      
      cmb.activateNode(lastNode);
    },
    expandAll: cmb => { 
    	cmb.changeAllExpanded(true); 
    },
    collapseAll: cmb => { 
    	cmb.changeAllExpanded(false); 
    },
    activateRoot: cmb => {
      let rootPath = cmb.getActiveNode().path.split(",")[0];
      cmb.activateNode(cmb.ast.getNodeByPath(rootPath));
    }
    searchForward: cmb => {
    	cmb.showNextMatch(true, cmb.ast.getNodeAfter(cmb.getActiveNode()).from);
    },
    searchBackward: cmb => {
    	cmb.showNextMatch(false, cmb.getActiveNode().from);
    },
    toggleSelection: cmb => {
    	cmb.toggleSelection(false);
    },
    toggleSelectionAndPreserveSelection: cmb => {
    	cmb.toggleSelection(true);
    }
};
