import {DragSource, DropTarget} from 'react-dnd';
import {isDummyPos} from './utils';
import SHARED from './shared';

export const ItemTypes = {
  NODE: 'node',
};

export const primitiveSource = {
  beginDrag(props) {
    return {content: props.primitive.name};
  }
};

export const nodeSource = {
  beginDrag(props) {
    if (isDummyPos(props.node.from) && isDummyPos(props.node.to)) {
      return {content: props.node.toString()};
    }
    return {id: props.node.id};
  }
};

export function collectSource(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
    connectDragPreview: connect.dragPreview()
  };
}

function nodeTarget(dropMethod) {
  return {
    drop(_, monitor, component) {
      if (monitor.didDrop()) return;
      return dropMethod.call(component, monitor);
    }
  }
}

export function collectTarget(connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver({shallow: true})
  };
}


export const DragPrimitiveSource = DragSource(ItemTypes.NODE, primitiveSource, collectSource);
export const DragNodeSource = DragSource(ItemTypes.NODE, nodeSource, collectSource);
export const DropNodeTarget = (f) => DropTarget(ItemTypes.NODE, nodeTarget(f), collectTarget);
