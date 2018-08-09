import React from 'react';
import {playSound, BEEP, WRAP} from '../../sound';
import {poscmp} from '../../utils';

function ByBlock({state, handleChange, blocks}) {
  // we want to sort anyway, so Array.from is not really inefficient
  const types = Array
        .from(new Set(Array.from(blocks.ast.nodeIdMap.values()).map(node => node.type)))
        .sort();
  return (
    <select name="blockType" value={state.blockType} onChange={handleChange}>{
        types.map(t => <option key={t} value={t}>{t}</option>)
    }</select>
  );
}

export default {
  label: 'Search by block',
  init: {
    blockType: ''
  },
  component: ByBlock,
  searchMatches: [],
  initSearch: function(blocks, state) {
    this.searchMatches = Array.from(blocks.ast.nodeIdMap.values())
      .filter(node => node.type === state.blockType)
      .sort((a, b) => poscmp(a.from, b.from));
  },
  find: function(blocks, state, forward, e) {
    const activeNode = blocks.getActiveNode();
    // TODO: if this is false, might need to abort

    const cur = activeNode ? activeNode.from : blocks.cm.getCursor();

    let from = null;
    let test = null;
    const matches = this.searchMatches.slice(0);
    if (forward) {
      from = blocks.ast.getNodeAfter(activeNode).from;
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
    let p = blocks.ast.getNodeParent(node);
    while (p) {
      ancestors.unshift(p);
      p = blocks.ast.getNodeParent(p);
    }
    if (blocks.renderOptions.lockNodesOfType.includes(ancestors[0].type)) {
      node = ancestors[0];
    } else {
      ancestors.forEach(a => blocks.maybeChangeNodeExpanded(a, true));
    }
    blocks.refreshCM(cur);
    blocks.activateNode(node, e);
    blocks.say(
      (forward ? index + 1 : matches.length - index) +
        " of " + matches.length,
      100
    );
  }
};
