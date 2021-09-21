import React, { ReactElement, useState } from "react";
import classNames from "classnames";
import PrimitiveList from "./PrimitiveList";
import { Primitive, PrimitiveGroup } from "../parsers/primitives";
import CodeMirror from "codemirror";
import "./Toolbar.less";

type Props = {
  primitives?: PrimitiveGroup;
  languageId?: string; // used to find the .blocks-language-{languageId} CSS class
  blockMode?: boolean;
  toolbarRef: React.RefObject<HTMLInputElement>;
};

var Toolbar = (props: Props) => {
  const { primitives, languageId, blockMode, toolbarRef } = props;

  const [search, setSearch] = useState("");
  const [selectedPrimitive, setSelectedPrimitive] = useState(null);
  const clearSearch = () => setSearch("");
  const changeSearch: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    setSearch(event.target.value);

  // Get a flat array of all primitives matching 'search'
  const getPrimitives = () =>
    (primitives?.filter(search).primitives || []) as Primitive[];

  // Focus on the primitive if it's already selected, or select a new one
  const focusPrimitive = (primitive:Primitive) => {
    if (primitive?.element) {
      primitive.element.focus(); // should *not* apply useCallback, correct?
    } else {
      setSelectedPrimitive(primitive);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
    event
  ) => {
    const keyName = CodeMirror.keyName(event);
    switch (keyName) {
      case "Down":
      case "Up":
        event.preventDefault();
        let primitives = getPrimitives();
        if (primitives.length == 0) return; // Nothing to select. Bail.
        let i = primitives.indexOf(selectedPrimitive); // -1 if nothing selected
        i += (keyName == "Down")? 1 : -1;   // increment or decrement
        i = Math.max(Math.min(i,  primitives.length - 1), 0); // clamp
        focusPrimitive(primitives[i]);
        return;
      case "Esc":
        toolbarRef.current.focus();
      default:
        event.stopPropagation();
        return;
    }
  };

  // if a primitive is selected, make a block node for it
  const selectedPrimitiveBlock = selectedPrimitive ? (
    <span
      className="RenderedBlockNode"
      key={String(getPrimitives().indexOf(selectedPrimitive))}
    >
      {selectedPrimitive.getASTNode().reactElement({ inToolbar: true })}
    </span>
  ) : (
    ""
  );

  return (
    <div
      className={classNames("blocks-ui Toolbar", {
        "has-selected": !!selectedPrimitive,
      })}
    >
      <div className="search-box" role="search">
        <label className="screenreader-only" htmlFor="search_box">
          <h2>Search Functions</h2>
        </label>
        <input
          type="search"
          id="search_box"
          placeholder="Search functions"
          disabled={!blockMode}
          className="form-control"
          value={search}
          onKeyDown={handleKeyDown}
          ref={toolbarRef}
          onChange={changeSearch}
        />
        {search ? (
          <button
            aria-label="clear text"
            className="glyphicon glyphicon-remove"
            onClick={clearSearch}
          />
        ) : null}
      </div>
      <div className="primitives-box">
        <PrimitiveList
          onFocus={setSelectedPrimitive}
          onKeyDown={handleKeyDown}
          selected={selectedPrimitive && selectedPrimitive.name}
          primitives={getPrimitives()}
          searchString={search}
        />
      </div>
      <div
        className={classNames(
          "selected-primitive",
          `blocks-language-${languageId}`
        )}
      >
        <div className="block-header">Block</div>
        {selectedPrimitiveBlock}
      </div>
    </div>
  );
};

export default Toolbar;
