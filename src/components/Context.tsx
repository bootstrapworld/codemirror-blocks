import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";
import type { Language } from "../CodeMirrorBlocks";
import { CMBEditor } from "../editor";
import type { AppStore } from "../store";
import { Search } from "../ui/BlockEditor";

export const EditorContext = React.createContext<CMBEditor | null>(null);
export const LanguageContext = React.createContext<Language | null>(null);

export type AppHelpers = {
  /**
   * @internal
   * Dialog showing/hiding methods deal with ToggleEditor state.
   * We pass them to mode-specific components, to allow those
   * components to show/hide dialogs
   *
   * This is hooked up when ToggleEditor gets mounted
   */
  showDialog?: (
    contents: null | { title: string; content: React.ReactElement }
  ) => void;
  focusToolbar?: () => void;
  search?: Search;
};

export const AppContext = React.createContext<AppHelpers>({});

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
