import React  from 'react';
import {DragDropContext} from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import {Provider} from 'react-redux';
import {store} from '../store';

export default WrappedComponent =>
  DragDropContext(HTML5Backend)(
    props =>
    <Provider store={store}>
      <WrappedComponent {...props} />
    </Provider>
  );
