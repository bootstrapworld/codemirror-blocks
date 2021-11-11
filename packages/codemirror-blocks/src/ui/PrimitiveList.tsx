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
};

export const Primitive = React.forwardRef<HTMLSpanElement, BasePrimitiveProps>(
  (props, ref) => {
    const { primitive, className, onFocus } = props;
    const focusedNode = useSelector(selectors.getFocusedNode);
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
          ref.current.focus(); // restore focus
          return;
        }
        default:
          return;
      }
    };

    const elem = (
      <span
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        ref={ref as React.Ref<HTMLSpanElement>}
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
  }
);

type PrimitiveGroupProps = {
  setSelectedPrimitive: (primitive: LanguagePrimitive) => void;
  selectedPrimitive?: LanguagePrimitive;
  selected?: string; // to start, no primitive is selected
  group?: PrimitiveGroupModel;
  toolbarRef: React.RefObject<HTMLInputElement>;
};

export const PrimitiveGroup = (props: PrimitiveGroupProps) => {
  const { setSelectedPrimitive, selected, toolbarRef, selectedPrimitive } =
    props;
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
          selected={selected}
          selectedPrimitive={selectedPrimitive}
          toolbarRef={toolbarRef}
          setSelectedPrimitive={setSelectedPrimitive}
        />
      ) : null}
    </li>
  );
};

type PrimitiveListProps = {
  setSelectedPrimitive: (primitive: LanguagePrimitive) => void;
  selectedPrimitive?: LanguagePrimitive;
  toolbarRef: React.RefObject<HTMLInputElement>;
  selected?: string;
  primitives?: LanguagePrimitive[];
  searchString?: string;
};
export const PrimitiveList = React.forwardRef(
  (props: PrimitiveListProps, ref: React.MutableRefObject<HTMLElement>) => {
    const {
      primitives = [],
      selected,
      setSelectedPrimitive,
      selectedPrimitive,
      toolbarRef,
      searchString,
    } = props;

    // @pcardune - typing this array has been a challenge
    // JSX.Element doesn't work, even though that's the
    // recommendation I'm seeing online
    const primitiveRefs = useRef<any[]>([]);

    const renderGroup = (g: PrimitiveGroupModel) => (
      <PrimitiveGroup
        key={g.name}
        group={g}
        selected={selected}
        selectedPrimitive={selectedPrimitive}
        toolbarRef={toolbarRef}
        setSelectedPrimitive={setSelectedPrimitive}
      />
    );

    const renderPrimitive = (p: LanguagePrimitive, i: number) => {
      const primRef = React.createRef<HTMLElement>();
      const prim = (
        <Primitive
          key={p.name}
          primitive={p}
          onFocus={() => setSelectedPrimitive(p)}
          className={selected == p.name ? "selected" : ""}
          ref={primRef}
        />
      );
      primitiveRefs.current[i] = prim;
      return prim;
    };

    // Set selectedPrimitive state, depending on whether we go up or down
    const move = (event: React.KeyboardEvent, dir: "Up" | "Down") => {
      if (!selectedPrimitive || primitives.length == 0) {
        return; // Nothing to select. Bail.
      }

      // compute the index of the newly-selected primitive
      let newIndex;
      const prevIndex = primitives.indexOf(selectedPrimitive); // -1 if nothing selected
      if (dir == "Down") {
        newIndex = Math.min(prevIndex + 1, primitives.length - 1);
      } else {
        newIndex = Math.max(prevIndex - 1, 0);
      }

      // focus on the new DOM node
      const newPrimitiveElt = primitiveRefs.current[newIndex];
      newPrimitiveElt.ref.current.focus();

      // if the index was changed, the event is handled. Do not bubble.
      if (newIndex !== prevIndex) {
        event.stopPropagation();
      }
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (
      event
    ) => {
      const keyName = CodeMirror.keyName(event);
      switch (keyName) {
        case "Down":
        case "Up":
          event.preventDefault();
          move(event, keyName);
          return;
        case "Esc":
          props.toolbarRef.current?.focus(); // focus, then fall-through
          break;
      }
    };

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
          onKeyDown={handleKeyDown}
          ref={ref as React.Ref<HTMLUListElement>}
        >
          {primitives.map((item, i) =>
            item instanceof PrimitiveGroupModel
              ? renderGroup(item)
              : renderPrimitive(item, i)
          )}
        </ul>
      </div>
    );
  }
);

export default PrimitiveList;
