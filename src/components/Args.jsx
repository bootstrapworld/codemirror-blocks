import React from 'react';
import PropTypes from 'prop-types';

import {ASTNode} from '../ast';
import {DropTarget} from './DropTarget';

const Args = props => {
  let {children} = props;
  const elems = [];
  elems.push(<DropTarget key={'drop-0'} field={props.field}/>);
  children.forEach((child, index) => {
    elems.push(child.reactElement({key : 'node' + index}));
    elems.push(<DropTarget key={'drop-' + (index+1)} field={props.field}/>);
  });
  return elems;
};

Args.propTypes = {
  field: PropTypes.string.isRequired,
  children: PropTypes.arrayOf(PropTypes.instanceOf(ASTNode)).isRequired,
};

export default Args