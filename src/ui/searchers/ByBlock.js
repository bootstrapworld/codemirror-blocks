import React from 'react';
import {playSound, BEEP, WRAP} from '../../sound';
import {poscmp} from '../../utils';

function getAllNodeTypes(blocks) {
  const allNodeTypes = new Set();
  for (const node of blocks.ast.nodeIdMap.values()) {
    allNodeTypes.add(node.type);
  }
  return allNodeTypes;
}

function ByBlock({state, handleChange, blocks}) {
  const allNodeTypes = getAllNodeTypes(blocks);
  const types = Array.from(allNodeTypes).sort();
  let currentBadOption = null;
  if (!allNodeTypes.has(state.blockType)) {
    currentBadOption = (
      <option key={state.blockType} value={state.blockType} disabled hidden>
        {state.blockType}
      </option>
    );
  }
  return (
    <select name="blockType" value={state.blockType} onChange={handleChange}>
      {currentBadOption}
      {types.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export default {
  label: 'Search by block',
  init: {blockType: ''},
  component: ByBlock,
  hasMatch: (state, blocks) => getAllNodeTypes(blocks).has(state.blockType),
  find: function(blocks, state, forward) {
    const activeNode = blocks.getActiveNode();
    const searcher = forward ? blocks.ast.getNodeAfter : blocks.ast.getNodeBefore;

    let startingNode = null;
    let beep = false;
    if (activeNode) {
      startingNode = searcher(activeNode);
    } else {
      const cur = blocks.cm.getCursor();
      startingNode = forward ?
        blocks.ast.getNodeAfterCur(cur) :
        blocks.ast.getNodeBeforeCur(cur);
    }

    // if we are at the first or last block or cursor before the first block
    // or cursor after the last block already, we won't be able to find the
    // next adjacent block.
    if (!startingNode) {
      startingNode = forward ? blocks.getFirstNode() : blocks.getLastNode();
      beep = true;
    }

    return {
      initialStart: () => startingNode,
      wrapStart: () => forward ? blocks.getFirstNode() : blocks.getLastNode(),
      match: node => node.type == state.blockType,
      ending: node => node === null,
      next: node => searcher(node),
      beep,
      getResult: node => node
    };
  }
};
