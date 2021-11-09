import React, { useState } from "react";
import classNames from "classnames";
import PrimitiveList from "./PrimitiveList";
import { Primitive, PrimitiveGroup } from "../parsers/primitives";
import CodeMirror from "codemirror";
import "./Toolbar.less";
import { err } from "../edits/result";

type Props = {
  primitives?: PrimitiveGroup;
  languageId?: string; // used to find the .blocks-language-{languageId} CSS class
  blockMode?: boolean;
  toolbarRef: React.RefObject<HTMLInputElement>;
};

const Toolbar = (props: Props) => {
  const [search, setSearch] = useState("");
  const [selectedPrimitive, setSelectedPrimitive] = useState<
    Primitive | undefined
  >(undefined);
  const clearSearch = () => setSearch("");
  const changeSearch: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    setSearch(event.target.value);

  // Get a flat array of all primitives matching 'search'
  const getPrimitives = () =>
    (props.primitives?.filter(search).primitives || []) as Primitive[];

  // Set selectedPrimitive state, depending on whether we go up or down
  const move = (dir: "Up" | "Down") => {
    const primitives = getPrimitives();
    if (!selectedPrimitive || primitives.length == 0) {
      return; // Nothing to select. Bail.
    }

    // compute the index of the newly-selected primitive
    let i = primitives.indexOf(selectedPrimitive); // -1 if nothing selected
    if (dir == "Down") {
      i = Math.min(i + 1, primitives.length - 1);
    } else {
      i = Math.max(i - 1, 0);
    }

    //
    const elt = document.getElementById("toolbar-" + primitives[i].name);
    if (elt) {
      elt.focus();
    } else {
      return err("No DOM node was created for " + primitives[i].name);
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
        move(keyName);
        return;
      case "Esc":
        props.toolbarRef.current?.focus(); // focus, then fall-through
        break;
    }
    event.stopPropagation();
  };

  // if a primitive is selected, make a block node for it
  const primitiveNode = selectedPrimitive?.getASTNode();
  const selectedPrimitiveBlock = primitiveNode ? (
    <span className="RenderedBlockNode">
      {primitiveNode.reactElement({ inToolbar: true })}
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
          disabled={!props.blockMode}
          className="form-control"
          value={search}
          onKeyDown={handleKeyDown}
          ref={props.toolbarRef}
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
          primitives={getPrimitives()}
          setSelectedPrimitive={setSelectedPrimitive}
          onKeyDown={handleKeyDown}
          selected={selectedPrimitive && selectedPrimitive.name}
          searchString={search}
        />
      </div>
      <div
        className={classNames(
          "selected-primitive",
          `blocks-language-${props.languageId}`
        )}
      >
        <div className="block-header">Block</div>
        {selectedPrimitiveBlock}
      </div>
    </div>
  );
};

export default Toolbar;
