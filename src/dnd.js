import {DragSource, DropTarget} from 'react-dnd';
import {isDummyPos} from './utils';
import global from './global';

export const ItemTypes = {
  NODE: 'node',
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
    isDragging: monitor.isDragging()
  };
}

export const nodeTarget = nodeTargetFn => ({
  drop(props, monitor) {
    if (monitor.didDrop()) return;
    const {x: left, y: top} = monitor.getClientOffset();
    props.onDrop(
      monitor.getItem(),
      nodeTargetFn(props.location
                   ? props
                   : {...props, location: global.cm.coordsChar({left, top})})
    );
  }
});

export function collectTarget(connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver({shallow: true})
  };
}


export const DragNodeSource = DragSource(ItemTypes.NODE, nodeSource, collectSource);
export const DropNodeTarget = nodeTargetFn =>
  DropTarget(ItemTypes.NODE, nodeTarget(nodeTargetFn), collectTarget);
