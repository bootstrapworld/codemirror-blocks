import { Editor } from "codemirror";
import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";
import type { AppStore } from "../store";

export const CMContext: React.Context<Editor> = React.createContext(null);

export default function Context(props: {
  store: AppStore;
  children: React.ReactNode;
}) {
  return (
    <DndProvider backend={HTML5Backend}>
      <Provider store={props.store}>{props.children}</Provider>
    </DndProvider>
  );
}
