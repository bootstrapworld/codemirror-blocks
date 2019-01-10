import {DragSource, DropTarget} from 'react-dnd';
import {isDummyPos} from './utils';
import global from './global';
import {playSound, BEEP} from './sound';

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
    isDragging: monitor.isDragging(),
    connectDragPreview: connect.dragPreview()
  };
}

export const nodeTarget = nodeTargetFn => ({
  drop(props, monitor) {
    if (monitor.didDrop()) return;
    const {x: left, y: top} = monitor.getClientOffset();
    // if it's a proper drop target, just drop at the provided location
    if(props.location) {
      return props.onDrop(monitor.getItem(), nodeTargetFn(props));
    }
    // if not, make sure it's a valid drop (i.e. - not on any CM node marker)
    let roots = global.cm.getAllMarks().filter(m => m.BLOCK_NODE_ID);
    let validTopLevelDrop = !roots.some(root => {
      let r = root.replacedWith.firstChild.getBoundingClientRect();
      return (r.left<left) && (left<r.right) && (r.top<top) && (top<r.bottom);
    });
    if(validTopLevelDrop) {
      props.onDrop(
        monitor.getItem(),
        nodeTargetFn({...props, location: global.cm.coordsChar({left, top})}));
    } else { // beep and make it a no-op
      playSound(BEEP);
    }
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
