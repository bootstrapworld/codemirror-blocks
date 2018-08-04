import {playSound, BEEP, WRAP} from '../sound';
import {poscmp} from '../utils';

export default class {
  constructor(blocks) {
    this.blocks = blocks;
  }

  getLabel() {
    return 'Search by usual';
  }

  find(forward, e) {
    const activeNode = this.blocks.getActiveNode();
    // TODO: if this is false, might need to abort

    const cur = activeNode ? activeNode.from : this.blocks.cm.getCursor();

    let from = null;
    let test = null;
    const matches = this.searchMatches.slice(0);
    if (forward) {
      from = this.blocks.ast.getNodeAfter(activeNode).from;
      test = d => (d >= 0);
    } else {
      from = activeNode.from;
      test = d => (d < 0);
      matches.reverse(); // if we're searching backwards, reverse the array
    }

    let index = matches.findIndex(n => test(poscmp(n.from, from)));
    // if we go off the edge, wrap to 0 & play sound
    if (index < 0) {
      index = 0;
      playSound(BEEP);
    }

    let node = matches[index];
    const ancestors = [node];
    let p = this.blocks.ast.getNodeParent(node);
    while (p) {
      ancestors.unshift(p);
      p = this.blocks.ast.getNodeParent(p);
    }
    if (this.blocks.renderOptions.lockNodesOfType.includes(ancestors[0].type)) {
      node = ancestors[0];
    } else {
      ancestors.forEach(a => this.blocks.maybeChangeNodeExpanded(a, true));
    }
    this.blocks.refreshCM(cur);
    this.blocks.activateNode(node, e);
    this.blocks.say(
      (forward ? index + 1 : matches.length - index) +
        " of " + matches.length,
      100
    );
  }

  // Status: DONE
  initSearch(searchString) {
    const searchCursor = this.blocks.cm.getSearchCursor(searchString);
    this.searchMatches = [];
    while (searchCursor.findNext()) {
      const node = this.blocks.ast.getNodeContaining(searchCursor.from());
      if (node) this.searchMatches.push(node); // make sure we're not just matching a comment
    }

    // no matches! wrap.
    if (this.searchMatches.length === 0) {
      playSound(WRAP);
    }
  }
}
