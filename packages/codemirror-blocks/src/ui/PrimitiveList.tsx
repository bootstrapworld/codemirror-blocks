import React, { useState, useRef } from "react";
import classNames from "classnames";
import {
  PrimitiveGroup as PrimitiveGroupModel,
  Primitive as LanguagePrimitive,
} from "../parsers/primitives";
import { ItemTypes } from "../dnd";
import { say } from "../announcer";
import * as selectors from "../state/selectors";
import CodeMirror from "codemirror";
import { defaultKeyMap } from "../keymap";
import { useSelector } from "react-redux";
import { useDrag } from "react-dnd";
import { copy } from "../copypaste";

require("./PrimitiveList.less");

type BasePrimitiveProps = {
  primitive: LanguagePrimitive;
  className: string;
  onFocus: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
};

export const Primitive = (props: BasePrimitiveProps) => {
  const { primitive, className, onFocus, onKeyDown } = props;

  const focusedNode = useSelector(selectors.getFocusedNode);
  const primitiveElt = useRef<HTMLSpanElement>(null);

  const [_, connectDragSource, connectDragPreview] = useDrag({
    type: ItemTypes.NODE,
    item: { content: primitive.name },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (defaultKeyMap[CodeMirror.keyName(e)]) {
      case "Copy": {
        e.preventDefault();
        const node = primitive.getASTNode();
        copy({ focusedNode }, [node]);
        say("copied " + primitive.toString());
        primitiveElt.current?.focus(); // restore focus
        return;
      }
      default:
        onKeyDown(e);
        return;
    }
  };

  const elem = (
    <span
      tabIndex={-1}
      id={"toolbar-" + primitive.name}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      ref={primitiveElt}
      className={classNames(className, "Primitive list-group-item")}
    >
      {primitive.name}
    </span>
  );
  const draggableElem = connectDragPreview(connectDragSource(elem), {
    offsetX: 1,
    offsetY: 1,
  });
  return <li>{draggableElem}</li>;
};

type PrimitiveGroupProps = {
  setSelectedPrimitive: (primitive: LanguagePrimitive) => void;
  onKeyDown: BasePrimitiveProps["onKeyDown"];
  selected?: string; // to start, no primitive is selected
  group?: PrimitiveGroupModel;
};

export const PrimitiveGroup = (props: PrimitiveGroupProps) => {
  const { setSelectedPrimitive, onKeyDown, selected } = props;
  const group = props.group ?? new PrimitiveGroupModel("", "", []);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded(!expanded);

  const expandoClass = classNames(
    "glyphicon",
    expanded ? "glyphicon-minus" : "glyphicon-plus"
  );
  return (
    <li className="PrimitiveGroup list-group-item" role="list">
      <div onFocus={toggleExpanded} className="group-header">
        <span className={expandoClass} aria-hidden="true" />
      </div>
      {expanded ? (
        <PrimitiveList
          primitives={[...group.flatPrimitivesIter()]}
          setSelectedPrimitive={setSelectedPrimitive}
          onKeyDown={onKeyDown}
          selected={selected}
        />
      ) : null}
    </li>
  );
};

type PrimitiveListProps = {
  setSelectedPrimitive: (primitive: LanguagePrimitive) => void;
  onKeyDown: BasePrimitiveProps["onKeyDown"];
  selected?: string;
  primitives?: LanguagePrimitive[];
  searchString?: string;
};
export const PrimitiveList = (props: PrimitiveListProps) => {
  const {
    primitives = [],
    selected,
    setSelectedPrimitive,
    onKeyDown,
    searchString,
  } = props;
  const renderGroup = (g: PrimitiveGroupModel) => (
    <PrimitiveGroup
      key={g.name}
      group={g}
      setSelectedPrimitive={setSelectedPrimitive}
      onKeyDown={onKeyDown}
      selected={selected}
    />
  );
  const renderPrimitive = (p: LanguagePrimitive) => (
    <Primitive
      key={p.name}
      primitive={p}
      onFocus={() => setSelectedPrimitive(p)}
      onKeyDown={onKeyDown}
      className={selected == p.name ? "selected" : ""}
    />
  );

  const text = searchString
    ? (primitives.length == 0 ? "No" : primitives.length) + " blocks found"
    : "blocks";

  return (
    <div>
      <h3
        id="toolbar_heading"
        className="screenreader-only"
        aria-live="assertive"
        aria-atomic="true"
      >
        {text}
      </h3>
      <ul
        className="PrimitiveList list-group"
        aria-labelledby="toolbar_heading"
      >
        {primitives.map((item) =>
          item instanceof PrimitiveGroupModel
            ? renderGroup(item)
            : renderPrimitive(item)
        )}
      </ul>
    </div>
  );
};

export default PrimitiveList;
