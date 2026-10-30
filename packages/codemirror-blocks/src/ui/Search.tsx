import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import * as selectors from "../state/selectors";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.less";
import Dialog from "../components/Dialog";
import { say } from "../announcer";
import { ASTNode, Pos } from "../ast";
import type { ReadonlyCMBEditor } from "../editor";
import type { RootState } from "../state/reducers";
import { playSound, WRAP } from "../utils";
import ByBlock from "./searchers/ByBlock";
import ByString from "./searchers/ByString";
import type { Searcher } from "./searchers/Searcher";

/**
 * Search is what PageUp and PageDown do: step to the next (or previous) match
 * of whatever the Search Settings dialog (F3, Ctrl-F or Cmd-F) was last given.
 */
export type SearchApi = {
  /**
   * Show the Search Settings dialog. When it is closed with Enter (not Escape),
   * `thenSearch` runs, to go to the first match.
   */
  open: (thenSearch: () => void) => void;
  /**
   * The next match from `from` (the previous one if `forward` is false), going
   * on from the other end of the document if there is none before the end. A
   * match is never the block that already has the focus. Null if there is no
   * match, or no search has been set up.
   */
  find: (
    forward: boolean,
    state: RootState,
    from: Pos | null
  ) => ASTNode | null;
};

// each searcher is typed by its own settings, which this does not need to know
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySearcher = Searcher<any, any>;
const searchModes: AnySearcher[] = [ByString, ByBlock];

/**
 * The state of the search, and the dialog that sets it. The dialog is returned
 * as an element to render, and the rest as the object the keyboard commands use.
 * Search only works once there is an editor to search in.
 */
export function useSearch(
  editor: ReadonlyCMBEditor | null,
  appElement?: HTMLElement
) {
  const ast = useSelector(selectors.getAST);
  const [isOpen, setIsOpen] = useState(false);
  const [firstTime, setFirstTime] = useState(true);
  const [settings, setSettings] = useState(() =>
    searchModes.map((mode) => mode.setting)
  );
  // null until the user has chosen what to search for, as the dialog's tabs
  // start out on the first mode
  const [mode, setMode] = useState<number | null>(null);

  // The commands are made once, and ask for the latest of these when they run
  const latestRef = useRef({ editor, settings, mode });
  latestRef.current = { editor, settings, mode };
  const thenSearchRef = useRef<() => void>(() => undefined);

  const find: SearchApi["find"] = useCallback((forward, state, from) => {
    const { editor, settings, mode } = latestRef.current;
    if (mode === null) {
      say("No search settings have been selected");
      return null;
    }
    if (!editor) {
      return null;
    }
    const searcher = searchModes[mode];
    // go from `start` to the first match that is not already focused
    const search = (start: Pos) => {
      let cur = start;
      for (;;) {
        const result = searcher.search(
          cur,
          settings[mode],
          editor,
          state,
          forward
        );
        if (!result) {
          return null;
        }
        if (result.node.id !== state.focusId) {
          return result.node;
        }
        cur = result.cursor;
      }
    };
    const found = from && search(from);
    if (found) {
      return found;
    }
    // nothing after (or before) here: go on from the other end of the document
    // (from before the first character, so that a block starting there counts)
    const wrapped = search(forward ? { line: -1, ch: 0 } : editor.getLastPos());
    if (wrapped) {
      playSound(WRAP);
    }
    return wrapped;
  }, []);

  const open: SearchApi["open"] = useCallback((then) => {
    thenSearchRef.current = then;
    setIsOpen(true);
  }, []);

  const api = useMemo<SearchApi>(() => ({ open, find }), [open, find]);

  const close = () => {
    setIsOpen(false);
    setFirstTime(true);
  };

  // Closing the dialog gives focus back to where it was, so going to the first
  // match has to wait until that has happened
  const searchAfterCloseRef = useRef(false);
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter") {
      searchAfterCloseRef.current = true;
      close();
      say(
        "Searching for next match. Use PageUp and PageDown to search forwards and backwards"
      );
    }
  };
  const handleAfterClose = () => {
    if (searchAfterCloseRef.current) {
      searchAfterCloseRef.current = false;
      thenSearchRef.current();
    }
  };

  // the dialog's tabs change the kind of search with the left and right arrows,
  // but not with up and down, which move within a mode
  const handleTab = (index: number, _last: number, event: Event) => {
    setFirstTime(false);
    if (["ArrowDown", "ArrowUp"].includes((event as KeyboardEvent).key)) {
      return false;
    }
    setMode(index);
    return undefined;
  };

  const handleChange = (index: number) => (setting: unknown) => {
    setSettings((all) => all.map((s, i) => (i === index ? setting : s)));
    setMode(index);
  };

  const content = (
    <>
      <i>
        What should <kbd>PgUp</kbd> and <kbd>PgDown</kbd> search for?
      </i>
      <Tabs onSelect={handleTab} defaultFocus={true}>
        <TabList>
          {searchModes.map(({ label }) => (
            <Tab key={label}>{label}</Tab>
          ))}
        </TabList>
        {searchModes.map(({ label, component: SearchMode }, i) => (
          <TabPanel key={label}>
            <SearchMode
              setting={settings[i]}
              firstTime={firstTime}
              onChange={handleChange(i)}
              cmbState={{ ast }}
            />
          </TabPanel>
        ))}
      </Tabs>
      <div className="modal-footer">
        <small className="form-text text-muted">
          <div>
            <kbd>&larr;</kbd>
            <kbd>&rarr;</kbd> to change modes; &nbsp;
            <kbd>&crarr;</kbd> to close and find next, <kbd>esc</kbd> to close;
          </div>
        </small>
      </div>
    </>
  );

  const dialog = (
    <Dialog
      isOpen={isOpen}
      closeFn={close}
      keyUp={handleKey}
      onAfterClose={handleAfterClose}
      appElement={appElement}
      body={{ title: "Search Settings", content }}
    />
  );

  return { api, dialog };
}
