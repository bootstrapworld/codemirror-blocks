import React from 'react';
import PropTypes from 'prop-types';

/**
 * Returns a query from settings. If the query is a regex but is invalid (indicating
 * that users are still in the middle of writing regex),
 * returns an always failing regex instead.
 */
function getQueryFromSettings(state) {
  let query = state.searchString;
  let isRegex = state.isRegex;
  let isExactMatch = state.isExactMatch;
  if (isExactMatch && !isRegex) {
    query = query.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
    isRegex = true;
  }
  if (!isRegex) return query;
  if (isExactMatch) query = '\\b' + query + '\\b';
  try {
    return new RegExp(query);
  } catch (e) {
    return /$^/;
  }
}

function getResults(state, blocks, limit=Infinity) {
  const query = getQueryFromSettings(state);
  const searchCursor = blocks.cm.getSearchCursor(
    query, null, {caseFold: state.isIgnoreCase}
  );
  const searchMatches = [];
  while (searchCursor.findNext() && searchMatches.length < limit) {
    const node = blocks.ast.getNodeContaining(searchCursor.from());
    // make sure we're not just matching a comment
    if (node) searchMatches.push(node);
  }
  return searchMatches;
}

function hasMatch(state, blocks) {
  return state.searchString === '' || getResults(state, blocks, 1).length !== 0;
}

function ByString({state, handleChange, blocks}) {
  function SearchOption({name, value}) {
    return (
      <label>
        <input type="checkbox" name={name} onChange={handleChange}
               checked={state[name]} />
        {value}
      </label>
    );
  }
  SearchOption.propTypes = {
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  };

  const searchBoxClass = hasMatch(state, blocks) ? '' : 'has-error';
  return (
    <React.Fragment>
      <div className={`form-group ${searchBoxClass}`}>
        <input type="text" className="form-control search-input"
               name="searchString"
               onChange={handleChange}
               value={state.searchString} />
      </div>
      <div className="search-options">
        <SearchOption name="isRegex" value="Regex" />
        <SearchOption name="isExactMatch" value="Exact match" />
        <SearchOption name="isIgnoreCase" value="Ignore case" />
      </div>
    </React.Fragment>
  );
}

ByString.propTypes = {
  state: PropTypes.shape({
    searchString: PropTypes.string.isRequired,
    isRegex: PropTypes.bool.isRequired,
    isExactMatch: PropTypes.bool.isRequired,
    isIgnoreCase: PropTypes.bool.isRequired,
  }),
  handleChange: PropTypes.func.isRequired,
  blocks: PropTypes.object.isRequired,
};

export default {
  label: 'Search by string',
  init: {
    searchString: '',
    isRegex: false,
    isExactMatch: false,
    isIgnoreCase: true,
  },
  component: ByString,
  hasMatch,
  /**
   * find: (Blocks, State, Bool, Event) -> ASTNode?
   */
  find: function(blocks, state, forward, e) {
    if (state.searchString === '') {
      blocks.switchNodes(
        forward ? blocks.ast.getNodeAfter : blocks.ast.getNodeBefore,
        forward ? blocks.ast.getNodeAfterCur : blocks.ast.getNodeBeforeCur,
        e
      );
      return null;
    }
    const options = {caseFold: state.isIgnoreCase};

    // we don't want to stay at the currently active block because
    // if the current block matches already, searching won't be able to progress.
    const activeNode = blocks.getActiveNode();
    let cur = null;
    let beep = false;
    if (activeNode) {
      // TODO: this will skip over plain comment. Might need to change once
      // commenting mechanism is fixed.
      const node = forward ?
            blocks.ast.getNodeAfter(activeNode) :
            blocks.ast.getNodeBefore(activeNode);
      if (node) {
        cur = forward ? node.from : node.to;
      } else {
        // if we are at the first or last block already, we won't be able to find the
        // next adjacent block.
        cur = forward ? blocks.getBeginCursor() : blocks.getEndCursor();
        beep = true;
      }
    } else {
      cur = blocks.cm.getCursor();
    }

    const query = getQueryFromSettings(state);

    function next(searchCursor) {
      searchCursor.find(!forward);
      return searchCursor;
    }
    function getSearchCursor(query, cur, options) {
      // we need to activate next right away so that we have the `from` field.
      return next(blocks.cm.getSearchCursor(query, cur, options));
    }

    return {
      initialStart: () => getSearchCursor(query, cur, options),
      wrapStart: () => getSearchCursor(
        query,
        forward ? blocks.getBeginCursor() : blocks.getEndCursor(),
        options
      ),
      match: searchCursor => blocks.ast.getNodeContaining(searchCursor.from()),
      ending: searchCursor => !searchCursor.from(),
      next,
      beep,
      getResult: searchCursor => blocks.ast.getNodeContaining(searchCursor.from())
    };
  }
};
