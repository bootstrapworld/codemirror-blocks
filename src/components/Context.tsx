import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";
import { CMBEditor } from "../editor";
import type { AppStore } from "../store";

export const EditorContext = React.createContext<CMBEditor | null>(null);

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
