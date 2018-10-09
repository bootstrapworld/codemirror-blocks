import React, {Component} from 'react';
import {DragDropContext} from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

export default WrappedComponent =>
  DragDropContext(HTML5Backend)(
    props => <WrappedComponent {...props} />
  )
