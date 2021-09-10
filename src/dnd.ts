import {
  DragSource,
  DragSourceConnector,
  DragSourceMonitor,
  DropTarget,
  DropTargetConnector,
  DropTargetMonitor,
  DropTargetSpec,
} from "react-dnd";
import { ASTNode } from "./ast";
import { Primitive } from "./parsers/primitives";
import { isDummyPos } from "./utils";

export enum ItemTypes {
  NODE = "node",
}

export const primitiveSource = {
  beginDrag(props: { primitive: Primitive }) {
    return { content: props.primitive.name };
  },
};

export const nodeSource = {
  beginDrag(props: { node: ASTNode }) {
    if (isDummyPos(props.node.from) && isDummyPos(props.node.to)) {
      return { content: props.node.toString() };
    }
    return { id: props.node.id };
  },
};

export function collectSource(
  connect: DragSourceConnector,
  monitor: DragSourceMonitor
) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
    connectDragPreview: connect.dragPreview(),
  };
}

function nodeTarget<RequiredProps, DragObject, DropResult>(
  dropMethod: (monitor: unknown) => void
): DropTargetSpec<RequiredProps, DragObject, DropResult> {
  return {
    drop(_, monitor, component) {
      if (monitor.didDrop()) return;
      return dropMethod.call(component, monitor);
    },
  };
}

export function collectTarget(
  connect: DropTargetConnector,
  monitor: DropTargetMonitor
) {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver({ shallow: true }),
  };
}

export const DragPrimitiveSource = DragSource(
  ItemTypes.NODE,
  primitiveSource,
  collectSource
);
export const DragNodeSource = DragSource(
  ItemTypes.NODE,
  nodeSource,
  collectSource
);
export const DropNodeTarget = (f: (monitor: DropTargetMonitor) => void) =>
  DropTarget(ItemTypes.NODE, nodeTarget(f), collectTarget);
