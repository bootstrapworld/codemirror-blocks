import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Provider } from 'react-redux';
import { store } from '../store';

export default function Context<Props>(
  WrappedComponent: React.ComponentType<Props>
) {
  return (props: Props) => (
    <DndProvider backend={HTML5Backend}>
      <Provider store={store}>
        <WrappedComponent {...props} />
      </Provider>
    </DndProvider>
  );
}
