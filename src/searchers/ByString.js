import React from 'react';
import {playSound, BEEP, WRAP} from '../sound';
import {poscmp} from '../utils';

function ByString({state, handleChange}) {
  function SearchOption({name, value, init}) {
    return (
      <label>
        <input type="checkbox" name={name} onChange={handleChange}
               checked={state[name]} />
        {value}
      </label>
    );
  }
  return (
    <React.Fragment>
      <input type="text" className="form-control search-input"
             name="searchString"
             onChange={handleChange}
             value={state.searchString} />
      <div className="search-options">
        <SearchOption name="isRegex" value="Regex" />
        <SearchOption name="isExactMatch" value="Exact match" />
        <SearchOption name="isIgnoreCase" value="Ignore case" />
      </div>
    </React.Fragment>
  );
}

export default {
  label: 'Search by string',
  init: {
    searchString: '',
    isRegex: false,
    isExactMatch: false,
    isIgnoreCase: true,
  },
  component: ByString,
  searchMatches: [],
  query: null,
  initSearch: function(blocks, state) {
    if (state.searchString === '') return;

    let query = state.searchString;
    let flag = 'g'; // always global
    if (!state.isRegex) {
      // escape normal string to regex
      // from the searchOverlay function in
      // https://codemirror.net/addon/search/search.js
      query = query.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
    }
    if (state.isExactMatch) query = '\\b' + query + '\\b';
    if (state.isIgnoreCase) flag += 'i';
    this.query = new RegExp(query, flag);
    const searchCursor = blocks.cm.getSearchCursor(this.query);
    this.searchMatches = [];
    while (searchCursor.findNext()) {
      const node = blocks.ast.getNodeContaining(searchCursor.from());
      // make sure we're not just matching a comment
      if (node) this.searchMatches.push(node);
    }

    // no matches! wrap.
    if (this.searchMatches.length === 0) {
      playSound(WRAP);
    }
  },
  find: function(blocks, state, forward, e) {
    if (state.searchString === '') {
      blocks.switchNodes(forward ? blocks.ast.getNodeAfter : blocks.ast.getNodeBefore, e);
      return;
    }
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
